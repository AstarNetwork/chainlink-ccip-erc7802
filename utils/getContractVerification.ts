import { HardhatRuntimeEnvironment } from "hardhat/types";
import { logger, } from "../config"

export async function getContractVerification(hre: HardhatRuntimeEnvironment, address: string, constructorArguments: any[], contractName: string) {
  logger.info("Verifying contract...");
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments,
    });
    logger.info(`${contractName} contract (${address}) deployed and verified`);
  } catch (error) {
    if (error instanceof Error) {
      if (!error.message.includes("Already Verified")) {
        logger.error(error.message);
        logger.warn(
          `${contractName} contract deployed but not verified. Ensure you are waiting for enough confirmation blocks`
        );
      } else {
        logger.warn(`${contractName} contract deployed but already verified`);
      }
    } else {
      logger.error(
        `${contractName} contract deployed but there was an unknown error while verifying`
      );
      logger.error(error);
    }
  } 
}