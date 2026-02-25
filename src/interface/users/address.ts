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

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 200;
const MAX_EMAILS_PER_REQUEST = 50;

async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

async function resolveEmail(
  email: string
): Promise<{ result: EmailWithAddress | null; failed: string | null }> {
  const data = await PrivyInstance.getUsersByEmail(email);
  if (data) return { result: data, failed: null };

  const importedUser = await PrivyInstance.importUserByEmail(email);
  if (importedUser) return { result: importedUser, failed: null };

  return { result: null, failed: email };
}

async function address(req: CustomRequest, res: Response) {
  const { emails, socials } = req.body;
  const userAddressResponse: EmailWithAddress[] = [];
  const userSocialAddressResponse: SocialWithAddress[] = [];
  const failedUserImports: string[] = [];

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

  const emailResults = await processBatches(
    distinctEmails,
    BATCH_SIZE,
    BATCH_DELAY_MS,
    resolveEmail
  );

  for (const { result, failed } of emailResults) {
    if (result) {
      userAddressResponse.push(result);
    }
    if (failed) {
      failedUserImports.push(failed);
    }
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
