// @ts-expect-error semver has no types
import semver from "semver";
import { createSignal, For, onMount, Show } from "solid-js";
import { getBasePackageSize, getSortedDependents } from "#lib/api";

import {
  escapeMdTable,
  formatDownloads,
  formatTraffic,
  getPackageNameAndVersion,
} from "#lib/util";

interface AnalysisResult {
  name: string;
  version: string;
  downloads: number;
  traffic: number;
}

type State =
  | { status: "initial" }
  | { status: "no-results" }
  | { status: "results"; items: AnalysisResult[] };

export default function App() {
  const [pkgInput, setPkgInput] = createSignal("");
  const [limitInput, setLimitInput] = createSignal("200");
  const [isDev, setIsDev] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [progressPercent, setProgressPercent] = createSignal(0);
  const [progressStatus, setProgressStatus] = createSignal("");
  const [error, setError] = createSignal("");
  const [state, setState] = createSignal<State>({ status: "initial" });
  const [copyBtnLabel, setCopyBtnLabel] = createSignal("Copy as Markdown");

  const showEmpty = () =>
    !loading() && !error() && state().status === "no-results";
  const resultsItems = () => {
    const s = state();
    return s.status === "results" ? s.items : [];
  };

  const onProgress = (percent: number, status: string) => {
    setProgressPercent(percent);
    setProgressStatus(status);
  };

  function setUrlParams(
    url: URL,
    {
      pkg,
      isDev,
      limit,
    }: {
      pkg?: string;
      isDev?: boolean;
      limit?: string;
    },
  ) {
    if (pkg === "") {
      url.searchParams.delete("package");
    } else if (pkg) {
      url.searchParams.set("package", pkg);
    }
    if (isDev === false) {
      url.searchParams.delete("dev");
    } else if (isDev) {
      url.searchParams.set("dev", "true");
    }
    if (limit === "" || limit === "200") {
      url.searchParams.delete("limit");
    } else if (limit) {
      url.searchParams.set("limit", limit);
    }
  }

  function updateUrlParams(params: {
    pkg?: string;
    isDev?: boolean;
    limit?: string;
  }) {
    const url = new URL(window.location.href);
    setUrlParams(url, params);
    window.history.pushState({}, "", url);
  }

  function loadParamsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const pkg = params.get("package");
    const dev = params.get("dev");
    const limit = params.get("limit");

    if (pkg) setPkgInput(pkg);
    if (dev === "true") setIsDev(true);
    if (limit) setLimitInput(limit);

    if (pkg) startAnalysis(true);
  }

  async function startAnalysis(replaceState = false) {
    const pkg = pkgInput().trim();
    if (!pkg) return;

    setLoading(true);
    setError("");
    setState({ status: "no-results" });
    onProgress(10, "Initializing...");

    try {
      const [pkgName, requestedRange] = getPackageNameAndVersion(pkg);
      const dev = isDev();
      const limit = parseInt(limitInput(), 10) || 200;

      if (replaceState) {
        const url = new URL(window.location.href);
        setUrlParams(url, { pkg, isDev: dev, limit: limit.toString() });
        window.history.replaceState({}, "", url);
      } else {
        updateUrlParams({ pkg, isDev: dev, limit: limit.toString() });
      }

      onProgress(20, "Fetching package metadata...");
      const pkgSize = await getBasePackageSize(pkgName);
      const sortedDeps = await getSortedDependents(pkgName, {
        isDev: dev,
        onProgress,
      });
      onProgress(99, "Calculating traffic and versions...");

      const items = sortedDeps
        .filter((d) => {
          if (!requestedRange) return true;
          if (d.v === requestedRange) return true;
          if (d.v === "*" || requestedRange === "*") return true;
          try {
            return semver.intersects(d.v, requestedRange);
          } catch {
            return false;
          }
        })
        .map((d) => ({
          name: d.n,
          version: d.v,
          downloads: d.d,
          traffic: d.d * pkgSize,
        }))
        .slice(0, limit);

      setState(
        items.length > 0
          ? { status: "results", items }
          : { status: "no-results" },
      );
      onProgress(100, "Analysis complete");
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copyAsMarkdown() {
    const currentState = state();
    if (currentState.status !== "results") return;

    let md = "";
    if (!isDev()) {
      md += "| # | Downloads/month | Traffic | Version | Package |\n";
      md += "|---|-----------------|---------|---------|---------|\n";
    } else {
      md += "| # | Downloads/month | Package |\n";
      md += "|---|-----------------|---------|\n";
    }

    currentState.items.forEach((pkg, i) => {
      const indexStr = `${i + 1}`;
      const downloadsStr = formatDownloads(pkg.downloads);
      const trafficStr = formatTraffic(pkg.traffic);
      const versionStr = pkg.version || "any";
      const pkgLink = `[${pkg.name}](https://npmx.dev/${pkg.name})`;

      if (!isDev()) {
        md += escapeMdTable`| ${indexStr} | ${downloadsStr} | ${trafficStr} | ${versionStr} | ${pkgLink} |\n`;
      } else {
        md += escapeMdTable`| ${indexStr} | ${downloadsStr} | ${pkgLink} |\n`;
      }
    });

    try {
      await navigator.clipboard.writeText(md);
      setCopyBtnLabel("Copied!");
    } catch {
      setCopyBtnLabel("Failed to copy");
    }
    setTimeout(() => setCopyBtnLabel("Copy as Markdown"), 1000);
  }

  onMount(() => {
    window.addEventListener("popstate", loadParamsFromUrl);
    loadParamsFromUrl();
  });

  return (
    <div class="max-w-6xl mx-auto p-4 md:p-8">
      <header class="mb-10 text-center">
        <h1 class="text-4xl font-extrabold text-slate-800 dark:text-white mb-2">
          dependents.dev
        </h1>
        <p class="text-slate-600 dark:text-slate-400 italic">
          Analyze package dependents, downloads, and traffic across the
          ecosystem.
        </p>
      </header>

      <div class="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm mb-8 border border-slate-200 dark:border-slate-800">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div class="lg:col-span-2">
            <label
              class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1"
              for="pkgInput"
            >
              Package Name (@version optional)
            </label>
            <input
              type="text"
              id="pkgInput"
              placeholder="e.g. lodash or @types/node@18"
              class="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all dark:text-white"
              value={pkgInput()}
              onInput={(e) => setPkgInput(e.currentTarget.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") startAnalysis();
              }}
            />
          </div>
          <div>
            <label
              class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1"
              for="limitInput"
            >
              Limit Results (max 3000)
            </label>
            <input
              type="number"
              id="limitInput"
              value={limitInput()}
              onInput={(e) => setLimitInput(e.currentTarget.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") startAnalysis();
              }}
              class="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
            />
          </div>
          <button
            id="searchBtn"
            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            onClick={() => startAnalysis()}
            disabled={loading()}
          >
            <span>Analyze</span>
            <svg
              id="searchIcon"
              class="w-4 h-4"
              classList={{ hidden: loading() }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <svg
              id="loadingIcon"
              class="animate-spin h-4 w-4 text-white"
              classList={{ hidden: !loading() }}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </button>
        </div>

        <div class="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label class="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              id="devCheckbox"
              class="w-4 h-4 text-blue-600 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
              checked={isDev()}
              onChange={(e) => {
                setIsDev(e.currentTarget.checked);
                updateUrlParams({ isDev: e.currentTarget.checked });
              }}
            />
            <span class="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
              Use devDependencies
            </span>
          </label>
        </div>
      </div>

      <Show when={!!error()}>
        <div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
          {error()}
        </div>
      </Show>

      <Show when={loading()}>
        <div class="mb-6">
          <div class="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            <span>{progressStatus()}</span>
            <span>{progressPercent()}%</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
            <div
              class="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent()}%` }}
            />
          </div>
        </div>
      </Show>

      <Show when={state().status === "results"}>
        <div>
          <div class="flex justify-between items-center mb-4">
            <div class="flex items-center gap-4">
              <h2 class="text-xl font-bold text-slate-800 dark:text-white">
                Results
              </h2>
              <div class="text-sm text-slate-500 dark:text-slate-400">
                Showing {resultsItems().length} packages
              </div>
            </div>
            <button
              id="copyMarkdownBtn"
              class="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold py-1.5 px-3 rounded border border-slate-300 dark:border-slate-600 transition-colors flex items-center gap-1.5 cursor-pointer"
              type="button"
              onClick={copyAsMarkdown}
            >
              <svg
                class="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                />
              </svg>
              <span>{copyBtnLabel()}</span>
            </button>
          </div>
          <div class="table-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 uppercase text-xs font-bold">
                <tr>
                  <th class="px-6 py-3">#</th>
                  <th class="px-6 py-3">Downloads/mo</th>
                  <th class="px-6 py-3" classList={{ hidden: isDev() }}>
                    Traffic
                  </th>
                  <th class="px-6 py-3" classList={{ hidden: isDev() }}>
                    Version Satisfied
                  </th>
                  <th class="px-6 py-3">Package</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                <For each={resultsItems()}>
                  {(pkg, i) => (
                    <tr class="hover:bg-slate-50 transition-colors">
                      <td class="px-6 py-4 text-slate-400 font-medium">
                        {i() + 1}
                      </td>
                      <td class="px-6 py-4 font-bold text-slate-700">
                        {formatDownloads(pkg.downloads)}
                      </td>
                      <td
                        class="px-6 py-4 font-mono text-slate-500"
                        classList={{ hidden: isDev() }}
                      >
                        {formatTraffic(pkg.traffic)}
                      </td>
                      <td class="px-6 py-4" classList={{ hidden: isDev() }}>
                        <span class="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                          {pkg.version || "any"}
                        </span>
                      </td>
                      <td class="px-6 py-4">
                        <a
                          href={`https://npmx.dev/${pkg.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-blue-600 hover:underline font-medium"
                        >
                          {pkg.name}
                        </a>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      <Show when={state().status === "initial"}>
        <div class="text-center py-20 bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <svg
            class="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p class="mt-4 text-slate-500 dark:text-slate-400 font-medium">
            Enter a package name to start analysis.
          </p>
        </div>
      </Show>
      <Show when={showEmpty()}>
        <div class="text-center py-20 bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <svg
            class="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p class="mt-4 text-slate-500 dark:text-slate-400 font-medium">
            No{isDev() ? " dev" : ""} dependents were found for this package
          </p>
        </div>
      </Show>
    </div>
  );
}
