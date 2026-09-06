import { rangesIntersect } from "verkit";

import type { ProcessedDependent } from "./api";

interface AnalysisResult {
  name: string;
  version: string;
  downloads: number;
  traffic: number;
  deprecated: boolean;
}

function buildAnalysisResults(
  sortedDeps: ProcessedDependent[],
  options: {
    requestedRange?: string;
    limit: number;
    pkgSize: number;
  },
): AnalysisResult[] {
  const { requestedRange, limit, pkgSize } = options;
  return sortedDeps
    .filter((d) => {
      if (!requestedRange) return true;
      if (d.v === requestedRange) return true;
      if (d.v === "*" || requestedRange === "*") return true;
      try {
        return rangesIntersect(d.v, requestedRange);
      } catch {
        return false;
      }
    })
    .slice(0, limit)
    .map((d) => ({
      name: d.n,
      version: d.v,
      downloads: d.d,
      traffic: d.d * pkgSize,
      deprecated: false,
    }));
}

export type { AnalysisResult };
export { buildAnalysisResults };
