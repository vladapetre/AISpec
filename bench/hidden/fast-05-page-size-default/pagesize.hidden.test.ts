import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, loadConfig } from "../../src/config.js";

describe("hidden: default page size is 25", () => {
  it("in the code default", () => {
    expect(DEFAULT_CONFIG.listing.defaultPageSize).toBe(25);
  });
  it("in data/config.json", () => {
    expect(loadConfig("data/config.json", {}).listing.defaultPageSize).toBe(25);
  });
});
