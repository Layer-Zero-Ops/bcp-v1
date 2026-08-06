import { describe, it, expect } from "vitest";
import { initBcpCrypto } from "./crypto";
import { generateMerchantKey } from "./publish";
import { toSignable } from "./useWizard";
import { signNostr, verify } from "../../src/sign";
import { initial } from "./useWizard";
import { BCPStorefront } from "../../src/descriptor";

initBcpCrypto();

describe("BCP Store Wizard — build & sign (real crypto)", () => {
  it("generates a merchant key and signs a valid descriptor", () => {
    const { skHex, npub } = generateMerchantKey();
    const state = {
      ...initial,
      merchant: npub,
      name: "Test Store",
      items: [{ id: "x", title: "Thing", price_sats: 5000, fulfillment: "digital" as const }],
      settlement: { method: "bolt11_template" as const, node_or_lnaddress: "me@ln.dev" },
    };
    const signable = toSignable(state);
    const signed: BCPStorefront = signNostr(signable, skHex);
    expect(signed.sig).toBeTruthy();
    expect(verify(signed)).toBe(true);
  });

  it("rejects signing with a key that does not match the merchant", () => {
    const a = generateMerchantKey();
    const b = generateMerchantKey();
    const state = { ...initial, merchant: a.npub, name: "S" };
    const signed = signNostr(toSignable(state), b.skHex); // wrong key
    expect(verify(signed)).toBe(false);
  });
});
