import { describe, expect, it, vi, afterEach } from "vitest";
import { allowAllOutbound, assertOutbound, fetchWithPolicy, OutboundRefusedError, type OutboundPolicy } from "../outbound";
import { isPublicAddress, publicInternetOnly } from "../outbound-public";

describe("publicInternetOnly", () => {
  const policy = publicInternetOnly({
    lookup: async (host) => {
      if (host === "api.example.com") return ["93.184.216.34"];
      if (host === "rebind.example.com") return ["93.184.216.34", "10.0.0.5"];
      if (host === "v6.example.com") return ["2606:2800:220:1:248:1893:25c8:1946"];
      throw new Error("ENOTFOUND");
    },
  });

  it("allows public names and addresses", async () => {
    await expect(policy.allow({ host: "api.example.com", port: 443 })).resolves.toEqual({ allowed: true });
    await expect(policy.allow({ host: "v6.example.com" })).resolves.toEqual({ allowed: true });
    await expect(policy.allow({ host: "8.8.8.8" })).resolves.toEqual({ allowed: true });
  });

  it("refuses local names, private and metadata addresses, and a name with one private answer", async () => {
    for (const host of ["localhost", "redis", "db.internal", "printer.local", "127.0.0.1", "10.1.2.3", "172.20.0.2", "192.168.1.1", "169.254.169.254", "100.70.0.1", "0.0.0.0", "::1", "[::1]", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "rebind.example.com", "nope.example.com"]) {
      const decision = await policy.allow({ host });
      expect(decision.allowed, host).toBe(false);
    }
  });

  it("judges addresses", () => {
    expect(isPublicAddress("1.1.1.1")).toBe(true);
    expect(isPublicAddress("2001:4860:4860::8888")).toBe(true);
    expect(isPublicAddress("2001:db8::1")).toBe(false);
    expect(isPublicAddress("64:ff9b::7f00:1")).toBe(false);
    expect(isPublicAddress("not an ip")).toBe(false);
  });
});

describe("fetchWithPolicy", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
  });

  const refuseMetadata: OutboundPolicy = {
    async allow({ host }) {
      return host === "169.254.169.254" ? { allowed: false, reason: "metadata" } : { allowed: true };
    },
  };

  it("checks every hop of a redirect chain", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url === "https://api.example.com/hook") {
        return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
      }
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    await expect(fetchWithPolicy("https://api.example.com/hook", { method: "POST" }, refuseMetadata)).rejects.toThrow(OutboundRefusedError);
    expect(calls).toEqual(["https://api.example.com/hook"]);
  });

  it("follows an allowed redirect and refuses other schemes", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "https://api.example.com/old") return new Response(null, { status: 301, headers: { location: "/new" } });
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const response = await fetchWithPolicy("https://api.example.com/old", { method: "POST" }, refuseMetadata);
    expect(response.status).toBe(200);
    await expect(fetchWithPolicy("ftp://api.example.com/x", {}, allowAllOutbound)).rejects.toThrow(/Only http and https/);
    await expect(fetchWithPolicy("file:///etc/passwd", {}, allowAllOutbound)).rejects.toThrow(/Only http and https/);
  });

  it("assertOutbound names the target in the refusal", async () => {
    await expect(assertOutbound(refuseMetadata, { host: "169.254.169.254", port: 80 })).rejects.toThrow(
      "Connection to 169.254.169.254:80 refused: metadata",
    );
  });
});
