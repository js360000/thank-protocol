# Verification

THANK is only useful if donors can see why a funding destination is credible. `thank verify` produces a local trust report for maintainers before a project is added to a public registry or shown as fundable.

```bash
thank verify thank.yaml
thank verify thank.yaml --repo-url https://github.com/owner/repo.git
thank verify thank.yaml --signed-commit
thank verify thank.yaml --dns
thank verify thank.yaml --json
```

## Registry-Ready Checks

The command checks:

- Manifest schema and split accounting.
- `verification.github: required`.
- Local `origin` or `--repo-url` matches `project.repo`.
- Primary payout wallet is not the zero address.
- Maintainer payout wallets are not zero addresses.
- Maintainer GitHub handles are unique.
- Upstream split has upstream projects when `splits.upstream` is above `0`.
- Signed commit proof when required or requested.
- DNS TXT proof when required or requested.

Required failures make the report non-registry-ready and return a non-zero exit code.

## Verification Levels

```text
Level 0: Not verified.
Level 1: GitHub repository proof matched.
Level 2: Level 1 plus signed commit proof.
Level 3: Level 1 plus DNS TXT proof.
```

Level 4 is reserved for multi-source registry review. Local CLI verification does not mint Level 4 status.

## DNS TXT Proof

If `project.website` is `https://example.org`, publish this TXT record:

```text
_thank.example.org TXT "thank:v1 repo=owner/repo manifest=0x... wallet=0x..."
```

The manifest hash must match `thank commit thank.yaml`, and the wallet must match `wallets.primary.address`.

Run:

```bash
thank verify thank.yaml --dns
```

If DNS proof is optional, a missing TXT record is a warning. If `verification.dns_txt: required`, a missing or mismatched TXT record is a failure.

## Signed Commit Proof

Signed commit verification uses Git's own verification path:

```bash
git verify-commit HEAD
thank verify thank.yaml --signed-commit
```

If `verification.signed_commit: required`, the CLI checks the configured commit ref even without `--signed-commit`.

## JSON Output

`--json` emits a stable report for CI and registry review:

```json
{
  "manifest": {
    "repo": "owner/repo"
  },
  "projectId": "0x...",
  "manifestHash": "0x...",
  "level": 1,
  "readyForRegistry": true,
  "checks": [],
  "nextActions": []
}
```

Public registries should store the full check set, not just the level.
