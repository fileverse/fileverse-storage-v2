import { PrivyInstance } from "../../infra/privy";
import { CustomRequest } from "../../types";

import { Response, Request } from "express";
interface EmailWithAddress {
  email: string;
  address: string;
}

async function address(req: CustomRequest, res: Response) {
  const { emails } = req.body;
  const userAddressResponse: EmailWithAddress[] = [];
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

  res.json({
    userAddresses: userAddressResponse,
    failedUserImports: failedUserImports,
  });
}

export default [address];
