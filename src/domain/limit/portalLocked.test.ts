jest.mock("../../infra/database/models", () => ({
  Limit: { exists: jest.fn() },
}));

import { Limit } from "../../infra/database/models";
import { isPortalLocked } from "./portalLocked";

const exists = Limit.exists as unknown as jest.Mock;

describe("isPortalLocked", () => {
  beforeEach(() => exists.mockReset());

  it("is true when the portal's limit row is locked, whatever the header's case", async () => {
    exists.mockResolvedValue({ _id: "row" });
    await expect(isPortalLocked("0xAbC")).resolves.toBe(true);
    expect(exists).toHaveBeenCalledWith({
      contractAddress: "0xabc",
      locked: true,
    });
  });

  it("is false for a portal with no locked row", async () => {
    exists.mockResolvedValue(null);
    await expect(isPortalLocked("0xabc")).resolves.toBe(false);
  });
});
