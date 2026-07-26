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

  const isInitial = () => state().status === "initial";
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
    setIsDev(dev === "true");
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
      const limit = Math.min(
        3000,
        Math.max(1, parseInt(limitInput(), 10) || 200),
      );

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
    <>
      <div class="bg-slate-900/80 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-xl mb-10 border border-slate-800/80">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-end">
          <div class="lg:col-span-2">
            <label
              class="block text-xs font-semibold tracking-wider uppercase text-slate-400 mb-2"
              for="pkgInput"
            >
              Package Name (@version optional)
            </label>
            <input
              type="text"
              id="pkgInput"
              placeholder="e.g. lodash or @types/node@18"
              class="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none transition-all duration-200 shadow-inner"
              value={pkgInput()}
              onInput={(e) => setPkgInput(e.currentTarget.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") startAnalysis();
              }}
            />
          </div>
          <div>
            <label
              class="block text-xs font-semibold tracking-wider uppercase text-slate-400 mb-2"
              for="limitInput"
            >
              Limit Results (max 3000)
            </label>
            <div class="flex">
              <button
                type="button"
                aria-label="Decrease limit by 50"
                onClick={() => {
                  const current = parseInt(limitInput(), 10) || 0;
                  setLimitInput(Math.max(1, current - 50).toString());
                }}
                class="px-4 text-lg font-medium bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center rounded-l-xl border border-r-0 border-slate-800"
              >
                −
              </button>
              <input
                type="number"
                id="limitInput"
                min="1"
                max="3000"
                step="50"
                value={limitInput()}
                onInput={(e) => {
                  const next = Math.min(
                    3000,
                    Math.max(1, parseInt(e.currentTarget.value, 10) || 1),
                  );
                  setLimitInput(next.toString());
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter") startAnalysis();
                }}
                class="w-full px-4 py-2.5 text-center bg-slate-950/60 border border-l-0 border-r-0 border-slate-800 text-slate-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none transition-all duration-200 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label="Increase limit by 50"
                onClick={() => {
                  const current = parseInt(limitInput(), 10) || 0;
                  setLimitInput(Math.min(3000, current + 50).toString());
                }}
                class="px-4 text-lg font-medium bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center rounded-r-xl border border-l-0 border-slate-800"
              >
                +
              </button>
            </div>
          </div>
          <button
            id="searchBtn"
            class="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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

        <div class="mt-6 pt-5 border-t border-slate-800/80 flex items-center">
          <label class="inline-flex items-center gap-3 cursor-pointer group select-none">
            <input
              type="checkbox"
              id="devCheckbox"
              class="sr-only peer"
              checked={isDev()}
              onChange={(e) => {
                setIsDev(e.currentTarget.checked);
                updateUrlParams({ isDev: e.currentTarget.checked });
                if (pkgInput().trim()) startAnalysis();
              }}
            />
            <div class="w-5 h-5 rounded-md bg-slate-950/80 border border-slate-700/80 peer-checked:bg-blue-600 peer-checked:border-blue-500 flex items-center justify-center transition-all duration-200 group-hover:border-slate-500 peer-checked:group-hover:border-blue-400 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/50 shadow-inner">
              <Show when={isDev()}>
                <svg
                  class="w-3.5 h-3.5 text-white pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="3"
                >
                  <title>Checkmark</title>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </Show>
            </div>
            <span class="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
              Use devDependencies
            </span>
          </label>
        </div>
      </div>

      <Show when={!!error()}>
        <div class="mb-8 p-4 bg-red-950/40 border border-red-800/60 text-red-300 rounded-xl shadow-lg flex items-center gap-3">
          <svg
            class="w-5 h-5 text-red-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            role="img"
            aria-label="Error"
          >
            <title>Error</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span class="text-sm font-medium">{error()}</span>
        </div>
      </Show>

      <Show when={loading()}>
        <div class="mb-8 px-2">
          <div class="flex justify-between text-xs font-medium text-slate-400 mb-2">
            <span>{progressStatus()}</span>
            <span>{progressPercent()}%</span>
          </div>
          <div class="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div
              class="bg-blue-500 h-1.5 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(59,130,246,0.6)]"
              style={{ width: `${progressPercent()}%` }}
            />
          </div>
        </div>
      </Show>

      <Show when={state().status === "results"}>
        <div>
          <div class="flex justify-between items-center mb-5 px-1">
            <div class="flex items-baseline gap-3">
              <h2 class="text-xl font-semibold text-white tracking-tight">
                Results
              </h2>
              <span class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                {resultsItems().length} packages
              </span>
            </div>
            <button
              id="copyMarkdownBtn"
              class="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-medium py-2 px-3.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-all duration-150 flex items-center gap-2 cursor-pointer shadow-sm"
              type="button"
              onClick={copyAsMarkdown}
            >
              <svg
                class="w-3.5 h-3.5 text-slate-400"
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
          <div class="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl shadow- overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-950/50 border-b border-slate-800/80 text-slate-400 uppercase text-[11px] font-semibold tracking-wider">
                <tr class="h-12">
                  <th class="px-6 py-4 w-16 text-slate-500">#</th>
                  <th class="px-6 py-4">Downloads/mo</th>
                  <th class="px-6 py-4" classList={{ hidden: isDev() }}>
                    Traffic
                  </th>
                  <th class="px-6 py-4" classList={{ hidden: isDev() }}>
                    Version Satisfied
                  </th>
                  <th class="px-6 py-4">Package</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50 text-sm">
                <For each={resultsItems()}>
                  {(pkg, i) => (
                    <tr class="hover:bg-slate-800/40 transition-colors duration-150 h-14">
                      <td class="px-6 py-4 text-slate-400 font-mono text-xs">
                        {i() + 1}
                      </td>
                      <td class="px-6 py-4 text-slate-300 font-medium">
                        {formatDownloads(pkg.downloads)}
                      </td>
                      <td
                        class="px-6 py-4 text-slate-300 font-medium"
                        classList={{ hidden: isDev() }}
                      >
                        {formatTraffic(pkg.traffic)}
                      </td>
                      <td class="px-6 py-4" classList={{ hidden: isDev() }}>
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-slate-800/80 text-blue-400 border border-slate-700/50">
                          {pkg.version || "any"}
                        </span>
                      </td>
                      <td class="px-6 py-4">
                        <a
                          href={`https://npmx.dev/${pkg.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors"
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

      <Show when={isInitial() || showEmpty()}>
        <div class="text-center py-20 bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-dashed border-slate-800">
          <svg
            class="mx-auto h-10 w-10 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p class="mt-3 text-sm text-slate-400 font-medium">
            {isInitial()
              ? "Enter a package name to start analysis."
              : `No${isDev() ? " dev" : ""} dependents were found for this package`}
          </p>
        </div>
      </Show>
    </>
  );
}
