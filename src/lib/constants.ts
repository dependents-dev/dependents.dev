const NPM_REGISTRY_BASE_URL = "https://registry.npmmirror.com";
const REGISTRY_URL = "https://npm.devminer.xyz/registry";
const LIVE_REGISTRY_URL = "https://npm.devminer.xyz/live_registry";

const MIN_PACKAGES_FOR_BATCH_MODE = 6000;
const MAX_BATCHES = 20;
const MIN_BATCH_SIZE = 3000;

export {
  LIVE_REGISTRY_URL,
  MAX_BATCHES,
  MIN_BATCH_SIZE,
  MIN_PACKAGES_FOR_BATCH_MODE,
  NPM_REGISTRY_BASE_URL,
  REGISTRY_URL,
};
