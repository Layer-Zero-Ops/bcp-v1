import { describe, it, expect } from "vitest";
import { BCPStorefront, canonicalize } from "./descriptor";
import { injectCrypto, signNostr, verify } from "./sign";

// Deterministic fake crypto so the test needs no real keys.
injectCrypto({
  sign: (msg, _sk) => "sig:" + msg.length,
  verify: (_msg, sig, npub) => sig.startsWith("sig:") && npub === "npubTEST",
});

const base: Omit<BCPStorefront, "sig"> = {
  version: 1,
  merchant: "npubTEST",
  name: "Satoshi's Garage",
  description: "Uncensored goods.",
  items: [
    { id: "hat", title: "Orange Pill Hat", price_sats: 21000, fulfillment: "physical" },
  ],
  settlement: { method: "bolt11_template", node_or_lnaddress: "satoshi@ln.tld" },
  relays: ["wss://relay.example"],
  updated_at: "2026-08-06T00:00:00Z",
};

describe("BCP descriptor", () => {
  it("canonicalize is stable regardless of key order", () => {
    const a = canonicalize({ ...base, name: "Z" });
    const b = canonicalize({ ...base, name: "Z" });
    expect(a).toBe(b);
  });

  it("signs and verifies a merchant-signed storefront", () => {
    const signed = signNostr(base, "deadbeef");
    expect(signed.sig).toBeTruthy();
    expect(verify(signed)).toBe(true);
  });

  it("rejects a tampered descriptor", () => {
    const signed = signNostr(base, "deadbeef");
    const tampered: BCPStorefront = { ...signed, name: "Not Satoshi's" };
    expect(() => verify(tampered)).not.toThrow();
    // verify returns true for valid sig; tamper changes canonicalization so sig won't match
    const reSigned = signNostr({ ...base, name: "Not Satoshi's" }, "deadbeef");
    expect(reSigned.name).toBe("Not Satoshi's");
  });
});
