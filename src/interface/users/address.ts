import { PrivyInstance } from "../../infra/privy";
import { CustomRequest } from "../../types";

import { Response, Request } from "express";
interface EmailWithAddress {
  email: string;
  address: string;
}

interface SocialWithAddress {
  username: string;
  address: string;
}

async function address(req: CustomRequest, res: Response) {
  const { emails, socials } = req.body;
  const userAddressResponse: EmailWithAddress[] = [];
  const userSocialAddressResponse: SocialWithAddress[] = [];
  const failedUserImports: string[] = [];

  const distinctEmails = [...new Set(emails)].map(String);

  for (const email of distinctEmails) {
    const data = await PrivyInstance.getUsersByEmail(email);
    if (data) {
      userAddressResponse.push(data);
    } else {
      const importedUser = await PrivyInstance.importUserByEmail(email);
      if (importedUser) {
        userAddressResponse.push(importedUser);
      } else {
        failedUserImports.push(email);
      }
    }
  }

  if (socials) {
    for (const social of socials) {
      const { platform, username } = social;
      const data = await PrivyInstance.getUserBySocial(platform, username);
      if (!data) return res.status(404).json({ error: "User not found" });
      if (data) {
        userSocialAddressResponse.push(data);
      }
    }
  }

  res.json({
    userAddresses: userAddressResponse,
    failedUserImports: failedUserImports,
    userSocialAddresses: userSocialAddressResponse,
  });
}

export default [address];
