import { describe, it, expect, vi } from "vitest";
import { UserService, RegistrationClosedError, type PasswordHasher } from "../services/userService";
import { FormValidationError } from "../errors";
import type { User } from "../domain";
import { isApiKeyPath, isAuthPath, isPublicPath } from "../routes";

const hasher: PasswordHasher = {
  hash: async (p) => `h:${p}`,
  compare: async (p, h) => h === `h:${p}`,
};

function fakes(seed: User[] = []) {
  const rows = new Map(seed.map((u) => [u.email, u]));
  const users = {
    findByEmail: async (email: string) => rows.get(email) ?? null,
    create: vi.fn(async (d: { name: string; email: string; passwordHash: string }) => {
      const u: User = { id: "u-new", name: d.name, email: d.email, image: null, passwordHash: d.passwordHash };
      rows.set(u.email, u);
      return u;
    }),
  };
  const onUserCreated = vi.fn(async (_u: User) => {});
  const logger = { debug() {}, info() {}, warn() {}, error: vi.fn() };
  const service = new UserService(users, hasher, { onUserCreated, logger });
  return { service, users, onUserCreated, logger };
}

const alice: User = { id: "a", name: "Alice", email: "alice@x.co", image: null, passwordHash: "h:secret1" };
const open = { allowRegistration: true };
const closed = { allowRegistration: false };

describe("UserService.register", () => {
  it("refuses when registration is closed, before validating anything", async () => {
    const { service, users } = fakes();
    await expect(service.register({}, closed)).rejects.toBeInstanceOf(RegistrationClosedError);
    expect(users.create).not.toHaveBeenCalled();
  });

  it("validates the form", async () => {
    const { service } = fakes();
    const e = await service.register({ name: "A", email: "nope", password: "123" }, open).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
    expect(Object.keys(e.fieldErrors).sort()).toEqual(["email", "name", "password"]);
  });

  it("refuses a taken address as a field error", async () => {
    const { service } = fakes([alice]);
    const e = await service.register({ name: "Bob", email: "alice@x.co", password: "secret1" }, open).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
    expect(e.fieldErrors).toEqual({ email: ["Email already in use"] });
  });

  it("hashes the password, runs the after-create hook and returns no hash", async () => {
    const { service, users, onUserCreated } = fakes();
    const u = await service.register({ name: " Bob ", email: "bob@x.co", password: "secret1" }, open);
    expect(users.create).toHaveBeenCalledWith({ name: "Bob", email: "bob@x.co", passwordHash: "h:secret1" });
    expect(onUserCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "u-new" }));
    expect(u).toEqual({ id: "u-new", name: "Bob", email: "bob@x.co", image: null });
    expect(u).not.toHaveProperty("passwordHash");
  });

  it("logs, but does not fail, when the after-create hook throws", async () => {
    const { service, onUserCreated, logger } = fakes();
    onUserCreated.mockRejectedValueOnce(new Error("seed broke"));
    await expect(service.register({ name: "Bob", email: "bob@x.co", password: "secret1" }, open)).resolves.toBeTruthy();
    expect(logger.error).toHaveBeenCalledWith("Failed to set up a new account", expect.objectContaining({ error: "seed broke" }));
  });
});

describe("UserService.verifyCredentials", () => {
  it("answers null for bad shape, unknown user, no password hash, wrong password", async () => {
    const { service } = fakes([alice, { ...alice, email: "oauth@x.co", passwordHash: null }]);
    expect(await service.verifyCredentials({ email: "x", password: "secret1" })).toBeNull();
    expect(await service.verifyCredentials({ email: "nobody@x.co", password: "secret1" })).toBeNull();
    expect(await service.verifyCredentials({ email: "oauth@x.co", password: "secret1" })).toBeNull();
    expect(await service.verifyCredentials({ email: "alice@x.co", password: "wrong!" })).toBeNull();
  });

  it("returns the session user for correct credentials", async () => {
    const { service } = fakes([alice]);
    expect(await service.verifyCredentials({ email: "alice@x.co", password: "secret1" })).toEqual({
      id: "a", name: "Alice", email: "alice@x.co", image: null,
    });
  });
});

describe("UserService.mayOAuthSignIn", () => {
  it("lets everyone in while open, only existing accounts when closed", async () => {
    const { service } = fakes([alice]);
    expect(await service.mayOAuthSignIn("new@x.co", open)).toBe(true);
    expect(await service.mayOAuthSignIn("new@x.co", closed)).toBe(false);
    expect(await service.mayOAuthSignIn(null, closed)).toBe(false);
    expect(await service.mayOAuthSignIn("alice@x.co", closed)).toBe(true);
  });
});

describe("routes", () => {
  it("classifies paths", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/api-docs")).toBe(true);
    expect(isPublicPath("/api-docs/x")).toBe(false);
    expect(isPublicPath("/api/webhooks/resend")).toBe(true);
    expect(isPublicPath("/unsubscribe/abc")).toBe(true);
    expect(isPublicPath("/home")).toBe(false);
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/register")).toBe(true);
    expect(isApiKeyPath("/api/events")).toBe(true);
    expect(isApiKeyPath("/api/triggered")).toBe(true);
    expect(isApiKeyPath("/api/v1/anything")).toBe(true);
    expect(isApiKeyPath("/api/ai/generate")).toBe(false);
  });
});
