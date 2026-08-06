import { describe, it, expect } from "vitest";
import { initBcpCrypto } from "./crypto";
import { generateMerchantKey, publishStorefront } from "./publish";
import { discoverStores } from "./discover";
import { toSignable, initial } from "./useWizard";
import { signNostr, verify } from "../../src/sign";
import { BCPStorefront } from "../../src/descriptor";
import { BCP_KIND_DEPLOY } from "../../src/nostr";

// Live testnet-style integration: publish to a REAL public relay, read back.
// Uses fake-lightning settlement (no real node needed) — proves the
// publish -> discover -> verify loop against real Nostr infrastructure.
const RELAYS = [process.env.RELAY_URL ?? "ws://localhost:3337"];

initBcpCrypto();

describe("BCP live relay loop (integration)", () => {
  it("publishes a store and rediscovers it from a public relay", async () => {
    const { skHex, npub } = generateMerchantKey();
    const state = {
      ...initial,
      merchant: npub,
      name: "LZS Test Store " + Date.now(),
      description: "Integration test storefront.",
      items: [{ id: "hat", title: "Orange Pill Hat", price_sats: 21000, fulfillment: "physical" as const }],
      settlement: { method: "bolt11_template" as const, node_or_lnaddress: "test@ln.dev" },
      relays: RELAYS,
    };

    const signed: BCPStorefront = signNostr(toSignable(state), skHex);
    expect(verify(signed)).toBe(true);

    const pub = await publishStorefront(signed, skHex);
    expect(pub.relaysPublished.length).toBeGreaterThan(0);
    console.log("Published event:", pub.eventId);

    // Give the relay a moment to index, then discover.
    await new Promise((r) => setTimeout(r, 3000));
    const found = await discoverStores(RELAYS, { maxWait: 8000 });
    console.log("discovered (verified):", found.length);

    // Diagnose: raw query by author to see if event is on relay at all
    const { SimplePool } = await import("nostr-tools/pool");
    const pool2 = new SimplePool();
    const raw = await pool2.querySync(RELAYS, { authors: [npub], kinds: [BCP_KIND_DEPLOY] }, { maxWait: 8000 });
    console.log("raw by-author:", raw.length);
    for (const ev of raw) {
      try {
        const st = JSON.parse(ev.content) as BCPStorefront;
        console.log("  raw name:", st.name, "| verified:", verify(st), "| merchantMatch:", st.merchant === npub);
      } catch (e) {
        console.log("  parse err:", String(e).slice(0, 60));
      }
    }
    pool2.close(RELAYS);

    const match = found.find((f) => f.store.merchant === npub);

    expect(match, "store should be rediscovered from relay").toBeDefined();
    expect(match!.store.name).toBe(state.name);
    expect(match!.store.items[0].price_sats).toBe(21000);
  }, 20000);
});
