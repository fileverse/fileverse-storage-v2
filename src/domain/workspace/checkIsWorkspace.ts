import { config } from "../../config";

export async function checkIsWorkspace(
  contractAddress:string
): Promise<boolean>{
  const response = await fetch(
    `${config.IDENTITY_INDEXER_URL}/keystores/is-workspace?contractAddress=${contractAddress}`
  );
  if(!response.ok){
    throw new Error(
      `failed to check workspace status for contact address: ${contractAddress}`
    );
  }
  const data = await response.json();
  return Boolean(data.isWorkspace);
}