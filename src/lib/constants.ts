const npmRegistryBaseUrl = "https://registry.npmmirror.com";
const registryUrl = "https://npm.devminer.xyz/registry";
const liveRegistryUrl = "https://npm.devminer.xyz/live_registry";

const MIN_PACKAGES_FOR_BATCH_MODE = 6000;
const MAX_BATCHES = 20;
const MIN_BATCH_SIZE = 3000;

export {
  liveRegistryUrl,
  MAX_BATCHES,
  MIN_BATCH_SIZE,
  MIN_PACKAGES_FOR_BATCH_MODE,
  npmRegistryBaseUrl,
  registryUrl,
};
