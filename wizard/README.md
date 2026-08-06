# BCP Store Setup Wizard

**Open. Forkable. Replaceable.**

A free, open-source wizard that turns a merchant into a published Bitcoin Commerce
Protocol (BCP) storefront in minutes. Author a descriptor, sign it with your own
key, publish it to Nostr relays. No platform, no approval, no LZS dependency.

> **LZS is one of many doors in — never the only one.** This repo is MIT-licensed.
> Clone it, rebrand it, run your own instance. If LZS disappears, the wizard and
> the protocol keep working. That is the point.

## What it does
1. Generates or accepts a merchant key (Nostr-style schnorr — your npub *is* your store key).
2. Authors a BCP `BCPStorefront` descriptor (items priced in sats, Lightning settlement).
3. Signs the descriptor locally — the key never leaves your browser.
4. Publishes it as a `BCP_KIND` Nostr event to the relays *you* choose.

## Run it yourself
```bash
npm install
npm run dev
```
Open http://localhost:5173. Generate a key, fill your store, sign, publish.

## Why this matters
BCP is a protocol, not a product. The storefront is a signed document; settlement is
peer-to-peer sats over Lightning; discovery is a client concern. No canonical index,
no content filter, no money path through the steward. This wizard is the optional
onboarding layer — the protocol runs with or without it.

## Fork and run your own
```bash
git clone https://github.com/Layer-Zero-Ops/bcp-v1
cd bcp-v1/wizard
# or just copy this folder and deploy to any static host
```
No backend required. Everything runs in the browser.

## Reproducing the end-to-end test (live Lightning)
The settlement test (`src/settlement.test.ts`) proves a real BOLT11 invoice is
fetched, paid, and detected as settled — against a local LNBits node using the
**FakeWallet** backend (real LNURL-pay protocol, simulated ledger, no real sats).

```bash
# 1. Start LNBits with FakeWallet (see lnbits/.env)
cd ../lnbits && PYTHONPATH= uv run uvicorn lnbits.app:create_app --factory --port 5000
# 2. One-time: create the merchant wallet + credit it (FakeWallet wallets start at 0)
curl -X PUT localhost:5000/api/v1/auth/first_install \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"x","password_repeat":"x","super_user":true}'
curl -X POST localhost:5000/api/v1/account -H 'Content-Type: application/json' \
  -d '{"name":"BCP Merchant"}'   # note the adminkey + lightning_address
# 3. Run the wizard test suite (also starts the local relay harness)
npm test
```
The test self-funds a fresh customer wallet from the merchant, then runs the
real fetch → pay → settle loop. No manual DB edits.

## License
MIT — do whatever you want, including competing with us.
