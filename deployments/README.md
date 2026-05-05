# Deployments

Deployment JSON files produced by `npm run deploy:testnet` should be committed after a public testnet deployment.

The deployment script writes:

```text
deployments/<chain>-<chainId>.json
```

Each file records deployed addresses, transaction hashes, constructor arguments, deployer, protocol owner, compiler target, and timestamp.

Do not commit private keys, RPC secrets, or local `.env` files.
