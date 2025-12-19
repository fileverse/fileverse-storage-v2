import { PrivyClient, User } from "@privy-io/server-auth";
import { getUserFidByUsername } from "../../interface/users/neynar-api";

const getPrivyUserAddress = (user: User | null) => {
  if (!user) return null;
  if (!user.wallet || user.wallet.chainType !== "ethereum") return null;

  return user.wallet.address;
};

const getPrivySocialQueryHandler = (
  platform: string,
  privyClient: PrivyClient
) => {
  switch (platform) {
    case "github":
      return privyClient.getUserByGithubUsername.bind(privyClient);

    case "twitter":
      return privyClient.getUserByTwitterUsername.bind(privyClient);

    case "discord":
      return privyClient.getUserByDiscordUsername.bind(privyClient);

    case "farcaster":
      return privyClient.getUserByFarcasterId.bind(privyClient);

    default:
      return null;
  }
};

class PrivyWrapper {
  private privyClient: PrivyClient;

  constructor() {
    this.privyClient = new PrivyClient(
      process.env.PRIVY_APP_ID as string,
      process.env.PRIVY_SECRET as string
    );
  }

  async importUserByEmail(email: string) {
    const importedUser = await this.privyClient.importUser({
      linkedAccounts: [
        {
          type: "email",
          address: email,
        },
      ],
      createEthereumWallet: true,
    });

    const address = getPrivyUserAddress(importedUser);
    if (importedUser && address) {
      return {
        email: email,
        address: address,
      };
    }

    return null;
  }

  async getUsersByEmail(email: string) {
    const existingUser = await this.privyClient.getUserByEmail(email);
    const userAddress = getPrivyUserAddress(existingUser);
    if (existingUser && userAddress) {
      return {
        email: email,
        address: userAddress,
      };
    }

    return null;
  }
  async getUserBySocial(platform: string, username: string) {
    const getUserSocialInfo = getPrivySocialQueryHandler(
      platform,
      this.privyClient
    );
    if (!getUserSocialInfo) return null;
    const actualUserName =
      platform === "farcaster"
        ? await getUserFidByUsername(username)
        : username;
    if (!actualUserName) return null;
    // @ts-ignore
    const existingUser = await getUserSocialInfo(actualUserName);
    const userAddress = getPrivyUserAddress(existingUser);
    if (existingUser && userAddress) {
      return {
        username: username,
        address: userAddress,
      };
    }
  }
}

export const PrivyInstance = new PrivyWrapper();
