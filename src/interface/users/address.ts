import { PrivyInstance } from "../../infra/privy";
import { CustomRequest } from "../../types";

import { Response } from "express";

interface EmailWithAddress {
  email: string;
  address: string;
}

interface SocialWithAddress {
  username: string;
  address: string;
}

const MAX_EMAILS_PER_REQUEST = 50;

async function address(req: CustomRequest, res: Response) {
  const { emails, socials } = req.body;
  const userAddressResponse: EmailWithAddress[] = [];
  const userSocialAddressResponse: SocialWithAddress[] = [];
  const failedUserImports: (string | object)[] = [];

  if (!Array.isArray(emails)) {
    res.status(400).json({
      error: "emails must be an array",
    });
    return;
  }

  const distinctEmails = [...new Set(emails)].map(String);

  if (distinctEmails.length > MAX_EMAILS_PER_REQUEST) {
    res.status(400).json({
      error: `Cannot process more than ${MAX_EMAILS_PER_REQUEST} emails per request`,
    });
    return;
  }

  const foundByEmail = await PrivyInstance.getUsersByEmailsBulk(distinctEmails);
  for (const [, value] of foundByEmail) {
    userAddressResponse.push(value);
  }

  const notFoundEmails = distinctEmails.filter((e) => !foundByEmail.has(e));
  if (notFoundEmails.length > 0) {
    const { resolved, failed } = await PrivyInstance.importUsersByEmailsBulk(notFoundEmails);
    userAddressResponse.push(...resolved);
    failedUserImports.push(...failed);
  }

  if (socials) {
    for (const social of socials) {
      const { platform, username } = social;
      const data = await PrivyInstance.getUserBySocial(platform, username);
      if (!data) {
        failedUserImports.push(social);
        continue;
      }
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
