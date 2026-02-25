import { PrivyClient, User } from "@privy-io/node";
import { getUserFidByUsername } from "../../interface/users/neynar-api";

type EmailWithAddress = {
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

const getEmailFromUser = (user: User): string | null => {
  const emailAcc = user.linked_accounts.find((a) => a.type === "email");
  return emailAcc && "address" in emailAcc ? emailAcc.address : null;
};

const userToEmailWithAddress = (user: User): { email: string; address: string } | null => {
  const email = getEmailFromUser(user);
  const address = getPrivyUserAddress(user);
  return email && address ? { email, address } : null;
};

class PrivyWrapper {
  private privyClient: PrivyClient;

  constructor() {
    this.privyClient = new PrivyClient({
      appId: process.env.PRIVY_APP_ID as string,
      appSecret: process.env.PRIVY_SECRET as string,
    });
  }

  async importUserByEmail(email: string): Promise<EmailWithAddress | null> {
    try {
      const importedUser = await this.privyClient.users().create({
        linked_accounts: [{ type: "email", address: email }],
        wallets: [{ chain_type: "ethereum" }],
      });
      const address = getPrivyUserAddress(importedUser);
      if (importedUser && address) {
        return { email, address };
      }
      return null;
    } catch (error) {
      console.error("[Privy] importUserByEmail failed for", email, error);
      return null;
    }
  }

  async getUsersByEmail(email: string): Promise<EmailWithAddress | null> {
    try {
      const existingUser = await this.privyClient.users().getByEmailAddress({
        address: email,
      });
      const userAddress = getPrivyUserAddress(existingUser);
      if (existingUser && userAddress) {
        return { email, address: userAddress };
      }
      return null;
    } catch (error) {
      console.error("[Privy] getUsersByEmail failed for", email, error);
      return null;
    }
  }

  async getUsersByEmailsBulk(emails: string[]): Promise<Map<string, EmailWithAddress>> {
    const result = new Map<string, EmailWithAddress>();
    if (emails.length === 0) return result;

    try {
      const response = await this.privyClient.users().search({
        emails,
        phoneNumbers: [],
        walletAddresses: [],
      });
      const users: User[] = Array.isArray(response) ? response : [response];
      for (const user of users) {
        const value = userToEmailWithAddress(user);
        if (value) result.set(value.email, value);
      }
    } catch (error) {
      console.error("[Privy] getUsersByEmailsBulk failed", error);
    }
    return result;
  }

  async importUsersByEmailsBulk(
    emails: string[]
  ): Promise<{ resolved: EmailWithAddress[]; failed: string[] }> {
    const resolved: EmailWithAddress[] = [];
    const failed: string[] = [];
    const BATCH = 20;

    for (let i = 0; i < emails.length; i += BATCH) {
      const batch = emails.slice(i, i + BATCH);
      const outcomes = await Promise.allSettled(
        batch.map(async (email) => {
          const user = await this.privyClient.users().create({
            linked_accounts: [{ type: "email", address: email }],
            wallets: [{ chain_type: "ethereum" }],
          });
          return userToEmailWithAddress(user);
        })
      );
      
      for (let j = 0; j < outcomes.length; j++) {
        const email = batch[j];
        const outcome = outcomes[j];
        if (outcome.status === "fulfilled" && outcome.value) {
          resolved.push(outcome.value);
        } else {
          if (outcome.status === "rejected") {
            console.error("[Privy] importUsersByEmailsBulk failed for", email, outcome.reason);
          }
          failed.push(email);
        }
      }
    }
    return { resolved, failed };
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
