# Example of deploying ASTR token on new network
Let's take example of adding **Base network** and deploying AstarToken contract on Base

1. Add network config
```
  "base": {
    "chainId": 8453,
    ...
  },
```

2. Add type in config/types.ts
```
export enum Chains {
  ...
  base = "base",
}
```

3. Add Base to config/networks.ts
```
  [Chains.base]: {
    ...configData.base,
    url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    gasPrice: undefined,
    nonce: undefined,
    accounts,
  },
```

4. (Optionally) Add shortcut to package.json
```
"deploy:base": "hardhat deployAtNonce --network base --nonce 15 --verifycontract true"
```

5. Fund the deployer account at the Base network with enought ETH for gas
Check that deployer balance is sufficient
```
cast balance 0x448dAe9299366ff611678fdA2f3a386791C95d41 --rpc-url="https://mainnet.base.org"
```

6. Set the `PRIVATE_KEY` in `.env` to use account  `0x448dAe9299366ff611678fdA2f3a386791C95d41`

7. Compile contract
```
npx hardhat compile
```

8. Deploy ASTR contract at Base

```
npx hardhat deployAtNonce --network base --verifycontract true
```
or
```
pnpm run deploy:base
```

