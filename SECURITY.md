# Security Policy

THANK handles funding metadata and, in later phases, payment routing. Security expectations are intentionally conservative.

## Supported Status

This repository is an experimental MVP. The TypeScript CLI and dashboard are suitable for local experimentation. The Solidity contracts are starter contracts and must be independently audited before any mainnet use.

## Reporting Issues

Please report security issues privately to the maintainers before public disclosure. Include:

- Affected component
- Reproduction steps
- Expected impact
- Suggested mitigation, if known

## Threat Model Areas

- Incorrect wallet or maintainer verification
- Malicious or compromised funding manifests
- Split math errors
- Dependency confusion or ecosystem parser mistakes
- Registry poisoning
- Reentrancy or failed payment routing
- Admin key compromise
- Misleading receipts or transaction references

## Non-Negotiables

- No hidden admin powers
- No unaudited production fund routing
- No speculative token promises
- No opaque treasury behavior
- No silent registry edits for high-impact projects
