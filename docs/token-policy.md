# Token Policy

THANK v1 should be conservative about payment assets.

## Recommended Policy

Start with an allowlist for production deployments.

Recommended initial assets:

```text
Native ETH
USDC
DAI
```

Arbitrary ERC-20 support is useful for local testing, but production routing should avoid assets with surprising transfer behavior.

## Risks

### Fee-On-Transfer Tokens

Fee-on-transfer tokens reduce the amount received by the router. `ThankRouter` measures the actual balance delta before allocating credits, but donors may still misunderstand the final routed amount.

### Rebasing Tokens

Rebasing tokens can change balances without transfers. They are not suitable for simple claimable-credit accounting.

### Pausable Or Blocklist Tokens

USDC and USDT-like tokens can pause or blocklist transfers. This is an operational risk, not a contract math bug. It should be disclosed for every deployment that supports those assets.

### Non-Standard Return Values

Some tokens return no boolean from `transfer` or `transferFrom`. `ThankRouter` uses low-level SafeERC20-style calls to handle those tokens.

## V1 Guidance

- Use native ETH for simple testnet demos.
- Use USDC-like stablecoins for public-goods funding demos where available.
- Do not promote support for arbitrary ERC-20s until there is an explicit allowlist contract or deployment-level policy.
- Do not support rebasing tokens in production.
- Document every supported token per deployment.
