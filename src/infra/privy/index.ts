import { PrivyClient, User } from "@privy-io/server-auth";
import { getUserFidByUsername } from "../../interface/users/neynar-api";

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
  private emailCache: Map<string, { value: EmailCacheValue; expiresAt: number }>;

  constructor() {
    this.privyClient = new PrivyClient(
      process.env.PRIVY_APP_ID as string,
      process.env.PRIVY_SECRET as string
    );
    this.emailCache = new Map();
  }

  private getCachedEmail(email: string): EmailCacheValue | null {
    const entry = this.emailCache.get(email);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.emailCache.delete(email);
      return null;
    }

    return entry.value;
  }

  private setCachedEmail(email: string, value: EmailCacheValue) {
    this.emailCache.set(email, {
      value,
      expiresAt: Date.now() + EMAIL_CACHE_TTL * 1000,
    });
  }

  async importUserByEmail(email: string) {
    const cached = this.getCachedEmail(email);
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
        this.setCachedEmail(email, value);
        return value;
      }

      return null;
    } catch {
      return null;
    }
  }

  async getUsersByEmail(email: string) {
    const cached = this.getCachedEmail(email);
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
        this.setCachedEmail(email, value);
        return value;
      }

      return null;
    } catch {
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
