import { describe, expect, it } from "bun:test";
import { getPackageNameAndVersion } from "#lib/util";

describe("getPackageNameAndVersion", () => {
  it("should handle non-scoped packages", () => {
    expect(getPackageNameAndVersion("astro")).toEqual(["astro"]);
    expect(getPackageNameAndVersion(" astro ")).toEqual(["astro"]);
  });

  it("should handle scoped packages", () => {
    expect(getPackageNameAndVersion("@clack/prompts")).toEqual([
      "@clack/prompts",
    ]);
    expect(getPackageNameAndVersion(" @clack/prompts ")).toEqual([
      "@clack/prompts",
    ]);
  });

  it("should handle non-scoped packages with version", () => {
    expect(getPackageNameAndVersion("vite@7")).toEqual(["vite", "7"]);
    expect(getPackageNameAndVersion(" vite@7 ")).toEqual(["vite", "7"]);
    expect(getPackageNameAndVersion("vite @ 7")).toEqual(["vite", "7"]);
  });

  it("should handle scoped packages with version", () => {
    expect(getPackageNameAndVersion("@biomejs/biome@2.5.0")).toEqual([
      "@biomejs/biome",
      "2.5.0",
    ]);
    expect(getPackageNameAndVersion(" @biomejs/biome@2.5.0 ")).toEqual([
      "@biomejs/biome",
      "2.5.0",
    ]);
    expect(getPackageNameAndVersion("@biomejs/biome@ 2.5.0")).toEqual([
      "@biomejs/biome",
      "2.5.0",
    ]);
    expect(getPackageNameAndVersion("@biomejs/biome @ 2.5.0")).toEqual([
      "@biomejs/biome",
      "2.5.0",
    ]);
  });

  it("should handle and empty and whitespace-only input", () => {
    expect(getPackageNameAndVersion("")).toEqual([""]);
    expect(getPackageNameAndVersion("  ")).toEqual([""]);
  });
});
