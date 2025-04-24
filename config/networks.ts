import { Chains, EtherscanConfig, Networks } from "./types";
import configData from "./config.json";

require("@chainlink/env-enc").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PRIVATE_KEY_2 = process.env.PRIVATE_KEY_2;

const accounts = [];
if (PRIVATE_KEY) {
  accounts.push(PRIVATE_KEY);
}

if (PRIVATE_KEY_2) {
  accounts.push(PRIVATE_KEY_2);
}


const networks: Networks = {
  [Chains.soneiumMinato]: {
    ...configData.soneiumMinato,
    url: "https://rpc.minato.soneium.org",
    gasPrice: undefined,
    nonce: undefined,
    accounts,
  },
  [Chains.soneium]: {
    ...configData.soneium,
    url: process.env.SONEIUM_RPC_URL || "https://rpc.soneium.org",
    gasPrice: undefined,
    nonce: undefined,
    accounts,
  },
};

const etherscan: EtherscanConfig = {
  apiKey: {
    [Chains.soneiumMinato]: " ",
    [Chains.soneium]: " ",
  },
  customChains: [
    {
      network: Chains.soneiumMinato,
      chainId: 1946,
      urls: {
        apiURL: "https://soneium-minato.blockscout.com/api",
        browserURL: "https://soneium-minato.blockscout.com",
      },
    },
    {
      network: Chains.soneium,
      chainId: 1868,
      urls: {
        apiURL: "https://soneium.blockscout.com/api",
        browserURL: "https://soneium.blockscout.com",
      },
    },
  ],
};

export { networks, etherscan };
