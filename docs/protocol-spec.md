# THANK Protocol Specification

This document defines the MVP protocol surface. It intentionally avoids a native token and focuses on manifests, verification, split rules, payment routing, and receipts.

## Identifiers

THANK v1 uses deterministic offchain identifiers.

```text
normalizedRepo = lowercase(trim(owner/repo))
projectId = sha256("thank:v1:project:" + normalizedRepo)
manifestHash = sha256(canonicalManifestJson + "\n")
```

`thank commit thank.yaml` prints both values. The onchain registry stores these as `bytes32` values and does not need to parse YAML.

## Manifest Commitment

The canonical manifest is JSON with object keys sorted recursively and `undefined` values omitted. Array order remains significant because maintainer and upstream order can reflect governance intent.

The registry stores:

- `projectId`
- `repo`
- `manifestUri`
- `manifestHash`
- `controller`
- `verificationLevel`

The manifest URI points to the human-readable source, usually a GitHub blob or immutable release artifact. The hash proves which exact manifest was verified.

## Verification Levels

```text
Level 0: Not verified
Level 1: GitHub repository proof matched
Level 2: Level 1 plus signed commit proof
Level 3: Level 1 plus DNS TXT proof
Level 4: Multi-source registry review
```

The CLI-side readiness report is defined in [verification.md](verification.md). Public registries should store the full check set and proof metadata, not only the numeric `verificationLevel`.

Only verified projects should receive automatic protocol-routed funds. Unverified dependencies can still be surfaced as missing funding metadata.

## Split Rules

`SplitRegistry` stores project recipients in basis points. It is backed by `ProjectRegistry`; split updates are only valid for active projects whose verification level is greater than zero.

Protocol invariants:

- `projectId != 0`
- project must be active in `ProjectRegistry`
- project must have `verificationLevel > 0`
- recipient count is between `1` and `64`
- each recipient is nonzero
- each recipient has nonzero basis points
- recipients cannot be duplicated
- total basis points must equal `10_000`

The project owner or the controller recorded in `ProjectRegistry` can update splits. There is no second controller map in `SplitRegistry`, so split authorization cannot drift from project verification metadata.

## Funding Destination Semantics

Offchain funding plans aggregate by verified upstream project, not package name. If a scanned app depends on both `react` and `react-dom`, and both resolve to `facebook/react`, the plan creates one allocation to `facebook/react` with combined weight.

This avoids accidental duplicate payments to one project and makes the unit of funding match the unit of verification.

## Router Model

`ThankRouter` uses claimable credits rather than direct push payments.

Funding flow:

1. Donor funds a `projectId` with native ETH or an ERC-20 token.
2. Router reads splits from `SplitRegistry`.
3. Router records credits for each recipient.
4. Recipients claim credits with `claimNative`, `claimNativeFor`, `claimToken`, or `claimTokenFor`.
5. Funding and allocation events provide the public receipt trail.

This avoids a failure mode where one reverting recipient blocks the entire funding transaction.

## EVM Target

THANK v1 starter contracts are compiled with `evmVersion: "shanghai"`. The target is explicit so CI and testnet bytecode do not silently pick up newer opcodes that are unsupported on a selected L2 or test VM.

Changing the EVM target requires rerunning router behavior tests against the intended chain hardfork.

## Token Rules

The router uses low-level SafeERC20-style calls for non-standard tokens that return no boolean. For token funding, it measures actual tokens received by comparing router balances before and after `transferFrom`.

MVP restrictions:

- Prefer plain ERC-20s such as USDC and DAI.
- Avoid rebasing tokens.
- Avoid fee-on-transfer tokens for production deployments.
- Avoid assets with blocklist or pause risk unless that operational risk is disclosed.

See [token-policy.md](token-policy.md) for the recommended production allowlist approach.

## Receipt Layer

Receipts are event-first in the MVP:

- `NativeFundingQueued`
- `TokenFundingQueued`
- `AllocationQueued`
- `NativeClaimed`
- `TokenClaimed`

`receiptUri` can point to an offchain JSON receipt. `ReceiptNFT` remains optional and non-transferable for symbolic proof of support.

## Non-Goals

- No ICO
- No pre-mine
- No native token launch
- No speculative receipt market
- No automatic package-registry trust without verification
- No upgradeable production contracts until there is a reviewed upgrade policy
