import { task, types } from "hardhat/config";
import { Chains, networks, logger, TokenContractName, ProxyContractName } from "../config";

task("deployAtNonce", "Deploys AstarToken implementation and proxy at specific nonces")
  .addParam("nonce", "Target nonce for proxy deployment", 15, types.int)
  .addOptionalParam("verifycontract", "Verify the contract on Blockchain scan", false, types.boolean)
  .setAction(async (taskArgs, hre) => {
    const { nonce: TARGET_PROXY_NONCE, verifycontract: verifyContract } = taskArgs;
    const networkName = hre.network.name as Chains;

    // Ensure the network is configured
    const networkConfig = networks[networkName];
    if (!networkConfig) {
      throw new Error(`Network ${networkName} not found in config`);
    }

    const { confirmations } = networkConfig;

    // Get signer
    const [deployer] = await hre.ethers.getSigners();
    const deployerAddress = deployer.address;
    logger.info(`Using deployer address: ${deployerAddress}`);

    // Check current nonce
    const currentNonce = await hre.ethers.provider.getTransactionCount(deployerAddress);
    logger.info(`Current nonce: ${currentNonce}`);

    // If we're at nonce 15 or higher already, we can't use nonce 15 for the proxy
    if (currentNonce > TARGET_PROXY_NONCE) {
      throw new Error(`Current nonce (${currentNonce}) is already higher than target proxy nonce (${TARGET_PROXY_NONCE})`);
    }

    // Step 1: First deploy the implementation
    // If current nonce is 14, deploy implementation; if lower, fast-forward to 14 first
    const implNonce = TARGET_PROXY_NONCE - 1; // Implementation should be at nonce 14 if proxy is at 15

    // Fast forward to implementation nonce if needed
    if (currentNonce < implNonce) {
      logger.info(`Fast forwarding nonce from ${currentNonce} to ${implNonce}...`);

      // Send dummy transactions to increment nonce
      for (let i = currentNonce; i < implNonce; i++) {
        logger.info(`Sending transaction to increment nonce to ${i + 1}...`);

        const response = await deployer.sendTransaction({
          to: deployerAddress,
          value: hre.ethers.parseEther("0"),
          gasLimit: 21000,
        });

        await response.wait(1);
      }
    }

    // Deploy the implementation
    logger.info(`Deploying AstarToken implementation at nonce ${implNonce}...`);
    const TokenFactory = await hre.ethers.getContractFactory(TokenContractName.AstarToken);
    const implementation = await TokenFactory.deploy();

    const implDeploymentTx = implementation.deploymentTransaction();
    if (!implDeploymentTx) throw new Error("Implementation deployment transaction not found");

    logger.info(`Waiting for implementation deployment to be confirmed...`);
    await implDeploymentTx.wait(confirmations);

    const implementationAddress = await implementation.getAddress();
    logger.info(`AstarToken implementation deployed to: ${implementationAddress}`);

    // Check that current nonce is now exactly TARGET_PROXY_NONCE
    const proxyNonce = await hre.ethers.provider.getTransactionCount(deployerAddress);

    if (proxyNonce !== TARGET_PROXY_NONCE) {
      throw new Error(`Expected nonce to be ${TARGET_PROXY_NONCE} for proxy deployment, but it's ${proxyNonce}`);
    }

    // Step 2: Deploy the proxy at exactly nonce 15
    logger.info(`Deploying proxy with nonce ${TARGET_PROXY_NONCE}...`);

    // Encode the initialization call
    const initData = implementation.interface.encodeFunctionData("initialize", [deployerAddress]);

    // Deploy the proxy
    const ProxyFactory = await hre.ethers.getContractFactory(ProxyContractName);
    const proxy = await ProxyFactory.deploy(implementationAddress, initData);

    const proxyDeploymentTx = proxy.deploymentTransaction();
    if (!proxyDeploymentTx) throw new Error("Proxy deployment transaction not found");

    logger.info(`Waiting for proxy deployment to be confirmed...`);
    await proxyDeploymentTx.wait(confirmations);

    const proxyAddress = await proxy.getAddress();
    logger.info(`Proxy deployed to: ${proxyAddress}`);

    // Check if proxy deployed to expected address
    const expectedAddress = "0x2CAE934a1e84F693fbb78Ca5ED3B0A6893259441"; // The address from Soneium
    if (proxyAddress.toLowerCase() === expectedAddress.toLowerCase()) {
      logger.info(`✅ SUCCESS: Proxy deployed to expected address ${expectedAddress}`);
    } else {
      logger.error(`❌ ERROR: Proxy address ${proxyAddress} does not match expected address ${expectedAddress}`);
    }

    // Verify contracts if requested
    if (verifyContract) {
      try {
        // Verify implementation
        logger.info("Verifying implementation contract...");
        await hre.run("verify:verify", {
          address: implementationAddress,
          constructorArguments: [],
        });

        // Verify proxy
        logger.info("Verifying proxy contract...");
        await hre.run("verify:verify", {
          address: proxyAddress,
          constructorArguments: [implementationAddress, initData],
        });

        logger.info("Contracts verified successfully");
      } catch (error) {
        logger.error("Verification failed:", error);
      }
    }

    return { implementation: implementationAddress, proxy: proxyAddress };
  });