"use server";

import { revalidatePath } from "next/cache";
import { EmailProviderRepository, db } from "@senlo/db";
import { EmailProvider, EmailProviderType } from "@senlo/core";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { CreateProviderSchema, UpdateProviderSchema } from "./schemas";
import { auth } from "apps/web/auth";

const providerRepo = new EmailProviderRepository(db);

export type CreateProviderError = {
  error: {
    formErrors: string[];
    fieldErrors: {
      name?: string[];
      type?: string[];
      apiKey?: string[];
      webhookSecret?: string[];
      domain?: string[];
      region?: string[];
      accessKeyId?: string[];
      secretAccessKey?: string[];
      serverToken?: string[];
      host?: string[];
      port?: string[];
      encryption?: string[];
      username?: string[];
      password?: string[];
      general?: string[];
    };
  };
};

export type CreateProviderResult =
  | { success: true; data: EmailProvider }
  | CreateProviderError;

export type UpdateProviderResult = CreateProviderResult;

export async function listProviders(): Promise<ActionResult<EmailProvider[]>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    logger.debug("Listing all email providers", { userId });
    return await providerRepo.findByUser(userId);
  });
}

export async function createProviderAction(
  formData: FormData,
): Promise<CreateProviderResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: { formErrors: ["Unauthorized"], fieldErrors: {} } };
  }

  const parsed = CreateProviderSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      error: parsed.error.flatten(),
    };
  }

  const {
    name,
    type,
    apiKey,
    webhookSecret,
    domain,
    region,
    accessKeyId,
    secretAccessKey,
    serverToken,
    host,
    port,
    encryption,
    username,
    password,
  } = parsed.data;

  try {
    let config: Record<string, string | number> = {};

    if (type === "RESEND") {
      if (!apiKey) {
        return {
          error: {
            formErrors: [],
            fieldErrors: { apiKey: ["Resend API key is required"] },
          },
        };
      }
      config = { apiKey, webhook_secret: webhookSecret || "" };
    } else if (type === "MAILGUN") {
      if (!apiKey || !domain) {
        return {
          error: {
            formErrors: [],
            fieldErrors: {
              apiKey: !apiKey ? ["Mailgun API key is required"] : undefined,
              domain: !domain ? ["Mailgun domain is required"] : undefined,
            },
          },
        };
      }

      config = {
        apiKey,
        domain,
        region: region || "US",
      };
    } else if (type === "SES") {
      if (!accessKeyId || !secretAccessKey || !region) {
        return {
          error: {
            formErrors: [],
            fieldErrors: {
              accessKeyId: !accessKeyId
                ? ["Access Key ID is required"]
                : undefined,
              secretAccessKey: !secretAccessKey
                ? ["Secret Access Key is required"]
                : undefined,
              region: !region ? ["Region is required"] : undefined,
            },
          },
        };
      }

      config = {
        accessKeyId,
        secretAccessKey,
        region,
      };
    } else if (type === "POSTMARK") {
      if (!serverToken) {
        return {
          error: {
            formErrors: [],
            fieldErrors: { serverToken: ["Postmark server token is required"] },
          },
        };
      }
      config = { serverToken, webhook_secret: webhookSecret || "" };
    } else if (type === "SMTP") {
      if (!host || !port) {
        return {
          error: {
            formErrors: [],
            fieldErrors: {
              host: !host ? ["SMTP host is required"] : undefined,
              port: !port ? ["SMTP port is required"] : undefined,
            },
          },
        };
      }

      // Username and password are both optional: an internal relay on a
      // private network commonly accepts mail from known hosts unauthenticated.
      // A username without a password is a mistake worth catching, though.
      if (username && !password) {
        return {
          error: {
            formErrors: [],
            fieldErrors: {
              password: ["Password is required when a username is set"],
            },
          },
        };
      }

      config = {
        host,
        port,
        encryption: encryption || "starttls",
        username: username || "",
        password: password || "",
      };
    }

    logger.info("Creating email provider", {
      name,
      type,
      hasDomain: !!domain,
      region: region || "US",
      userId,
    });

    const provider = await providerRepo.create({
      name,
      type: type as EmailProviderType,
      config,
      isActive: true,
      userId,
    });

    revalidatePath("/providers");

    logger.info("Email provider created successfully", {
      providerId: provider.id,
    });

    return { success: true, data: provider };
  } catch (error) {
    logger.error("Failed to create provider", {
      error: error instanceof Error ? error.message : String(error),
      name,
      type,
    });
    return {
      error: {
        formErrors: [],
        fieldErrors: { general: ["Failed to create provider"] },
      },
    };
  }
}

export async function deleteProviderAction(
  id: number,
): Promise<ActionResult<void>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    const provider = await providerRepo.findById(id);
    if (!provider || provider.userId !== userId) {
      throw new Error("Provider not found or unauthorized");
    }

    logger.debug("Deleting email provider", { providerId: id, userId });
    await providerRepo.delete(id);
    revalidatePath("/providers");
  });
}

export async function toggleProviderAction(
  id: number,
  isActive: boolean,
): Promise<ActionResult<EmailProvider>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    const provider = await providerRepo.findById(id);
    if (!provider || provider.userId !== userId) {
      throw new Error("Provider not found or unauthorized");
    }

    logger.debug("Toggling email provider status", {
      providerId: id,
      isActive,
      userId,
    });
    const updatedProvider = await providerRepo.update(id, { isActive });
    if (!updatedProvider) {
      throw new Error("Provider not found");
    }
    revalidatePath("/providers");
    return updatedProvider;
  });
}

export async function updateProviderAction(
  id: number,
  formData: FormData,
): Promise<UpdateProviderResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: { formErrors: ["Unauthorized"], fieldErrors: {} } };
  }

  const provider = await providerRepo.findById(id);
  if (!provider || provider.userId !== userId) {
    return { error: { formErrors: ["Provider not found"], fieldErrors: {} } };
  }

  const parsed = UpdateProviderSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      error: parsed.error.flatten(),
    };
  }

  const {
    name,
    type,
    apiKey,
    webhookSecret,
    domain,
    region,
    accessKeyId,
    secretAccessKey,
    serverToken,
    host,
    port,
    encryption,
    username,
    password,
  } = parsed.data;

  try {
    const updatedConfig = { ...provider.config };

    if (name) provider.name = name;
    if (type) provider.type = type as EmailProviderType;

    if (type === "RESEND" || provider.type === "RESEND") {
      if (apiKey) updatedConfig.apiKey = apiKey;
      if (webhookSecret !== undefined)
        updatedConfig.webhook_secret = webhookSecret;
    } else if (type === "MAILGUN" || provider.type === "MAILGUN") {
      if (apiKey) updatedConfig.apiKey = apiKey;
      if (domain) updatedConfig.domain = domain;
      if (region) updatedConfig.region = region;
    } else if (type === "SES" || provider.type === "SES") {
      if (accessKeyId) updatedConfig.accessKeyId = accessKeyId;
      if (secretAccessKey) updatedConfig.secretAccessKey = secretAccessKey;
      if (region) updatedConfig.region = region;
    } else if (type === "POSTMARK" || provider.type === "POSTMARK") {
      if (serverToken) updatedConfig.serverToken = serverToken;
      if (webhookSecret !== undefined)
        updatedConfig.webhook_secret = webhookSecret;
    } else if (type === "SMTP" || provider.type === "SMTP") {
      if (host) updatedConfig.host = host;
      if (port) updatedConfig.port = port;
      if (encryption) updatedConfig.encryption = encryption;
      if (username !== undefined) updatedConfig.username = username;
      // An empty password field means "leave the stored one alone", so that
      // editing the host does not silently wipe the credential.
      if (password) updatedConfig.password = password;
    }

    const updatedProvider = await providerRepo.update(id, {
      name: name || provider.name,
      type: (type as EmailProviderType) || provider.type,
      config: updatedConfig,
    });

    if (!updatedProvider) {
      throw new Error("Failed to update provider");
    }

    revalidatePath("/providers");

    logger.info("Email provider updated successfully", {
      providerId: updatedProvider.id,
    });

    return { success: true, data: updatedProvider };
  } catch (error) {
    logger.error("Failed to update provider", {
      error: error instanceof Error ? error.message : String(error),
      providerId: id,
    });
    return {
      error: {
        formErrors: [],
        fieldErrors: { general: ["Failed to update provider"] },
      },
    };
  }
}
