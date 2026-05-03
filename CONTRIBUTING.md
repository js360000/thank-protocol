# Contributing

THANK is built as public-goods infrastructure. Contributions should make the protocol simpler, safer, easier to verify, or easier for maintainers to adopt.

## Development

```bash
npm install
npm run test
npm run build
```

Use focused pull requests. Include tests for scanner, manifest, graph, CLI, or contract behavior when changing those areas.

## Design Constraints

- Keep protocol language non-speculative.
- Do not add token promises, price language, referral mechanics, or artificial scarcity.
- Prefer boring, auditable infrastructure over clever mechanisms.
- Verification status must be explicit in user-facing output.
- Any onchain change must be reviewed with a threat model.

## Commit Scope

Good changes are usually small and easy to reason about:

- Add support for a new dependency file parser.
- Improve manifest validation.
- Strengthen registry verification metadata.
- Add test coverage around funding-plan math.
- Improve dashboard accessibility or data clarity.

Large governance, token, treasury, or upgradeability changes need a design document before implementation.
