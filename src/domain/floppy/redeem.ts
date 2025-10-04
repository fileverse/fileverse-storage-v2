export const redeem = async ({
  contractAddress,
  invokerAddress,
  chainId,
  shortCode,
  proof,
}: {
  invokerAddress?: string | null;
  contractAddress?: string | null;
  chainId?: string | null;
  shortCode: string;
  proof: {
    merkleTreeDepth: number;
    merkleTreeRoot: string;
    nullifier: string;
    message: string;
    scope: string;
    points: string[];
  };
}) => {
  return true;
};
