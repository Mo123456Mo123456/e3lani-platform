const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const isIsolatedBuild =
  process.env.CI === "true" ||
  process.env.RENDER === "true" ||
  process.env.NODE_ENV === "production";

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Static/hosted builders can miss generated files under node_modules while
  // Metro is crawling. Use virtual modules there; keep filesystem output only
  // for local native development.
  forceWriteFileSystem: !isIsolatedBuild,
});
