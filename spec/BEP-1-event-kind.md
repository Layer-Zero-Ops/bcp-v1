# BEP-1: Storefront Event Kind Allocation

- Status: Draft
- Author: LZS (steward, not owner)
- Date: 2026-08-06

## Abstract
BCP publishes a storefront descriptor as a Nostr event. This BEP allocates the
canonical event kind and records why the reference client currently uses a
pragmatic deploy value.

## Background
The reference client (`wizard/`) currently publishes storefronts as Nostr kind
**30402** (NIP-99 "classified listing"). This is a deliberate, interim choice:
- 30402 is an *addressable* (parameterized-replaceable) kind, so a merchant's
  store updates in place (same `d` tag = same store address).
- Public relays reliably retain 30402; arbitrary high kinds (e.g. 39801) are
  dropped by several relays, which breaks discovery.
- 30402 carries first-class `title` / `summary` / `image` tags that clients
  already render.

The protocol core (`src/nostr.ts`) defines two constants:
- `BCP_KIND = 39801` — the *intended* dedicated BCP kind, pending Nostr
  community allocation.
- `BCP_KIND_DEPLOY = 30402` — what the reference client actually publishes
  today, so the loop works against real relays.

## Proposal
1. Ship v1 with `BCP_KIND_DEPLOY = 30402`. Clients MUST publish and discover on
   this kind for interoperability in v1.
2. Pursue a dedicated Nostr kind allocation (or a NIP-99 subclass) for BCP via
   the Nostr community. Once allocated, set `BCP_KIND` to that value and make
   `BCP_KIND_DEPLOY` follow it.
3. The `d` tag (store address = `sha256(canonicalizeSigned(descriptor))`) is the
   stable identifier regardless of kind. Kind changes never break store identity.

## Discovery rule (normative for v1)
A BCP client MUST subscribe to `BCP_KIND_DEPLOY` (30402) and filter by the
presence of a `protocol` tag equal to `"bcp/1"` so BCP stores are distinguishable
from generic NIP-99 listings. The reference client adds this tag in `toNostrEvent`.

## Backward compatibility
Because store identity is the `d` tag (not the kind), migrating to a dedicated
kind later is a drop-in change with no descriptor churn.

## Reference client role
Per `BEP-PROCESS.md`, the TypeScript reference client arbitrates ambiguous
spec points. This BEP is the tie-breaker for "which kind do we use in v1."
