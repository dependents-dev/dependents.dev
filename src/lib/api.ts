import { liveRegistryUrl, npmRegistryBaseUrl, registryUrl } from "./constants";
import { updateProgress } from "./ui";
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

async function fetchAllStats(names: string[]) {
  const combinedStats: Record<string, number> = {};

  updateProgress(40, `Fetching stats for ${names.length} packages...`);

  const url = `${registryUrl}/_design/downloads/_view/downloads` as const;

  const { data } = await cachedFetch<DownloadsStats>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys: names }),
  });

  data.rows.forEach((r) => {
    combinedStats[r.key] = r.value;
  });

  updateProgress(90, "Stats fetch complete.");
  return combinedStats;
}

interface PackageDist {
  unpackedSize: number;
  size: number;
}

interface PackageInfo {
  dist: PackageDist;
}

async function getBasePackageSize(name: string): Promise<number> {
  const url = `${npmRegistryBaseUrl}/${name}/latest` as const;
  const result = await cachedFetch<PackageInfo>(url);
  if (!result.isCached) {
    result.commit(result.data);
  }
  return result.data.dist?.size || 0;
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
  isDev?: boolean,
): Promise<ProcessedDependent[]> {
  const view = isDev ? "dev-dependencies" : "dependents2";
  const url =
    `${liveRegistryUrl}/_design/dependents/_view/${view}?key="${packageName}"` as const;

  const { data, isCached, commit } = await cachedFetch<
    Dependents,
    ProcessedDependent[]
  >(url);

  if (isCached) return data;

  updateProgress(30, "Analyzing dependent list...");

  const allNames = data.rows.map((r) => r.id);
  const allStats = await fetchAllStats(allNames);

  const MAX_DEPENDENTS = 3000;

  const processed = data.rows
    .map((r) => ({
      n: r.id,
      v: r.value?.version?.trim() || "",
      d: allStats[r.id] || 0,
    }))
    .sort((a, b) => b.d - a.d)
    .slice(0, MAX_DEPENDENTS);

  commit(processed);

  return processed;
}

export { cachedFetch, fetchAllStats, getBasePackageSize, getSortedDependents };
