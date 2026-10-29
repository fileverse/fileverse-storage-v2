import { uploadBlock } from "./uploadBlock";

describe("uploadBlock", () => {
  it("allows an upload when the portal is neither locked nor full", () => {
    expect(uploadBlock({ locked: false, storageFull: false })).toBeNull();
  });

  it("refuses a full portal", () => {
    expect(uploadBlock({ locked: false, storageFull: true })).toBe("full");
  });

  it("refuses a locked portal", () => {
    expect(uploadBlock({ locked: true, storageFull: false })).toBe("locked");
  });

  it("reports the lock before a full portal", () => {
    expect(uploadBlock({ locked: true, storageFull: true })).toBe("locked");
  });
});
