
import { task, types } from "hardhat/config";
import {
  Chains,
  networks,
  logger,
  TokenPoolContractName,
  PoolType,
  TokenContractName,
  ProxyContractName
} from "../config";
import { getContractVerification } from "../utils";

interface DeployTokenPoolTaskArgs {
  verifycontract: boolean;
  pooltype: string; // 'burnMint' or 'lockRelease'
  acceptliquidity?: boolean; // Optional, defaults to false
}

// Task to deploy a Token Pool (BurnMintTokenPool or LockReleaseTokenPool) and a token with proxy
task("deployAstarTokenAndPool", "Deploys a token pool and token with proxy")
  .addOptionalParam(
    "verifycontract",
    "Verify the contract on Blockchain scan",
    false,
    types.boolean
  )
  .addOptionalParam(
    "pooltype",
    "Type of the pool (burnMint or lockRelease)",
    "burnMint",
    types.string
  )
  .addOptionalParam(
    "acceptliquidity",
    "Accept liquidity (only for lockRelease pool)",
    false,
    types.boolean
  )
  .setAction(async (taskArgs: DeployTokenPoolTaskArgs, hre) => {
    const {
      verifycontract: verifyContract,
      pooltype: poolType,
      acceptliquidity: acceptLiquidity,
    } = taskArgs;
    const networkName = hre.network.name as Chains;

    // Ensure the network is configured
    const networkConfig = networks[networkName];
    if (!networkConfig) {
      throw new Error(`Network ${networkName} not found in config`);
    }

    // Extract router and RMN proxy from the network config
    const { router, rmnProxy, confirmations } = networkConfig;
    if (!router || !rmnProxy) {
      throw new Error(`Router or RMN Proxy not defined for ${networkName}`);
    }

    // Get the signer and signer address
    const signer = (await hre.ethers.getSigners())[0];
    const signerAddress = await signer.getAddress();

    try {
      // Load the contract factory for the token contract
      const TokenFactory = await hre.ethers.getContractFactory(TokenContractName.AstarToken)

      // Deploy the token contract
      const token = await TokenFactory.deploy();

      // Wait for transaction confirmation
      logger.info(
        `Waiting ${confirmations} blocks for transaction ${
          token.deploymentTransaction()?.hash
        } to be confirmed...`
      );

      await token.deploymentTransaction()?.wait(confirmations);

      // Retrieve and log the deployed token address
      const tokenAddress = await token.getAddress();
      logger.info(`Token deployed to: ${tokenAddress}`);

      logger.info(
        `Deploying token contract to address: ${await token.getAddress()}`
      );

      // Encode the initialize function call for the token contract
      const initializeData = token.interface.encodeFunctionData("initialize", [
        signerAddress
      ]);

      // Deploy the proxy contract
      const ProxyFactory = await hre.ethers.getContractFactory(ProxyContractName);

      const proxy = await ProxyFactory.deploy(tokenAddress, initializeData);
      const proxyConstructorArgs = [tokenAddress, initializeData];

      // Wait for transaction confirmation
      logger
        .info(
          `Waiting ${confirmations} blocks for transaction ${
            proxy.deploymentTransaction()?.hash
          } to be confirmed...`
        )
      
      await proxy.deploymentTransaction()?.wait(confirmations);

      // Retrieve and log the deployed proxy address
      const proxyAddress = await proxy.getAddress();
      logger.info(`Proxy deployed to: ${proxyAddress}`);

      let tokenPool;
      let tokenPoolAddress: string;
      const tokenPoolConstructorArgs: any[] = [];

      if (poolType === PoolType.burnMint) {
        // Load the contract factory for BurnMintTokenPool
        const TokenPoolFactory = await hre.ethers.getContractFactory(
          TokenPoolContractName.BurnMintTokenPool
        );

        // Deploy BurnMintTokenPool
        tokenPool = await TokenPoolFactory.deploy(
          proxyAddress,
          [], // Allowlist (empty array)
          rmnProxy,
          router
        );
        tokenPoolConstructorArgs.push(proxyAddress, [], rmnProxy, router);
      } else if (poolType === PoolType.lockRelease) {
        // Load the contract factory for LockReleaseTokenPool
        const TokenPoolFactory = await hre.ethers.getContractFactory(
          TokenPoolContractName.LockReleaseTokenPool
        );

        // Set default acceptLiquidity to false if not provided
        const acceptLiquidityValue = acceptLiquidity ?? false;

        console.log("tokenAddress", proxyAddress);
        console.log("[]", []);
        console.log("rmnProxy", rmnProxy);
        console.log("acceptLiquidityValue", acceptLiquidityValue);
        console.log("router", router);

        // Deploy LockReleaseTokenPool
        tokenPool = await TokenPoolFactory.deploy(
          proxyAddress,
          [], // Allowlist (empty array)
          rmnProxy,
          acceptLiquidityValue,
          router
        );
        tokenPoolConstructorArgs.push(
          proxyAddress,
          [],
          rmnProxy,
          acceptLiquidityValue,
          router
        );
      } else {
        throw new Error(`Invalid poolType: ${poolType}`);
      }

      if (confirmations === undefined) {
        throw new Error(`confirmations is not defined for ${networkName}`);
      }

      // Wait for transaction confirmation
      logger.info(
        `Waiting ${confirmations} blocks for transaction ${
          tokenPool.deploymentTransaction()?.hash
        } to be confirmed...`
      );
      await tokenPool.deploymentTransaction()?.wait(confirmations);

      // Retrieve and log the deployed token pool address
      tokenPoolAddress = await tokenPool.getAddress();
      logger.info(`Token pool deployed to: ${tokenPoolAddress}`);

      if (poolType === PoolType.burnMint) {
        // Set the token pool as the minter and burner on the token contract
        logger.info(
          `Granting mint and burn roles to ${tokenPoolAddress} on token ${tokenAddress}`
        );

        // Load the token contract from the proxy address
        const proxiedToken = await TokenFactory.attach(proxyAddress) as typeof token;

        // Grant mint and burn roles to the token
        const tx = await proxiedToken.grantMintAndBurnRoles(tokenPoolAddress);
        
        await tx.wait(confirmations);

        logger.info(`Mint and burn roles granted to ${tokenPoolAddress}`);
      }

      // If the verifyContract option is set, verify the contract on Etherscan
      if (verifyContract) {
        await getContractVerification(
          hre,
          tokenAddress,
          [],
          TokenContractName.AstarToken
        )

        await getContractVerification(
          hre,
          proxyAddress,
          proxyConstructorArgs,
          ProxyContractName
        )

        await getContractVerification(
          hre,
          tokenPoolAddress,
          tokenPoolConstructorArgs,
          poolType + "TokenPool"
        )
        
      } else {
        logger.info("All contracts deployed successfully");
      }
    } catch (error) {
      logger.error(error);
      throw new Error("Error with deploying contracts");
    }
  });

