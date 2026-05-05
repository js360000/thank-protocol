# CLI

The CLI is available through `node dist/src/cli.js` after `npm run build:cli`, or as `thank` when installed from the package.

## Commands

```bash
thank init
thank validate [manifest]
thank scan [project]
thank graph [project] --amount 1000 --currency USDC
thank fund [project] --amount 1000 --receipt receipts/thank-receipt.json
thank badge [manifest]
thank commit [manifest]
thank verify [manifest]
thank verify [manifest] --repo-url https://github.com/owner/repo.git --dns --json
```

## Funding Strategies

- `equal`: every verified dependency receives the same amount.
- `direct-weighted`: runtime and direct dependencies receive more than transitive dependencies.
- `centrality`: weights directness, number of detected sources, and verification level.

`thank fund` creates an offline receipt and funding plan. It does not execute an onchain payment. Onchain routing belongs to the testnet contract phase after review and deployment configuration.

## Commitments

`thank commit` prints the deterministic protocol identifiers for a manifest:

- `projectId`
- `manifestHash`
- canonical manifest JSON when `--json` is used

These values are used by `ProjectRegistry` for testnet registration.

## Verification Reports

`thank verify` is the maintainer credibility check. It returns non-zero when a manifest is not ready for registry inclusion.

The report covers:

- Manifest validation.
- GitHub repository proof from the local `origin` remote or `--repo-url`.
- `verification.github: required`.
- Zero-address payout values.
- Maintainer identity hygiene.
- Upstream funding configuration.
- Optional signed commit proof with `--signed-commit`.
- Optional DNS TXT proof with `--dns`.

Use `--json` in CI or registry ingestion:

```bash
thank verify thank.yaml --repo-url "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY.git" --json
```

See [verification.md](verification.md) for the trust model and DNS proof format.
