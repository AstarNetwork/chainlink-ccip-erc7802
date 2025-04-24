export interface ChainConfig {
  chainId?: number;
  chainSelector: string;
  router: string;
  rmnProxy: string;
  tokenAdminRegistry: string;
  registryModuleOwnerCustom: string;
  link: string;
  confirmations: number;
  nativeCurrencySymbol: string;
}

export enum Chains {
  soneiumMinato = "soneiumMinato",
  soneium = "soneium",
}

export type Configs = {
  [key in Chains]: ChainConfig;
};

export interface NetworkConfig extends ChainConfig {
  url: string;
  gasPrice?: number;
  nonce?: number;
  accounts: string[];
}

export type Networks = Partial<{
  [key in Chains]: NetworkConfig;
}>;

type ApiKeyConfig = Partial<{
  [key in Chains]: string;
}>;

interface Urls {
  apiURL: string;
  browserURL: string;
}

interface CustomChain {
  network: string;
  chainId: number;
  urls: Urls;
}

export interface EtherscanConfig {
  apiKey: ApiKeyConfig;
  customChains: CustomChain[];
}

export enum TokenContractName {
  ShibuyaToken = "ShibuyaToken",
  AstarToken = "AstarToken",
}

export enum TokenPoolContractName {
  BurnMintTokenPool = "BurnMintTokenPool",
  LockReleaseTokenPool = "LockReleaseTokenPool",
}

export enum PoolType {
  burnMint = "burnMint",
  lockRelease = "lockRelease",
}

export const ProxyContractName = "ERC1967Proxy";

export const EtherSenderReceiverContractName = "EtherSenderReceiver";
