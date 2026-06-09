import { escapeMdTable, formatDownloads, formatTraffic } from "./util";

const elements = {
  pkgInput: document.getElementById("pkgInput") as HTMLInputElement,
  limitInput: document.getElementById("limitInput") as HTMLInputElement,
  devCheckbox: document.getElementById("devCheckbox") as HTMLInputElement,
  searchBtn: document.getElementById("searchBtn") as HTMLButtonElement,
  searchIcon: document.getElementById("searchIcon") as SVGSVGElement &
    HTMLElement,
  loadingIcon: document.getElementById("loadingIcon") as SVGSVGElement &
    HTMLElement,
  errorBox: document.getElementById("errorBox") as HTMLDivElement,
  resultsArea: document.getElementById("resultsArea") as HTMLDivElement,
  resultsTableBody: document.getElementById(
    "resultsTableBody",
  ) as HTMLTableElement,
  emptyState: document.getElementById("emptyState") as HTMLDivElement,
  trafficHeader: document.getElementById(
    "trafficHeader",
  ) as HTMLTableCellElement,
  versionHeader: document.getElementById(
    "versionHeader",
  ) as HTMLTableCellElement,
  progressBar: document.getElementById("progressBar") as HTMLDivElement,
  percentLabel: document.getElementById("percentLabel") as HTMLSpanElement,
  statusLabel: document.getElementById("statusLabel") as HTMLSpanElement,
  progressIndicator: document.getElementById(
    "progressIndicator",
  ) as HTMLDivElement,
  totalStats: document.getElementById("totalStats") as HTMLDivElement,
  copyMarkdownBtn: document.getElementById(
    "copyMarkdownBtn",
  ) as HTMLButtonElement,
  copyBuffer: document.getElementById("copyBuffer") as HTMLTextAreaElement,
};

function setLoading(val: boolean) {
  elements.searchBtn.disabled = val;
  elements.searchIcon.classList.toggle("hidden", val);
  elements.loadingIcon.classList.toggle("hidden", !val);
  elements.progressIndicator.classList.toggle("hidden", !val);
  if (val) {
    elements.errorBox.classList.add("hidden");
  }
}

function updateProgress(percent: number, status: string) {
  elements.progressBar.style.width = `${percent}%`;
  elements.percentLabel.textContent = `${percent}%`;
  elements.statusLabel.textContent = status;
}

function showError(msg: string) {
  elements.errorBox.textContent = msg;
  elements.errorBox.classList.remove("hidden");
  elements.resultsArea.classList.add("hidden");
  elements.emptyState.classList.remove("hidden");
}

interface AnalysisResult {
  name: string;
  version: string;
  downloads: number;
  traffic: number;
}

function displayResults(data: AnalysisResult[], isDev?: boolean) {
  elements.resultsTableBody.innerHTML = "";

  elements.trafficHeader.classList.toggle("hidden", isDev);
  elements.versionHeader.classList.toggle("hidden", isDev);

  elements.resultsArea.classList.remove("hidden");
  elements.emptyState.classList.add("hidden");

  elements.totalStats.textContent = `Showing ${data.length} packages`;

  data.forEach((pkg, i) => {
    const row = document.createElement("tr");
    row.className = "hover:bg-slate-50 transition-colors";

    const trafficCell = isDev
      ? ""
      : `<td class="px-6 py-4 font-mono text-slate-500">${formatTraffic(pkg.traffic)}</td>`;
    const versionCell = isDev
      ? ""
      : `<td class="px-6 py-4"><span class="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">${pkg.version || "any"}</span></td>`;

    row.innerHTML = `
      <td class="px-6 py-4 text-slate-400 font-medium">${i + 1}</td>
      <td class="px-6 py-4 font-bold text-slate-700">${formatDownloads(pkg.downloads)}</td>
      ${trafficCell}
      ${versionCell}
      <td class="px-6 py-4">
        <a href="https://npmx.dev/${pkg.name}" target="_blank" class="text-blue-600 hover:underline font-medium">
          ${pkg.name}
        </a>
      </td>
    `;
    elements.resultsTableBody.appendChild(row);
  });
}

function copyMarkdown(results: AnalysisResult[]) {
  if (!results.length) return;

  const isDev = elements.devCheckbox.checked;
  let md = "";

  if (!isDev) {
    md += `| # | Downloads/month | Traffic | Version | Package |\n`;
    md += `|---|-----------------|---------|---------|---------|\n`;
  } else {
    md += `| # | Downloads/month | Package |\n`;
    md += `|---|-----------------|---------|\n`;
  }

  results.forEach((pkg, i) => {
    const indexStr = `${i + 1}`;
    const downloadsStr = formatDownloads(pkg.downloads);
    const trafficStr = formatTraffic(pkg.traffic);
    const versionStr = pkg.version || "any";
    const pkgLink = `[${pkg.name}](https://npmx.dev/${pkg.name})`;

    if (!isDev) {
      md += escapeMdTable`| ${indexStr} | ${downloadsStr} | ${trafficStr} | ${versionStr} | ${pkgLink} |\n`;
    } else {
      md += escapeMdTable`| ${indexStr} | ${downloadsStr} | ${pkgLink} |\n`;
    }
  });

  elements.copyBuffer.value = md;
  elements.copyBuffer.select();
  document.execCommand("copy");

  const btn = elements.copyMarkdownBtn;
  const originalText = btn.innerHTML;
  btn.innerHTML = "<span>Copied!</span>";
  setTimeout(() => {
    btn.innerHTML = originalText;
  }, 2000);
}

export type { AnalysisResult };
export {
  copyMarkdown,
  displayResults,
  elements,
  setLoading,
  showError,
  updateProgress,
};
