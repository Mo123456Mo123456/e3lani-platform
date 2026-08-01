const isProduction = process.env.NODE_ENV === "production";

function configuredValue(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/**
 * Local/test defaults keep tooling deterministic. Production code still fails
 * closed in the SDK when required authentication secrets are not configured.
 */
const appId = configuredValue("VITE_APP_ID") || (isProduction ? "" : "e3lani-local");
const cookieSecret =
  configuredValue("JWT_SECRET") || (isProduction ? "" : "e3lani-local-session-secret");

export const ENV = {
  appId,
  cookieSecret,
  databaseUrl: configuredValue("DATABASE_URL"),
  oAuthServerUrl: configuredValue("OAUTH_SERVER_URL"),
  ownerOpenId: configuredValue("OWNER_OPEN_ID"),
  isProduction,
  forgeApiUrl: configuredValue("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: configuredValue("BUILT_IN_FORGE_API_KEY"),
};
