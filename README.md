# THANK Protocol

Recursive funding for the software commons.

THANK is an open-source protocol and toolchain for funding the software, tools, and public goods that modern projects depend on. Most software funding is one-hop: a donor funds the project they can see. THANK makes funding recursive by letting projects publish a `thank.yaml` manifest, scan dependency graphs, route support to verified upstream projects, and publish transparent receipts.

THANK is experimental public-goods infrastructure. It is not an investment product. The maintainers do not promise profit, appreciation, exchange listings, liquidity, governance rights, or future tokens.

## What Is Included

- A TypeScript CLI: `thank init`, `thank validate`, `thank scan`, `thank graph`, `thank fund`, `thank badge`, and `thank verify`
- Multi-ecosystem dependency scanner for npm, PyPI, Cargo, Go modules, Composer, RubyGems, Maven, NuGet, Docker, and GitHub Actions
- Static verified project registry
- Local React dashboard over generated scan data for development demos only
- Solidity starter contracts for project registration, split registration, payment routing, symbolic receipts, and treasury custody
- Manifest spec, protocol principles, contributor policy, and security policy

## Quick Start

```bash
npm install
npm run build:cli
node dist/src/cli.js validate examples/thank.yaml
node dist/src/cli.js commit examples/thank.yaml
node dist/src/cli.js graph examples/sample-project --amount 1000 --currency USDC
```

Compile the protocol contracts:

```bash
npm run compile:contracts
```

After installing the package globally, the same commands are available as `thank`. The web dashboard exists only as a local visualization aid; it is not the protocol surface.

## Core Workflow

1. A project publishes a `thank.yaml` manifest.
2. Maintainers verify ownership through GitHub and stronger proofs over time.
3. Donors or companies scan a repository dependency tree.
4. THANK identifies dependencies with verified funding manifests.
5. A funding plan allocates support across the verified dependency graph.
6. Receipts provide transparent proof of what was funded.

## Example Manifest

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
      - base
      - optimism
      - arbitrum

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

## Principles

- No ICO
- No pre-mine
- No founder token allocation
- No price promises
- No paid hype campaign
- No referral rewards
- Open-source from day one
- Auditable contracts
- Transparent funding flows
- Maintainer-first governance

## Repository Map

```text
contracts/             Solidity starter contracts and compile output
docs/                  Manifest, CLI, scanner, and protocol documentation
examples/              Example manifest and sample project to scan
registry/              Static verified project registry
scripts/               Data generation and contract compile helpers
src/app/               React dashboard
src/lib/               Shared TypeScript protocol libraries
src/cli.ts             CLI entrypoint
tests/                 Unit tests
```

## Current Status

Phase 0/1 protocol MVP. The CLI, manifest commitments, scanner, registry, and contracts are local-first. Smart contracts are starter contracts intended for testnet experimentation after external review. Do not use these contracts with production funds until audited.
