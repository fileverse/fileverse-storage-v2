import { PrivyClient, User } from "@privy-io/server-auth";

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
}

export const PrivyInstance = new PrivyWrapper();
