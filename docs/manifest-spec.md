# THANK Manifest Specification

The `thank.yaml` manifest declares a project's funding address, maintainers, split policy, upstream dependencies, and verification requirements.

## Required Fields

```yaml
version: 1
project:
  name: string
  repo: owner/repository
wallets:
  primary:
    address: 0x...
    chains: [ethereum, base]
maintainers:
  - github: username
    share: 100
    wallet: 0x...
splits:
  maintainers: 80
  upstream: 19.5
  protocol: 0.5
upstream:
  - repo: owner/repository
    share: 19.5
```

## Validation Rules

- `version` must be `1`.
- `project.repo` and every upstream repo must use `owner/repo` format.
- Wallets must be EVM addresses.
- Top-level splits must total `100`.
- Maintainer shares must total `100`.
- Upstream shares must total `splits.upstream`.
- Duplicate upstream repos are rejected.
- Protocol fees above `1%` are allowed but warned against.

## Verification Levels

```text
Level 0: Unverified manifest
Level 1: GitHub repo proof
Level 2: Signed commit proof
Level 3: Domain or package-registry proof
Level 4: Multi-source verified project
```

User interfaces should always show verification status near funding destinations.
