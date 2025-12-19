import { config } from "../../config";

export const getUserFidByUsername = async (username: string) => {
  const options = {
    method: "GET",
    headers: { "x-api-key": config.NEYNAR_API_KEY as string },
  };
  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/by_username/${username}`,
    options
  );
  const data = await response.json();
  return data.user.fid;
};
