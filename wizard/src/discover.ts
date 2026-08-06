/**
 * BCP discovery (client side) — subscribe to BCP_KIND and read stores.
 *
 * Discovery is a CLIENT concern. This module is the reference implementation of
 * "a marketplace": point it at relays, get back verified storefronts. It trusts
 * no relay — every descriptor is re-verified against the merchant key before
 * being returned. Ranking, filtering, and curation are left to the caller.
 */
import { SimplePool } from "nostr-tools/pool";
import { verify } from "../../src/sign";
import { BCPStorefront } from "../../src/descriptor";
import { BCP_KIND_DEPLOY } from "../../src/nostr";

export interface DiscoveredStore {
  store: BCPStorefront;
}

/**
 * Fetch all valid BCP storefronts from the given relays.
 * Returns only descriptors that pass cryptographic verification.
 */
export async function discoverStores(
  relays: string[],
  opts: { maxWait?: number } = {},
): Promise<DiscoveredStore[]> {
  const pool = new SimplePool();
  const maxWait = opts.maxWait ?? 4000;

  const events = await pool.querySync(relays, { kinds: [BCP_KIND_DEPLOY] }, { maxWait });
  const byMerchant = new Map<string, DiscoveredStore>();

  for (const ev of events) {
    try {
      // BEP-1: only treat events tagged protocol:"bcp/1" as BCP storefronts,
      // so generic NIP-99 listings are ignored.
      const isBcp = ev.tags.some((t) => t[0] === "protocol" && t[1] === "bcp/1");
      if (!isBcp) continue;
      const store = JSON.parse(ev.content) as BCPStorefront;
      if (!verify(store)) continue; // relay cannot lie about a store's contents
      byMerchant.set(store.merchant, { store });
    } catch {
      // malformed event — ignore
    }
  }

  pool.close(relays);
  return [...byMerchant.values()];
}
