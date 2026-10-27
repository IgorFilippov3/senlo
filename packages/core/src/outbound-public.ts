// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { OutboundDecision, OutboundPolicy, OutboundTarget } from "./outbound";

export type AddressLookup = (host: string) => Promise<string[]>;

const defaultLookup: AddressLookup = async (host) =>
  (await dnsLookup(host, { all: true, verbatim: true })).map((a) => a.address);

/**
 * Allows only hosts whose every address is on the public internet. A
 * literal IP is checked as is; a name is resolved and every answer must
 * pass (one private answer among public ones is the rebinding trick).
 * `localhost` and the `.localhost` / `.internal` / `.local` suffixes are
 * refused by name, so they need no lookup. A name that does not resolve is
 * refused too: the connection would fail anyway, and "no" is the safe
 * reading.
 */
export function publicInternetOnly({ lookup = defaultLookup }: { lookup?: AddressLookup } = {}): OutboundPolicy {
  return {
    async allow(target: OutboundTarget): Promise<OutboundDecision> {
      const host = stripBrackets(target.host.trim().toLowerCase());
      if (!host) return { allowed: false, reason: "no host" };
      if (isLocalName(host)) return { allowed: false, reason: `${host} is a local name` };

      if (isIP(host)) {
        return isPublicAddress(host) ? { allowed: true } : { allowed: false, reason: `${host} is not a public address` };
      }

      let addresses: string[];
      try {
        addresses = await lookup(host);
      } catch {
        return { allowed: false, reason: `${host} does not resolve` };
      }
      if (addresses.length === 0) return { allowed: false, reason: `${host} does not resolve` };
      const bad = addresses.find((a) => !isPublicAddress(a));
      return bad ? { allowed: false, reason: `${host} resolves to ${bad}, not a public address` } : { allowed: true };
    },
  };
}

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function isLocalName(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    !host.includes(".")
  );
}

/** True for a routable, public unicast address; false for everything a tenant must not reach. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicV4(address);
  if (family === 6) return isPublicV6(address);
  return false;
}

function isPublicV4(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return false; // this network, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT 100.64/10
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // private 172.16/12
  if (a === 192 && b === 168) return false; // private
  if (a === 192 && b === 0) return false; // 192.0.0.0/24 and 192.0.2.0/24 (IETF, TEST-NET-1)
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51) return false; // TEST-NET-2 (198.51.100/24, whole /16 is fine to refuse)
  if (a === 203 && b === 0) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

function isPublicV6(address: string): boolean {
  const lower = address.toLowerCase();
  // IPv4-mapped (::ffff:1.2.3.4) and NAT64 (64:ff9b::1.2.3.4), dotted or
  // as two hex groups (::ffff:7f00:1): judge the IPv4 inside.
  const mapped = lower.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicV4(mapped[1]);
  const mappedHex = lower.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPublicV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (lower === "::" || lower === "::1") return false; // unspecified, loopback
  const first = parseInt(lower.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((first & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((first & 0xff00) === 0xff00) return false; // multicast
  if (lower.startsWith("2001:db8:")) return false; // documentation
  return true;
}
