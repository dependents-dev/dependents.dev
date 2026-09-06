import type { AnalysisResult } from "./results";
import { formatDownloads, formatTraffic } from "./util";

const reg = /[|`\\_]/g;
function escapeMdTable(str: TemplateStringsArray, ...values: string[]) {
  return String.raw({ raw: str }, ...values.map((v) => v.replace(reg, "\\$&")));
}

function getPackageNote(pkg: AnalysisResult): string {
  if (pkg.deprecated) return "Deprecated";
  return "";
}

function buildResultsMarkdownTable(
  items: AnalysisResult[],
  isDev: boolean,
): string {
  const showNotes = items.some((pkg) => getPackageNote(pkg) !== "");

  let md = "";
  if (!isDev) {
    md += `| # | Downloads/month | Traffic | Version | Package |${showNotes ? " Notes |" : ""}\n`;
    md += `|---|-----------------|---------|---------|---------|${showNotes ? "-------|" : ""}\n`;
  } else {
    md += `| # | Downloads/month | Package |${showNotes ? " Notes |" : ""}\n`;
    md += `|---|-----------------|---------|${showNotes ? "-------|" : ""}\n`;
  }

  items.forEach((pkg, i) => {
    const indexStr = `${i + 1}`;
    const downloadsStr = formatDownloads(pkg.downloads);
    const trafficStr = formatTraffic(pkg.traffic);
    const versionStr = pkg.version || "any";
    const pkgLink = `[${pkg.name}](https://npmx.dev/${pkg.name})`;
    const noteStr = getPackageNote(pkg);

    if (!isDev) {
      md += escapeMdTable`| ${indexStr} | ${downloadsStr} | ${trafficStr} | ${versionStr} | ${pkgLink} |`;
    } else {
      md += escapeMdTable`| ${indexStr} | ${downloadsStr} | ${pkgLink} |`;
    }
    if (showNotes) {
      md += escapeMdTable` ${noteStr} |`;
    }
    md += "\n";
  });

  return md;
}

export { buildResultsMarkdownTable, getPackageNote };
