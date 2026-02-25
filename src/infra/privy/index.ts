import { PrivyClient, User } from "@privy-io/server-auth";
import { getUserFidByUsername } from "../../interface/users/neynar-api";
import { cache } from "../cache";

const EMAIL_CACHE_TTL = 60 * 60 * 24; // seconds

type EmailCacheValue = {
  email: string;
  address: string;
};

const getPrivyUserAddress = (user: User | null) => {
  if (!user) return null;
  if (!user.wallet || user.wallet.chainType !== "ethereum") return null;

  return user.wallet.address;
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
    const cached = cache.get<EmailCacheValue>(`privy:email:${email}`);
    if (cached) {
      return cached;
    }

    try {
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
        const value: EmailCacheValue = {
          email: email,
          address: address,
        };
        cache.set(`privy:email:${email}`, value, EMAIL_CACHE_TTL);
        return value;
      }

      return null;
    } catch (error) {
      console.error("[Privy] importUserByEmail failed for", email, error);
      return null;
    }
  }

  async getUsersByEmail(email: string) {
    const cached = cache.get<EmailCacheValue>(`privy:email:${email}`);
    if (cached) {
      return cached;
    }

    try {
      const existingUser = await this.privyClient.getUserByEmail(email);
      const userAddress = getPrivyUserAddress(existingUser);
      if (existingUser && userAddress) {
        const value: EmailCacheValue = {
          email: email,
          address: userAddress,
        };
        cache.set(`privy:email:${email}`, value, EMAIL_CACHE_TTL);
        return value;
      }

      return null;
    } catch (error) {
      console.error("[Privy] getUsersByEmail failed for", email, error);
      return null;
    }
  }

  async getUserByFarcasterUsername(username: string) {
    const fid = await getUserFidByUsername(username);

    if (!fid) return null;
    const existingUser = await this.privyClient.getUserByFarcasterId(fid);

    const userAddress = getPrivyUserAddress(existingUser);
    if (existingUser && userAddress) {
      return {
        username: username,
        address: userAddress,
      };
    }
    return null;
  }

  async getUserByGithubUsername(username: string) {
    const existingUser = await this.privyClient.getUserByGithubUsername(
      username
    );
    const userAddress = getPrivyUserAddress(existingUser);
    if (existingUser && userAddress) {
      return {
        username: username,
        address: userAddress,
      };
    }
    return null;
  }

  async getUserByDiscordUsername(username: string) {
    const existingUser = await this.privyClient.getUserByDiscordUsername(
      username
    );
    const userAddress = getPrivyUserAddress(existingUser);
    if (existingUser && userAddress) {
      return {
        username: username,
        address: userAddress,
      };
    }
    return null;
  }

  async getUserByTwitterUsername(username: string) {
    const existingUser = await this.privyClient.getUserByTwitterUsername(
      username
    );
    const userAddress = getPrivyUserAddress(existingUser);
    if (existingUser && userAddress) {
      return {
        username: username,
        address: userAddress,
      };
    }
    return null;
  }
  async getUserBySocial(platform: string, username: string) {
    switch (platform) {
      case "farcaster":
        return this.getUserByFarcasterUsername(username);
      case "github":
        return this.getUserByGithubUsername(username);
      case "discord":
        return this.getUserByDiscordUsername(username);
      case "twitter":
        return this.getUserByTwitterUsername(username);
      default:
        return null;
    }
  }
}

export const PrivyInstance = new PrivyWrapper();
