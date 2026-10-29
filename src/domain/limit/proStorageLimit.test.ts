import { resolveBaseStorageLimit } from "./proStorageLimit";

const GB = 1_000_000_000;
const PRO = 100 * GB;

describe("resolveBaseStorageLimit", () => {
  it("uses the row limit when the portal is not pro", () => {
    expect(
      resolveBaseStorageLimit({
        rowLimit: 5 * GB,
        defaultLimit: 2 * GB,
        pro: false,
        proLimit: PRO,
      })
    ).toBe(5 * GB);
  });

  it("falls back to the default when the row has no limit", () => {
    expect(
      resolveBaseStorageLimit({
        rowLimit: null,
        defaultLimit: 2 * GB,
        pro: false,
        proLimit: PRO,
      })
    ).toBe(2 * GB);
  });

  it("raises a smaller limit to the pro limit", () => {
    expect(
      resolveBaseStorageLimit({
        rowLimit: 2 * GB,
        defaultLimit: 2 * GB,
        pro: true,
        proLimit: PRO,
      })
    ).toBe(PRO);
  });

  it("uses the pro limit when the row has no limit", () => {
    expect(
      resolveBaseStorageLimit({
        rowLimit: null,
        defaultLimit: 2 * GB,
        pro: true,
        proLimit: PRO,
      })
    ).toBe(PRO);
  });

  it("never shrinks a custom limit that is already above the pro limit", () => {
    expect(
      resolveBaseStorageLimit({
        rowLimit: 150 * GB,
        defaultLimit: 2 * GB,
        pro: true,
        proLimit: PRO,
      })
    ).toBe(150 * GB);
  });
});
