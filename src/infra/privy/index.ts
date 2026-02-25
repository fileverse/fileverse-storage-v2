import { PrivyClient, User } from "@privy-io/node";
import { getUserFidByUsername } from "../../interface/users/neynar-api";

const EMAIL_CACHE_TTL = 60 * 60 * 24; // seconds

type EmailCacheValue = {
  email: string;
  address: string;
};

const getPrivyUserAddress = (user: User | null): string | null => {
  if (!user?.linked_accounts) return null;
  const account = user.linked_accounts.find(
    (acc) =>
      (acc.type === "wallet" && "chain_type" in acc && acc.chain_type === "ethereum") ||
      acc.type === "smart_wallet"
  );
  return account && "address" in account ? account.address : null;
};

class PrivyWrapper {
  private privyClient: PrivyClient;
  private emailCache: Map<string, { value: EmailCacheValue; expiresAt: number }>;

  constructor() {
    this.privyClient = new PrivyClient({
      appId: process.env.PRIVY_APP_ID as string,
      appSecret: process.env.PRIVY_SECRET as string,
    });

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
      const importedUser = await this.privyClient.users().create({
        linked_accounts: [{ type: "email", address: email }],
        wallets: [{ chain_type: "ethereum" }],
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
    } catch (error) {
      console.error("[Privy] importUserByEmail failed for", email, error);
      return null;
    }
  }

  async getUsersByEmail(email: string) {
    const cached = this.getCachedEmail(email);
    if (cached) {
      return cached;
    }

    try {
      const existingUser = await this.privyClient.users().getByEmailAddress({
        address: email,
      });
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
    } catch (error) {
      console.error("[Privy] getUsersByEmail failed for", email, error);
      return null;
    }
  }

  async getUserByFarcasterUsername(username: string) {
    const fid = await getUserFidByUsername(username);

    if (!fid) return null;
    try {
      const existingUser = await this.privyClient.users().getByFarcasterID({
        fid,
      });

      const userAddress = getPrivyUserAddress(existingUser);
      if (existingUser && userAddress) {
        return { username, address: userAddress };
      }
    } catch (error) {
      console.error("[Privy] getUserByFarcasterUsername failed for", username, error);
    }
    return null;
  }

  async getUserByGithubUsername(username: string) {
    try {
      const existingUser = await this.privyClient.users().getByGitHubUsername({
        username,
      });
      const userAddress = getPrivyUserAddress(existingUser);
      if (existingUser && userAddress) {
        return { username, address: userAddress };
      }
    } catch (error) {
      console.error("[Privy] getUserByGithubUsername failed for", username, error);
    }
    return null;
  }

  async getUserByDiscordUsername(username: string) {
    try {
      const existingUser = await this.privyClient.users().getByDiscordUsername({
        username,
      });
      const userAddress = getPrivyUserAddress(existingUser);
      if (existingUser && userAddress) {
        return { username, address: userAddress };
      }
    } catch (error) {
      console.error("[Privy] getUserByDiscordUsername failed for", username, error);
    }
    return null;
  }

  async getUserByTwitterUsername(username: string) {
    try {
      const existingUser = await this.privyClient.users().getByTwitterUsername({
        username,
      });
      const userAddress = getPrivyUserAddress(existingUser);
      if (existingUser && userAddress) {
        return { username, address: userAddress };
      }
    } catch (error) {
      console.error("[Privy] getUserByTwitterUsername failed for", username, error);
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
