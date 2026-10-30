import { describe, expect, it } from "bun:test";
import { formatDownloads, formatTraffic } from "#lib/util";

describe("formatDownloads", () => {
  it("handles millions", () => {
    expect(formatDownloads(7_520_000)).toEqual("7.52M");
  });
});

describe("formatTraffic", () => {
  it("handles terabytes", () => {
    expect(formatTraffic(2_840_000_000_000)).toEqual("2.84 TB");
  });
});
