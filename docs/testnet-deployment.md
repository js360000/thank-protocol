# Testnet Deployment

THANK testnet deployments use `scripts/deploy-testnet.ts`.

## Supported Networks

```text
baseSepolia
sepolia
```

Base Sepolia is the preferred first target because THANK is expected to start on an established Ethereum-compatible L2.

## Environment

Create a local `.env` or set environment variables in your shell:

```text
DEPLOY_CHAIN=baseSepolia
RPC_URL=https://...
DEPLOYER_PRIVATE_KEY=0x...
PROTOCOL_OWNER=0x...
```

`PROTOCOL_OWNER` is optional. If omitted, the deployer becomes the initial owner. For public testnets, use a multisig or a clearly documented temporary owner.

## Deploy

PowerShell:

```powershell
$env:DEPLOY_CHAIN="baseSepolia"
$env:RPC_URL="https://..."
$env:DEPLOYER_PRIVATE_KEY="0x..."
npm run deploy:testnet
```

The script deploys:

1. `ProjectRegistry`
2. `SplitRegistry`
3. `ThankRouter`
4. `ReceiptNFT`
5. `Treasury`

Output is written to:

```text
deployments/<chain>-<chainId>.json
```

Commit public deployment files after verifying source code on a block explorer.

## Pre-Deployment Checklist

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm audit`
- Confirm `evmVersion` is still `shanghai`
- Confirm owner address
- Confirm deployment wallet has enough testnet ETH
- Confirm deployment file was reviewed before commit
