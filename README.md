# Bitcoin Commerce Protocol (BCP) — v1

**Open. No-owner. Lightning-settled. Nostr-discovered.**

BCP is a protocol for uncensored, peer-to-peer commerce. A storefront is a
**signed, portable descriptor**; payment is **peer-to-peer sats over Lightning**;
discovery is a **client concern** (read signed events from relays you choose).
There is no canonical index, no content filter, and no money path through any
steward. The steward (LZS) is one door in — never the only one.

> This repo is MIT-licensed. Clone it, fork it, rebrand it, run your own instance.
> If the steward vanishes, the protocol keeps working. That is the design.

## Layout
- `src/` — the protocol core (crypto-agnostic, framework-free)
  - `descriptor.ts` — `BCPStorefront` type + deterministic `canonicalize()`
  - `sign.ts` — merchant signs/verifies (injects real schnorr crypto)
  - `nostr.ts` — storefront event binding (NIP-99 kind 30402), hash = store address
  - `settlement.ts` — binds to Lightning (LNURL-pay / BOLT12 / L402); never touches sats
- `spec/` — human-readable protocol + governance
  - `bcp-v1.md` — the spec
  - `BEP-PROCESS.md` — Bitcoin Enhancement Proposals; reference client arbitrates ambiguity
- `wizard/` — the open reference client (Vite + React + TS)
  - merchant wizard: generate key → author store → sign → publish to relays
  - marketplace: discover stores → fetch real Lightning invoice → detect settlement
  - `src/lightning.ts` — real LNURL-pay adapter (fetch invoice, poll settlement)
  - `src/settlement.test.ts` — **live** settlement test against a local LNBits node

## Principles (the firewall)
1. **Protocol neutral.** No canonical index, no filter, no money path. The steward
   may filter *its own client* only — never the protocol.
2. **Steward is replaceable.** The wizard is forkable; LZS offers optional paid
   onboarding but is never the sole path in.
3. **Bind, don't rebuild.** Lightning, L402, Nostr already exist. BCP composes them.
4. **Keys stay with the merchant.** Signing happens client-side; the protocol never
   sees a private key.

## Quick start
```bash
# protocol core
cd src && npm install && npm run typecheck && npm test

# reference client (wizard + marketplace)
cd wizard && npm install && npm run typecheck && npm test && npm run build
```
Open the wizard at http://localhost:5173.

## Proving the money loop (live Lightning)
The settlement test fetches a **real BOLT11** from a merchant's LNURL-pay backend,
pays it through a local LNBits (FakeWallet) node, and detects settlement by polling.
FakeWallet = real protocol, simulated ledger, no real sats. See `wizard/README.md`.

## Governance
Changes go through **BEPs** (Bitcoin Enhancement Proposals). The TypeScript
reference client is the tie-breaker for ambiguous specs — but anyone can fork it.
No foundation is required to run the protocol.

## License
MIT — do whatever you want, including competing with us.
