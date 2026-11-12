import { describe, it, expect, vi } from "vitest";
import { GetAccountCommand, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { SesMailer, sesHeaders, sesTags } from "../services/mail/sesMailer";
import type { SendMailOptions } from "../ports";

const config = { region: "eu-west-1", accessKeyId: "AKIA", secretAccessKey: "s" };

function fakeClient(reply: (command: unknown) => unknown) {
  const send = vi.fn(async (command: unknown) => reply(command));
  return { client: { send } as never, send };
}

const awsError = (name: string, message = name) => Object.assign(new Error(message), { name });

const options: SendMailOptions = {
  from: "Senlo <hi@senlo.io>",
  to: "bob@example.com",
  subject: "Hello",
  html: "<p>Hi</p>",
  text: "Hi",
  replyTo: "help@senlo.io",
  tags: { project_id: "1", campaign_id: "100", contact_id: "7" },
  headers: {
    "List-Unsubscribe": "<https://senlo.io/unsubscribe/t>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  },
};

describe("SesMailer.send", () => {
  it("sends simple content with headers, tags and the configuration set", async () => {
    const { client, send } = fakeClient(() => ({ MessageId: "ses-msg-1" }));
    const mailer = new SesMailer({ ...config, configurationSet: " senlo-events " }, client);

    expect(await mailer.send(options)).toEqual({ success: true, messageId: "ses-msg-1" });

    const command = send.mock.calls[0][0] as SendEmailCommand;
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect(command.input).toMatchObject({
      FromEmailAddress: "Senlo <hi@senlo.io>",
      Destination: { ToAddresses: ["bob@example.com"] },
      ReplyToAddresses: ["help@senlo.io"],
      ConfigurationSetName: "senlo-events",
      EmailTags: [
        { Name: "project_id", Value: "1" },
        { Name: "campaign_id", Value: "100" },
        { Name: "contact_id", Value: "7" },
      ],
      Content: {
        Simple: {
          Subject: { Data: "Hello", Charset: "UTF-8" },
          Body: { Html: { Data: "<p>Hi</p>", Charset: "UTF-8" }, Text: { Data: "Hi", Charset: "UTF-8" } },
          Headers: [
            { Name: "List-Unsubscribe", Value: "<https://senlo.io/unsubscribe/t>" },
            { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
          ],
        },
      },
    });
  });

  it("leaves out what is not given", async () => {
    const { client, send } = fakeClient(() => ({ MessageId: "m" }));
    await new SesMailer(config, client).send({ from: "a@b.c", to: "d@e.f", subject: "s", html: "h" });
    const input = (send.mock.calls[0][0] as SendEmailCommand).input;
    expect(input.ConfigurationSetName).toBeUndefined();
    expect(input.EmailTags).toBeUndefined();
    expect(input.ReplyToAddresses).toBeUndefined();
    expect(input.Content?.Simple?.Headers).toBeUndefined();
    expect(input.Content?.Simple?.Body?.Text).toBeUndefined();
  });

  it.each([
    "MessageRejected",
    "MailFromDomainNotVerifiedException",
    "AccountSuspendedException",
    "SendingPausedException",
    "NotFoundException",
    "BadRequestException",
    "UnrecognizedClientException",
    "AccessDeniedException",
  ])("marks %s as permanent", async (name) => {
    const { client } = fakeClient(() => {
      throw awsError(name, `${name} happened`);
    });
    expect(await new SesMailer(config, client).send(options)).toEqual({
      success: false,
      error: `${name} happened`,
      permanent: true,
    });
  });

  it.each(["TooManyRequestsException", "LimitExceededException", "InternalServiceErrorException", "TimeoutError"])(
    "lets %s be retried",
    async (name) => {
      const { client } = fakeClient(() => {
        throw awsError(name);
      });
      expect(await new SesMailer(config, client).send(options)).toMatchObject({ success: false, permanent: false });
    },
  );
});

describe("sesHeaders", () => {
  it("drops headers SES reserves, in any case", () => {
    expect(
      sesHeaders({ "List-Unsubscribe": "<x>", "message-id": "<y>", From: "a@b.c", "Reply-To": "d@e.f", "X-Entity": "1" }),
    ).toEqual([
      { Name: "List-Unsubscribe", Value: "<x>" },
      { Name: "X-Entity", Value: "1" },
    ]);
    expect(sesHeaders({ Subject: "s" })).toBeUndefined();
    expect(sesHeaders(undefined)).toBeUndefined();
  });
});

describe("sesTags", () => {
  it("replaces characters SES refuses and caps the length", () => {
    expect(sesTags({ "event name": "user.signed up", ok: "a-b_c" })).toEqual([
      { Name: "event_name", Value: "user_signed_up" },
      { Name: "ok", Value: "a-b_c" },
    ]);
    const long = sesTags({ k: "x".repeat(300) })!;
    expect(long[0].Value).toHaveLength(256);
  });

  it("drops empty values", () => {
    expect(sesTags({ project_id: "1", campaign_id: "" })).toEqual([{ Name: "project_id", Value: "1" }]);
    expect(sesTags({})).toBeUndefined();
  });
});

describe("SesMailer.verify", () => {
  const verifyWith = (reply: () => unknown) => new SesMailer(config, fakeClient(reply).client).verify();

  it("is valid for a production account that can send", async () => {
    expect(await verifyWith(() => ({ SendingEnabled: true, ProductionAccessEnabled: true }))).toEqual({ status: "valid" });
  });

  it("calls GetAccount", async () => {
    const { client, send } = fakeClient(() => ({ SendingEnabled: true, ProductionAccessEnabled: true }));
    await new SesMailer(config, client).verify();
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetAccountCommand);
  });

  it("warns about the sandbox and about paused sending, without refusing the key", async () => {
    expect(await verifyWith(() => ({ SendingEnabled: true, ProductionAccessEnabled: false }))).toMatchObject({
      status: "limited",
      message: expect.stringMatching(/sandbox/),
    });
    expect(await verifyWith(() => ({ SendingEnabled: false, ProductionAccessEnabled: true }))).toMatchObject({
      status: "limited",
      message: expect.stringMatching(/paused/),
    });
  });

  it("refuses a bad key, accepts a send-only key, is unsure otherwise", async () => {
    const fails = (name: string) => () => {
      throw awsError(name);
    };
    expect((await verifyWith(fails("UnrecognizedClientException"))).status).toBe("invalid");
    expect((await verifyWith(fails("InvalidSignatureException"))).status).toBe("invalid");
    expect((await verifyWith(fails("AccessDeniedException"))).status).toBe("limited");
    expect((await verifyWith(fails("TimeoutError"))).status).toBe("unknown");
  });
});
