import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "./tasks";
import { etherscan, networks } from "./config";

const SOLC_SETTINGS = {
  optimizer: {
    enabled: true,
    runs: 1_000,
  },
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: SOLC_SETTINGS,
      },
    ],
  },
  etherscan: { ...etherscan },
  networks: { ...networks },
};

export default config;
