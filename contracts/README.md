# THANK Contracts

These contracts are starter contracts for testnet experimentation:

- `ProjectRegistry.sol`: maps project IDs to repository metadata and controllers.
- `SplitRegistry.sol`: stores recipient split rules in basis points.
- `ThankRouter.sol`: queues native ETH or ERC-20 claimable credits according to registered splits.
- `ReceiptNFT.sol`: mints symbolic non-transferable support receipts.
- `Treasury.sol`: receives protocol funds and allows owner withdrawals.

They are intentionally small and dependency-free. They have not been audited and must not be used with production funds.

The router uses a pull-claim model: funding transactions credit recipients, and recipients claim later. This avoids letting one reverting recipient block the entire donation route.

Compile locally:

```bash
npm run compile:contracts
```
