const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo support: let Metro resolve packages from the workspace root
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// expo-sqlite v16 uses WebAssembly for web support
config.resolver.assetExts = [...(config.resolver.assetExts ?? []), "wasm"];

// Apply NativeWind first, then add server middleware so it's not overwritten
const nativeWindConfig = withNativeWind(config, { input: "./global.css" });

// SharedArrayBuffer required by wa-sqlite — needs cross-origin isolation headers
nativeWindConfig.server = {
  ...nativeWindConfig.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    return middleware(req, res, next);
  },
};

module.exports = nativeWindConfig;
