import { createPublicClient, http } from "viem";
import { sepolia, gnosis } from "viem/chains";

import { config } from "../../config";

const network = config.NETWORK as keyof typeof CHAIN_MAP;
const rpcUrl = config.RPC_URL as string;

const CHAIN_MAP = {
  sepolia: sepolia,
  gnosis: gnosis,
};

const chain = CHAIN_MAP[network];

export const publicClient = createPublicClient({
  chain: chain,
  transport: http(rpcUrl),
});
