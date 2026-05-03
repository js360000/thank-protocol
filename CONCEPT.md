# THANK Protocol

**Recursive funding for the software commons.**

THANK is a concept for an open-source, crypto-native public-goods funding protocol.

Its purpose is simple:

> **Make it easy for people, companies, and projects to fund the open-source software they depend on.**

Most software funding is one-hop. A donor funds the project they can see.

THANK makes funding recursive.

When a project receives support, a configurable share can automatically flow to its upstream dependencies, maintainers, libraries, infrastructure, and public-good contributors.

This document outlines the concept, principles, architecture, adoption strategy, and launch approach for THANK.

---

## 1. One-Line Pitch

**THANK is money that automatically funds the open-source software it depends on.**

A project can publish a small funding manifest. When someone donates, sponsors, tips, or pays through the protocol, the money is automatically split between the visible project and its verified upstream dependencies.

The goal is not to create another speculative token.

The goal is to create a respected, transparent, open-source protocol for funding useful software.

---

## 2. Core Idea

Open-source software powers modern life, but many critical projects are underfunded.

A company may depend on hundreds or thousands of libraries, but only a tiny fraction of those maintainers receive meaningful support.

THANK addresses this by letting projects define funding relationships.

A simple manifest file could declare:

```yaml
project: example/library

wallets:
  main: "0xabc..."
  maintainers:
    - github: alice
      share: 60
      wallet: "0x123..."
    - github: bob
      share: 40
      wallet: "0x456..."

upstream:
  - repo: openssl/openssl
    share: 10
  - repo: curl/curl
    share: 5
  - repo: zlib-ng/zlib-ng
    share: 5

default_protocol_fee: 0.5
```

If someone funds `example/library`, the payment can be split automatically:

```text
80% -> example/library maintainers
10% -> OpenSSL
5%  -> curl
5%  -> zlib-ng
```

This creates a **dependency dividend**.

---

## 3. Why This Could Matter

Most crypto projects ask people to believe in future value.

THANK solves a current, obvious problem:

> The software commons is valuable, but its maintainers are often unpaid.

THANK gives different groups a reason to care.

### Maintainers

Maintainers receive a new funding stream without constantly asking for donations.

### Companies

Companies can support the dependencies their products rely on and publicly demonstrate responsible software stewardship.

### Donors

Donors get transparent proof that their money reached useful projects.

### Developers

Developers can add a funding manifest to their repo and join the network with minimal effort.

### Crypto Users

Crypto users get a practical, non-scammy use case: transparent public-goods funding.

---

## 4. What Makes THANK Different

THANK is not designed around speculation.

It is designed around:

- public goods
- open-source infrastructure
- dependency funding
- transparent receipts
- programmable payment splits
- simple GitHub-native adoption
- ethical launch principles

The project should avoid hype-heavy language and instead present itself as an open protocol.

The core message should be:

> **Here is a transparent, non-extractive way for software ecosystems to route money to the people and projects they depend on.**

---

## 5. Launch Principles

The protocol should be strict about ethics from day one.

### Non-Negotiables

```text
No ICO.
No pre-mine.
No founder token allocation.
No paid influencer campaign.
No price predictions.
No guaranteed returns.
No referral bonuses.
No artificial scarcity gimmicks.
No exchange-listing hype.
```

This matters because a respected crypto project should not look like a pump.

THANK should be presented as a funding protocol, not an investment product.

Suggested wording:

> THANK is an experimental open-source public-goods funding protocol. It is not an investment product. The maintainers do not promise profit, appreciation, exchange listing, or liquidity.

---

## 6. Recommended Structure

THANK should not start by launching a new blockchain.

A new chain creates a huge credibility, security, liquidity, and infrastructure burden.

The first version should be built on existing crypto rails.

### Preferred Starting Point

```text
Established L2 or Ethereum-compatible chain
ERC-20-compatible payment support
Stablecoin-compatible payment routing
Audited smart contracts
Open-source CLI
GitHub-native verification
Simple web dashboard
```

The practical objective is to make adoption easy, not to invent infrastructure for its own sake.

---

## 7. Two-Layer Model

THANK can be designed around two conceptual layers.

### A. Payment Layer

The protocol should support payments in existing crypto assets.

Examples:

```text
ETH
USDC
DAI
Other ERC-20 assets
```

This avoids forcing people to buy a new speculative coin just to participate.

### B. Receipt Layer

Each payment can create a public cryptographic receipt.

The receipt records:

```text
Donor or payer
Recipient project
Upstream dependencies funded
Amount
Timestamp
Optional message
Transaction reference
```

These receipts can be displayed on:

```text
GitHub READMEs
Project websites
Package registries
Wallets
Public dashboards
Company ESG/public-good reports
```

This gives THANK social and reputational value.

The user is not just saying:

> I bought a token.

They are saying:

> I helped fund the infrastructure I use.

---

## 8. The Killer Feature

## Fund My Dependency Tree

The strongest adoption feature is:

> **Paste a repo URL. Fund the dependency graph.**

Example:

```text
https://github.com/company/product
```

THANK scans the repo and displays:

```text
This project depends on:
- 312 npm packages
- 48 Python packages
- 12 system libraries
- 19 GitHub projects with verified funding manifests
- 7 critical projects with no funding address
```

Then the donor or company can choose:

```text
Fund all verified dependencies: $1,000
Suggested split: proportional to dependency centrality
```

This is useful, concrete, and morally compelling.

It lets companies say:

> We funded the open-source dependencies our product relies on.

That is a strong adoption hook.

---

## 9. Developer Experience

The project should be simple to adopt.

A maintainer should be able to run:

```bash
thank init
```

This creates:

```text
thank.yaml
```

A company should be able to run:

```bash
thank scan ./my-project
thank fund --amount 5000 --currency USDC
```

A project should be able to add a badge:

```md
[![Funded by THANK](https://thank.dev/badge/example/library)](https://thank.dev/example/library)
```

Example badge text:

```text
THANK funded: $12,480
Upstream funded: $3,120
Dependencies supported: 42
Last payment: 2026-05-03
```

---

## 10. Technical Architecture

A minimal implementation could have the following structure:

```text
/contracts
  ThankRouter.sol
  SplitRegistry.sol
  ReceiptNFT.sol
  ProjectRegistry.sol
  Treasury.sol

/cli
  thank scan
  thank init
  thank fund
  thank verify

/github-action
  check funding manifests
  validate thank.yaml
  detect dependency changes

/app
  project pages
  funding graph
  donor receipts
  dependency explorer
  public leaderboard

/registry
  verified GitHub repos
  wallet addresses
  maintainer claims
  dependency mappings
```

---

## 11. Smart Contract Components

### ThankRouter.sol

Routes payments to recipients and upstream dependencies.

Responsibilities:

```text
Accept supported assets
Read split information
Send funds to recipients
Emit funding events
Handle protocol fee, if any
Protect against invalid split rules
```

### SplitRegistry.sol

Stores or references project split rules.

Responsibilities:

```text
Register project funding splits
Update splits after verification
Validate total allocation percentages
Support off-chain manifests with on-chain commitments
```

### ProjectRegistry.sol

Tracks verified projects.

Responsibilities:

```text
Map GitHub repos to project IDs
Map project IDs to funding manifests
Record verification proofs
Track maintainer wallets
```

### ReceiptNFT.sol

Optional non-transferable proof-of-support receipt.

This should be non-speculative.

It could be:

```text
Soulbound
Non-transferable
Purely symbolic
Used for public proof of support
```

### Treasury.sol

Optional treasury for protocol-level public goods.

Responsibilities:

```text
Fund audits
Support infrastructure
Pay for hosting
Support grants
Pay for documentation
```

Any treasury should be transparent and conservatively governed.

---

## 12. Verification Model

To be trusted, the protocol needs to prove that a wallet really belongs to a project or maintainer.

Verification methods could include:

```text
GitHub repository ownership proof
Signed Git commit
DNS TXT record
Signed release artifact
Sigstore-style signing
GitHub Sponsors link
Open Collective link
Manual review for high-impact projects
```

A strong approach would support multiple verification levels.

Example:

```text
Level 0: Unverified manifest
Level 1: GitHub repo proof
Level 2: Signed commit proof
Level 3: Domain or package-registry proof
Level 4: Multi-source verified project
```

The UI should make verification status obvious.

---

## 13. Security and Trust

THANK should be security-first.

Recommended measures:

```text
Open-source from day one
Simple contracts
Minimal upgradeability
Independent audit before mainnet use
Public testnet deployment
Bug bounty
Clear threat model
Transparent multisig
No hidden admin powers
```

The project should avoid complicated tokenomics and unnecessary contract complexity.

Boring infrastructure is more trustworthy than flashy infrastructure.

---

## 14. Dependency Mapping

THANK should support multiple ecosystems.

Initial targets:

```text
npm
PyPI
Cargo
Go modules
Composer
RubyGems
Maven
NuGet
GitHub Actions
Docker images
```

A scanner can inspect files such as:

```text
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
pyproject.toml
requirements.txt
Cargo.toml
Cargo.lock
go.mod
composer.json
Gemfile
pom.xml
*.csproj
Dockerfile
.github/workflows/*.yml
```

The scanner should identify:

```text
Direct dependencies
Transitive dependencies
Verified funding manifests
Missing funding manifests
High-centrality dependencies
Potentially critical dependencies
Security metadata
```

---

## 15. Suggested Funding Algorithms

THANK should allow different funding strategies.

### Equal Split

Every verified dependency receives the same amount.

Simple, but not always fair.

### Direct Dependency Weighted

Direct dependencies receive more than transitive dependencies.

### Centrality Weighted

Packages that are more central to the dependency graph receive more.

### Risk Weighted

Critical packages, security-sensitive packages, or low-maintainer-count packages receive more.

### Maintainer Preference

The project being funded can define its own upstream split.

### Donor Preference

The donor can override or customize the split.

Recommended default:

```text
Project-defined split first
Then donor preference
Then protocol-suggested dependency weighting
```

---

## 16. Governance

THANK should use boring governance.

Boring governance is good.

Suggested phases:

```text
Phase 1: Maintainer multisig
Phase 2: Public advisory board
Phase 3: Nonprofit foundation or stewardship committee
Phase 4: Narrow on-chain governance for limited parameters
```

Avoid pure token voting.

Pure token voting can become plutocratic.

Governance weight could combine:

```text
Verified maintainership
Funding history
Security reputation
Community trust
Limited token voting
```

On-chain voting should be limited to narrow, well-defined protocol parameters.

---

## 17. Possible Token Model

THANK does not necessarily need a speculative token.

There are three possible models.

### Model A: No Native Token

Payments are routed using existing assets.

This is the safest and most respected starting point.

Benefits:

```text
Less legal risk
Less speculation
Less complexity
Easier trust
Easier adoption
```

### Model B: Non-Transferable Reputation Receipts

Supporters receive non-transferable receipts showing what they funded.

Benefits:

```text
Useful for reputation
No speculative market
Good for public proof
Company-friendly
```

### Model C: Native Token Later

A native token should only be considered if there is a real protocol need.

Possible uses:

```text
Fee discounts
Governance participation
Protocol staking
Anti-spam mechanisms
Treasury accounting
```

But this should not be part of the initial launch.

The respected path is:

```text
Build useful protocol first.
Earn trust.
Avoid speculative promises.
Only add token mechanics if genuinely necessary.
```

---

## 18. GitHub-Native Adoption

The project should be designed to spread through GitHub.

Useful repo assets:

```text
README badge
thank.yaml
GitHub Action
CLI installer
Example manifests
Project dashboard
Donation links
Security policy
Contributing guide
Code of conduct
```

A repo could show:

```md
## Funding

This project uses THANK Protocol to route support to maintainers and upstream dependencies.

- Maintainers receive 80%
- Upstream dependencies receive 20%
- Funding receipts are public
- No tokens, equity, or investment rights are issued
```

---

## 19. Donation Wording

Since the goal is to publish this on GitHub with donations appreciated, the donation wording should be careful and transparent.

Suggested wording:

```md
## Support

This project is free and open-source.

Donations support development, documentation, audits, hosting, and infrastructure.

GitHub Sponsors: [link]
ETH / ERC-20 donations: 0x...
Open Collective: [optional link]

Donations do not buy tokens, equity, governance power, special access, or any expectation of financial return.
```

This makes the project much cleaner.

---

## 20. README Starter

A GitHub README could begin like this:

```md
# THANK Protocol

THANK is an open-source protocol for funding the software, tools, and public goods that modern projects depend on.

Most software funding is one-hop: a donor funds the project they can see.

THANK makes funding recursive.

When a project receives support, a configurable share can automatically flow to its upstream dependencies, maintainers, libraries, infrastructure, and public-good contributors.

## Principles

- No ICO
- No pre-mine
- No founder allocation
- No price promises
- No paid hype campaign
- No referral rewards
- Open-source from day one
- Auditable contracts
- Transparent funding flows
- Maintainer-first governance

## What problem does this solve?

Open-source software powers the internet, but many critical projects are underfunded. THANK gives individuals and companies a simple way to fund the dependency graph they rely on.

## How it works

1. A project publishes a `thank.yaml` manifest.
2. Maintainers verify ownership.
3. Donors or companies send funds through the THANK Router.
4. The router splits funds between the project and its upstream dependencies.
5. Public receipts show where the money went.

## Status

Experimental. Not an investment product. Do not buy, sell, or use THANK with any expectation of profit.
```

---

## 21. Roadmap

### Phase 0: Concept Repository

Deliverables:

```text
README.md
CONCEPT.md
SECURITY.md
CONTRIBUTING.md
examples/thank.yaml
docs/manifest-spec.md
docs/protocol-principles.md
```

Goal:

```text
Make the concept understandable, respectable, and easy to discuss.
```

### Phase 1: Local CLI Prototype

Deliverables:

```text
thank init
thank scan
thank validate
thank graph
```

Goal:

```text
Scan a real repo and produce a dependency funding graph.
```

### Phase 2: Static Registry

Deliverables:

```text
Verified example projects
Manual registry file
GitHub verification proof
Simple public website
```

Goal:

```text
Show how project verification and funding manifests work.
```

### Phase 3: Testnet Contracts

Deliverables:

```text
ThankRouter testnet deployment
SplitRegistry testnet deployment
ProjectRegistry testnet deployment
Testnet funding demo
```

Goal:

```text
Route a real testnet payment through project and upstream splits.
```

### Phase 4: Public Dashboard

Deliverables:

```text
Project pages
Funding receipts
Dependency graph visualizer
Donor pages
Badge generator
```

Goal:

```text
Make the protocol visible and socially useful.
```

### Phase 5: Audit and Mainnet Beta

Deliverables:

```text
Security audit
Bug bounty
Mainnet deployment
Limited beta projects
Public report
```

Goal:

```text
Launch carefully with real projects and transparent risk disclosures.
```

---

## 22. Example CLI Commands

```bash
# Create a funding manifest
thank init

# Validate the manifest
thank validate

# Scan a project dependency tree
thank scan ./my-project

# Show fundable dependencies
thank graph ./my-project

# Fund verified dependencies
thank fund --amount 1000 --currency USDC

# Verify GitHub ownership
thank verify github
```

---

## 23. Example `thank.yaml`

```yaml
version: 1

project:
  name: example-library
  repo: example/example-library
  website: https://example.org
  description: Example open-source library using THANK Protocol.

wallets:
  primary:
    address: "0x0000000000000000000000000000000000000000"
    chains:
      - ethereum
      - optimism
      - arbitrum
      - base

maintainers:
  - github: alice
    share: 60
    wallet: "0x1111111111111111111111111111111111111111"

  - github: bob
    share: 40
    wallet: "0x2222222222222222222222222222222222222222"

splits:
  maintainers: 80
  upstream: 19.5
  protocol: 0.5

upstream:
  - repo: openssl/openssl
    share: 10

  - repo: curl/curl
    share: 5

  - repo: zlib-ng/zlib-ng
    share: 4.5

verification:
  github: required
  signed_commit: optional
  dns_txt: optional
```

---

## 24. What To Avoid

Avoid saying:

```text
This will be instantly adopted.
This will change crypto forever.
This is the next Bitcoin.
Early supporters will be rewarded.
Donations may receive future tokens.
This is guaranteed to increase in value.
```

Those phrases create legal, ethical, and reputational problems.

Use language like:

```text
This is an experiment in transparent public-goods funding.
The protocol is open.
The contracts are auditable.
The maintainers make no financial promises.
Contributions and donations are appreciated.
```

---

## 25. Why This Is a Strong GitHub Project

THANK works well as a GitHub-first launch because it can start as:

```text
A concept
A manifest spec
A CLI
A dependency scanner
A dashboard
A testnet contract demo
```

It does not need immediate token launch, exchange listing, or heavy marketing.

It can earn respect by being:

```text
Useful
Transparent
Non-extractive
Security-conscious
Maintainer-friendly
Company-friendly
Easy to try
```

A clean GitHub release could attract:

```text
Open-source maintainers
Crypto public-goods people
Developers interested in funding tools
Companies with dependency-risk concerns
Security researchers
Protocol designers
```

---

## 26. Name Ideas

The strongest name is probably:

```text
THANK
```

Full name:

```text
THANK Protocol
```

Tagline:

```text
Recursive funding for the software commons.
```

Other possible names:

```text
GRATIA
BACKPAY
UPSTREAM
COMMONS
FUND
MAINTAIN
DEPEND
SOURCEFLOW
RECURSE
```

But THANK has the clearest emotional and functional meaning.

---

## 27. Final Concept Summary

THANK is a crypto-native public-goods funding protocol for open-source software.

It lets projects publish funding manifests, verify maintainers, route payments to upstream dependencies, and issue public proof-of-support receipts.

Its strongest feature is:

> **Fund my dependency tree.**

The most respected launch path is:

```text
No ICO.
No pre-mine.
No founder allocation.
No investment promises.
Open-source from day one.
Use existing payment assets.
Build useful tooling first.
Accept donations transparently.
```

The goal is not to create a hype coin.

The goal is to create an open, auditable, practical protocol that helps money flow to the software infrastructure everyone already depends on.
