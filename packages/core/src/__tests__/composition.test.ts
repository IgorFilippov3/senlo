import { describe, it, expect } from "vitest";
import { createServices, type Repositories } from "../composition";
import { TriggerService } from "../services/triggerService";
import { AutomationService } from "../services/automationService";

// Services only store their dependencies when built, so empty stand-ins are
// enough to check the wiring.
const repositories = new Proxy({}, { get: () => ({}) }) as unknown as Repositories;
const queues = { email: {}, automation: {} } as any;
const settings = {
  appUrl: "https://mail.example.com",
  linkSigningSecret: "s",
  defaultFromEmail: "hello@example.com",
};

describe("createServices", () => {
  it("builds every service", () => {
    const services = createServices({ repositories, queues, settings });
    expect(Object.keys(services).sort()).toEqual(
      ["audience", "auth", "automation", "campaign", "project", "settings", "template", "tracking", "trigger"],
    );
    expect(services.trigger).toBeInstanceOf(TriggerService);
    expect(services.automation).toBeInstanceOf(AutomationService);
  });

  it("gives automation and audience the same trigger and automation instances", () => {
    const services = createServices({ repositories, queues, settings });
    expect((services.automation as any).triggerService).toBe(services.trigger);
    expect((services.audience as any).automationService).toBe(services.automation);
  });
});
