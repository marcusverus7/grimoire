const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo: watch all workspace packages
config.watchFolders = [monorepoRoot];

// Monorepo: resolve node_modules from both app and root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// expo-sqlite web worker needs .wasm files
config.resolver.assetExts = [...(config.resolver.assetExts || []), "wasm"];

module.exports = withNativeWind(config, { input: "./global.css" });
