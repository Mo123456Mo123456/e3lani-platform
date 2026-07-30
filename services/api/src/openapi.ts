export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "كوكب يولد أمامك API",
    version: "0.1.0",
    description:
      "واجهة العالم الحي، المحاكاة الحتمية، المساهمات، السيناريوهات، والمصادقة.",
  },
  servers: [{ url: "http://localhost:4000" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Service health",
        responses: { "200": { description: "Healthy" } },
      },
    },
    "/v1/auth/register": {
      post: {
        summary: "Create an account",
        responses: { "201": { description: "Account created" } },
      },
    },
    "/v1/auth/login": {
      post: {
        summary: "Issue an access token and rotating refresh cookie",
        responses: { "200": { description: "Authenticated" } },
      },
    },
    "/v1/world/overview": {
      get: {
        summary: "Get the current world projection",
        responses: { "200": { description: "World overview" } },
      },
    },
    "/v1/contributions/analyze": {
      post: {
        summary: "Moderate, normalize, and balance a contribution",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Structured contribution" } },
      },
    },
    "/v1/contributions/scenarios": {
      post: {
        summary: "Run seeded Monte Carlo future scenarios",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Probabilistic outcomes" } },
      },
    },
    "/v1/contributions": {
      post: {
        summary: "Commit a validated contribution to the event store",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Contribution committed" } },
      },
    },
    "/v1/simulation/tick": {
      post: {
        summary: "Advance one deterministic world tick",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Delta events" } },
      },
    },
    "/v1/simulation/snapshots/{tick}": {
      get: {
        summary: "Get a timeline snapshot",
        parameters: [
          { name: "tick", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Snapshot" } },
      },
    },
  },
} as const;
