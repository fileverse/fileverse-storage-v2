import CommunityFiles from "../../infra/database/models/communityFiles";
import { listingFilter } from "./filter";

const PORTAL = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

describe("listingFilter", () => {
  it("keeps the sheet id and portal once mongoose casts a delete", () => {
    const cast = CommunityFiles.deleteMany(
      listingFilter(["sheet-1"], PORTAL.toLowerCase())
    ).cast(CommunityFiles);

    expect(cast).toEqual({
      dsheetId: { $in: ["sheet-1"] },
      portalAddress: { $in: [PORTAL.toLowerCase(), PORTAL] },
    });
  });

  it("throws instead of matching the whole collection", () => {
    expect(() => listingFilter([""], PORTAL)).toThrow();
    expect(() => listingFilter([], PORTAL)).toThrow();
    expect(() => listingFilter(["sheet-1"], "")).toThrow();
  });
});
