function formatTraffic(bytes: number) {
  if (bytes >= 1e15) return `${(bytes / 1e15).toFixed(2)} PB`;
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;
  return `${bytes} bytes`;
}

function formatDownloads(downloads: number) {
  if (downloads >= 1e9) return `${(downloads / 1e9).toFixed(2)}B`;
  if (downloads >= 1e6) return `${(downloads / 1e6).toFixed(2)}M`;
  if (downloads >= 1e3) return `${(downloads / 1e3).toFixed(2)}k`;
  return downloads.toString();
}

const reg = /[|`\\_]/g;
function escapeMdTable(str: TemplateStringsArray, ...values: string[]) {
  return String.raw({ raw: str }, ...values.map((v) => v.replace(reg, "\\$&")));
}

const hash = (str: string) => {
  let h = 5381;
  let i = str.length;
  while (i) h = (h * 33) ^ str.charCodeAt(--i);
  return (h >>> 0).toString(36);
};

type PackageNameAndVersion = readonly [
  packageName: string,
  version?: string | undefined,
];

function getPackageNameAndVersion(input: string): PackageNameAndVersion {
  const scoped = input.startsWith("@");
  let [packageName, version] = input.split("@");
  if (!packageName) return [""];
  if (scoped) {
    const atPos = input.lastIndexOf("@");
    if (atPos === 0) {
      packageName = input;
      version = undefined;
    } else {
      packageName = input.slice(0, atPos);
      version = input.slice(atPos + 1);
    }
  }
  return [packageName, version?.trim()];
}

export {
  escapeMdTable,
  formatDownloads,
  formatTraffic,
  getPackageNameAndVersion,
  hash,
};
