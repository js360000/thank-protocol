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
- `splits.upstream` above `0` requires at least one upstream entry.
- Duplicate upstream repos are rejected.
- Duplicate maintainer GitHub handles are rejected.
- A zero-address primary wallet is allowed while drafting but warned against.
- Protocol fees above `1%` are allowed but warned against.

## Verification Levels

```text
Level 0: Not verified
Level 1: GitHub repository proof matched
Level 2: Level 1 plus signed commit proof
Level 3: Level 1 plus DNS TXT proof
Level 4: Multi-source registry review
```

User interfaces should always show verification status near funding destinations.

See [verification.md](verification.md) for the `thank verify` report format and registry-readiness checks.
