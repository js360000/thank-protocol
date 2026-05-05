# Threat Model

THANK routes funds to verified open-source funding destinations. The main risk is not market loss; it is misrouting money through bad verification, bad splits, compromised controllers, or unsafe token behavior.

## Assets At Risk

- Donor funds sent to the router
- Recipient claimable credits
- Project verification metadata
- Maintainer split rules
- Public receipt integrity
- Registry credibility

## Trust Boundaries

```text
Local scanner -> Static registry -> Manifest commitment -> Project registry -> Split registry -> Router
```

The scanner is advisory. The registry and manifest commitment decide whether a dependency is fundable. The router only trusts onchain splits.

## Primary Threats

### Malicious Manifest

A project can publish a manifest that points upstream funding to unrelated wallets.

Mitigations:

- Show verification level at every funding destination.
- Run `thank verify` before registry inclusion.
- Hash the exact verified manifest.
- Store the full verification report, not only the numeric level.
- Require stronger verification for high-impact projects.
- Keep registry review auditable.

### Registry Poisoning

An attacker adds or edits registry metadata for a popular dependency.

Mitigations:

- Signed registry releases.
- Review requirements for high-impact projects.
- Public diffs for registry changes.
- Onchain `manifestHash` history through events.

### Compromised Controller

A project controller changes splits to an attacker wallet.

Mitigations:

- Encourage multisig controllers.
- Emit `SplitsSet` events.
- Read split authority from `ProjectRegistry` so controller metadata cannot drift across registries.
- Add dashboard and CLI warnings for recent split changes before mainnet beta.
- Use time delays for future production governance.

### Duplicate Funding Destination

Multiple package names can resolve to the same upstream project.

Mitigation:

- Funding plans aggregate by verified repo before creating allocations.

### Reverting Recipient

A recipient contract can reject native ETH and block payment routing.

Mitigation:

- Router uses claimable credits. Funding does not call recipient contracts.

### Non-Standard ERC-20

Some tokens do not return booleans, charge transfer fees, rebase, pause, or blocklist addresses.

Mitigations:

- SafeERC20-style low-level calls.
- Balance-delta accounting for inbound transfers.
- Restrict recommended assets for production.
- Disclose token-specific operational risk.

### Rounding Error

Basis-point math can leave dust.

Mitigation:

- Last recipient receives the remainder.
- Split totals must equal `10_000`.

### Reentrancy

Recipient or token callbacks can reenter claim or funding functions.

Mitigations:

- Router uses a reentrancy guard.
- Claims zero credits before external calls.
- Failed native claims restore credit and revert.

## Current Residual Risks

- Contracts are not audited.
- Testnet deployment tooling exists, but there is no live deployment record or multisig policy yet.
- Registry signing is not implemented.
- No onchain timelock exists for split changes.
- Fee-on-transfer and rebasing tokens remain unsuitable for production support.

## Pre-Testnet Gate

- Add Foundry or Hardhat tests for authorization, split math, claims, and token edge cases.
- Execute and publish one testnet deployment.
- Write a controller rotation policy.
- Generate verified source artifacts.
- Run Slither and resolve high-confidence findings.
