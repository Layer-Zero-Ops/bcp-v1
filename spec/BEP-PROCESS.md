# BCP Enhancement Proposals (BEP) — Process

The governance layer that survives without a single owner. Code arbitrates,
not a person.

## 1. Roles
- **Author** — anyone may propose a BEP.
- **Reference client** — the TS implementation in this repo. Its behavior is the
  tie-breaker when the spec is ambiguous.
- **Steward (LZS)** — shepherds proposals, runs CI, cuts versions. Holds no keys,
  no servers, no money. Replaceable.

## 2. BEP lifecycle
1. **Draft** — open a PR against `spec/beps/`. Use `beps/0000-template.md`.
2. **Review** — public comment window (min 14 days). Steward merges discussion
   into the doc; does not gate on opinion.
3. **Reference** — a reference-client change implementing the BEP is opened.
4. **Accepted** — merged when reference impl exists AND `version` bump is specified.
5. **Active / Obsolete** — tracked in the BEP index.

## 3. Versioning
- `BCP_VERSION` (currently `1`) bumps ONLY on breaking descriptor changes.
- Additive fields (e.g. new `settlement.method`) are backward-compatible and need
  no version bump — clients ignore unknown fields.
- Ambiguity resolves to the reference client's behavior. That is intentional:
  running code, not committee, settles disputes.

## 4. The firewall in process
No BEP may: introduce a canonical relay, an approved-merchant list, a content
filter, or any money-path role for the steward. Such proposals are out of scope
by charter and MUST be rejected.

## 5. Event kind assignment
Nostr event kinds are assigned via BEP. `39801` is provisional for v1; a BEP
formalizes the allocation.
