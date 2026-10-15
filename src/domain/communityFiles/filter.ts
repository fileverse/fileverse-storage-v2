import { getAddress, isAddress } from "viem";

// Listings keep the portal address in whatever case the publisher sent it.
const portalAddressVariants = (portalAddress: string) =>
  isAddress(portalAddress, { strict: false })
    ? [
        ...new Set([
          portalAddress,
          portalAddress.toLowerCase(),
          getAddress(portalAddress),
        ]),
      ]
    : [portalAddress];

// Mongoose drops empty or unknown filter keys, which would widen the match to
// the whole collection.
export const listingFilter = (dsheetIds: string[], portalAddress: string) => {
  const ids = dsheetIds.filter(Boolean);
  if (ids.length === 0 || !portalAddress) {
    throw new Error("listingFilter: dsheetIds and portalAddress required");
  }
  return {
    dsheetId: { $in: ids },
    portalAddress: { $in: portalAddressVariants(portalAddress) },
  };
};
