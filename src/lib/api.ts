import {
  LIVE_REGISTRY_URL,
  MAX_BATCHES,
  MIN_BATCH_SIZE,
  MIN_PACKAGES_FOR_BATCH_MODE,
  NPM_REGISTRY_BASE_URL,
  REGISTRY_URL,
} from "./constants";
import { hash } from "./util";

async function cachedFetch<T, P = T>(url: string, options: RequestInit = {}) {
  const hashKey = `fetch:${hash(url + (options.body || ""))}`;
  const cached = localStorage.getItem(hashKey);

  if (cached) {
    const { data, expiry }: { data: P; expiry: number } = JSON.parse(cached);
    if (Date.now() < expiry) return { data, isCached: true as const };
    localStorage.removeItem(hashKey);
  }

  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  const rawData: T = await response.json();

  return {
    data: rawData,
    isCached: false as const,
    commit(processedData: P, ttlMinutes = 10) {
      try {
        const entry = {
          data: processedData,
          expiry: Date.now() + ttlMinutes * 60 * 1000,
        };
        localStorage.setItem(hashKey, JSON.stringify(entry));
      } catch (err) {
        console.error(err);
        Object.keys(localStorage)
          .filter((k) => k.startsWith("fetch:"))
          .forEach((k) => void localStorage.removeItem(k));
      }
    },
  };
}

interface DownloadsStatsRow {
  id: string;
  key: string;
  value: number;
}

interface DownloadsStats {
  total_rows: number;
  offset: number;
  rows: DownloadsStatsRow[];
}

async function fetchAllStats(
  names: string[],
  onProgress: (percent: number, status: string) => void,
) {
  const combinedStats: Record<string, number> = {};
  const url = `${REGISTRY_URL}/_design/downloads/_view/downloads` as const;

  if (names.length <= MIN_PACKAGES_FOR_BATCH_MODE) {
    onProgress(40, `Fetching stats for ${names.length} packages...`);
    const { data } = await cachedFetch<DownloadsStats>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: names }),
    });
    data.rows.forEach((r) => {
      combinedStats[r.key] = r.value;
    });
  } else {
    const batchSize = Math.max(
      MIN_BATCH_SIZE,
      Math.ceil(names.length / MAX_BATCHES),
    );
    const totalBatches = Math.ceil(names.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const pct = Math.round(40 + (i / totalBatches) * 58);
      onProgress(pct, `Fetching stats for ${names.length} packages...`);
      const batch = names.slice(i * batchSize, (i + 1) * batchSize);
      const { data } = await cachedFetch<DownloadsStats>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: batch }),
      });
      data.rows.forEach((r) => {
        combinedStats[r.key] = r.value;
      });
    }
  }

  onProgress(98, "Stats fetch complete.");
  return combinedStats;
}

interface PackageDist {
  unpackedSize: number;
  size?: number;
}

interface PackageInfo {
  dist: PackageDist;
}

async function getBasePackageSize(name: string): Promise<number> {
  const url = `${NPM_REGISTRY_BASE_URL}/${name}/latest` as const;
  const result = await cachedFetch<PackageInfo>(url);
  if (!result.isCached) {
    result.commit(result.data);
  }
  return result.data.dist.size ?? 0;
}

interface DatabasePackageDeprecated {
  deprecated: boolean;
}

interface DatabasePackageDist {
  unpackedSize: number;
}

interface DatabasePackageDownloads {
  lastDay: number;
  lastWeek: number;
  lastWeekVersion: number;
  lastMonth: number;
}

interface DatabasePackageInfo {
  deprecated?: DatabasePackageDeprecated;
  dist: DatabasePackageDist;
  tarballSize: number;
  downloads: DatabasePackageDownloads;
}

async function getPackageIsDeprecated(name: string): Promise<boolean> {
  const url = `${LIVE_REGISTRY_URL}/${name}` as const;
  const result = await cachedFetch<DatabasePackageInfo>(url);
  if (!result.isCached) {
    result.commit(result.data);
  }
  return result.data.deprecated?.deprecated ?? false;
}

interface DevDependentsRow {
  id: string;
  key: string;
  value: string & { version: undefined };
}

interface DependentsRow {
  id: string;
  key: string;
  value: { name: string; version: string };
}

interface Dependents {
  total_rows: number;
  offset: number;
  rows: DependentsRow[] | DevDependentsRow[];
}

interface ProcessedDependent {
  n: string;
  v: string;
  d: number;
}

async function getSortedDependents(
  packageName: string,
  options: {
    isDev?: boolean;
    onProgress: (percent: number, status: string) => void;
  },
): Promise<ProcessedDependent[]> {
  const view = options.isDev ? "dev-dependencies" : "dependents2";
  const url =
    `${LIVE_REGISTRY_URL}/_design/dependents/_view/${view}?key="${packageName}"` as const;

  const { data, isCached, commit } = await cachedFetch<
    Dependents,
    ProcessedDependent[]
  >(url);

  if (isCached) return data;

  options.onProgress(30, "Analyzing dependents list...");

  const allNames = data.rows.map((r) => r.id);
  const allStats = await fetchAllStats(allNames, options.onProgress);

  const MAX_DEPENDENTS = 3000;

  const processed: ProcessedDependent[] = data.rows
    .map((r) => ({
      n: r.id,
      v: r.value?.version?.trim() ?? "",
      d: allStats[r.id] ?? 0,
    }))
    .sort((a, b) => b.d - a.d)
    .slice(0, MAX_DEPENDENTS);

  commit(processed);

  return processed;
}

export {
  cachedFetch,
  fetchAllStats,
  getBasePackageSize,
  getPackageIsDeprecated,
  getSortedDependents,
};
