const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const isCI = process.env.CI === "true";

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Keep the filesystem cache for local native development, but use virtual
  // modules in CI/static web exports. Metro does not watch node_modules cache
  // files reliably in isolated build runners.
  forceWriteFileSystem: !isCI,
});
