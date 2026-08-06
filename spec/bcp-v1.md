# Bitcoin Commerce Protocol (BCP) — v1 Specification

**Status:** Draft (reference implementation pending)
**Authors:** Layer Zero Studios (steward, not owner)
**License:** MIT / CC0 — open for anyone to access and expand on.

---

## 0. Philosophy

A storefront is a signed document anyone can read. Settlement is peer-to-peer
sats over Lightning. Discovery is someone else's relay, not ours.

BCP takes the Satoshi shape:
- **No new identity system** — reuse Lightning Address / Nostr npub.
- **No money path through the protocol** — settlement binds to Lightning only.
- **No canonical index** — discovery is a client concern, pushed to the edge.
- **No token, no raise, no DAO** — the protocol is the only artifact.
- **No owner** — the spec survives its stewards by structure, not by exit.

LZS stewards BCP and may offer a paid setup service. LZS is **one of many**
doors in. The protocol runs whether LZS lives or dies.

---

## 1. The Descriptor (protocol core)

A `BCPStorefront` is one JSON document, signed by the merchant key that controls
the `merchant` identity. The SHA-256 of its canonical serialization is the
store's immutable address. No server is required for a store to exist.

See `src/descriptor.ts` for the normative TypeScript types.

Key invariants:
- Prices are **whole satoshis only**. No BTC floats, no fiat in the core. Fiat is
  a display concern resolved at invoice time by the client.
- `canonicalize()` is deterministic (key-sorted, `sig` excluded). Signing and
  verifying MUST produce identical bytes.
- The merchant key that signs MUST control the `merchant` identity
  (npub or LN wallet backend).

---

## 2. Discovery (the only unsolved part — solved minimally)

The descriptor is published as a Nostr event of kind `BCP_KIND` (provisional
`39801`). A "marketplace" is a client that subscribes to that kind on the relays
*it* chooses.

- **No canonical registry.** No approved-list. No protocol-level ranking.
- **Spam, curation, moderation are client concerns.** Pushed to the edge.
- This is the firewall that keeps the protocol from becoming the throat:
  we define the event format; we never operate the place you read it.

See `src/nostr.ts`.

---

## 3. Settlement (bind, don't build)

Payment uses Lightning. Three bindings are allowed:

| method | meaning |
|---|---|
| `bolt11_template` | BOLT11 invoice minted per order at the merchant's node / LN-address |
| `bolt12` | reusable BOLT12 offer embedded in the descriptor |
| `l402` | L402 (HTTP 402) challenge endpoint for paywalled digital goods |

Sats move **merchant ↔ customer**. The protocol never custodies, relays, or
sees the money. That separation is what keeps any steward off the money path.

See `src/settlement.ts`.

---

## 4. The Firewall (the one rule neither side crosses)

- **The protocol** defines no canonical relay, no approved-merchant list, no
  content filter. Neutrality is structural, not promised.
- **LZS** may filter in *its own client* — never in the protocol, never for others.
- Cross this line and you have built the platform BCP replaced.

---

## 5. Governance (the part Satoshi left to others)

- **BEPs** — BCP Enhancement Proposals, BIP-style, versioned.
- **Reference client** — the tie-breaker when specs are ambiguous. Code arbitrates,
  not a person.
- **No foundation required to run it.** A GitHub org may shepherd proposals; it
  holds no keys, no servers, no money. The protocol runs whether that org lives
  or dies.

---

## 6. The LZS Services Wedge (optional, separate, replaceable)

LZS may offer paid help: standing up a store, node/LSP wiring, descriptor
authoring, support. It is explicitly **not the only way** to onboard:

- An **open Store Setup wizard** is published — anyone may fork and run their own.
- If LZS closes, the wizard and docs still exist; every store keeps trading.
- LZS never custodies, never runs the canonical relay, never sees a sat.

Help, not dependency.

---

## 7. Out of scope (v1)

- Dispute resolution / chargebacks (Lightning has no native answer; deferred to BEP).
- Reputation interpretation (the protocol carries a pointer; clients interpret).
- Relay operation (explicitly not the protocol's job).
- Fiat pricing, tax, shipping logistics (merchant/client concern).
