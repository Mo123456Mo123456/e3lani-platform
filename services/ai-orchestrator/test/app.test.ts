import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { StructuredContributionSchema } from "@planet-born/shared-types";
import { buildApp } from "../src/app.js";
import { MockProvider } from "../src/providers.js";

describe("AI orchestrator", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ provider: new MockProvider() });
    await app.ready();
  });

  afterAll(async () => app.close());

  it("always returns schema-valid structured output", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: {
        idea: "نبات يمتص التلوث من الهواء",
        category: "plant",
        locale: "ar",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(StructuredContributionSchema.safeParse(response.json()).success).toBe(true);
  });

  it("grounds narration exclusively in supplied event titles and IDs", async () => {
    const events = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "نشأة المحيطات",
        titleEn: "Oceans formed",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "ظهور الغابات",
        titleEn: "Forests appeared",
      },
    ];
    const response = await app.inject({
      method: "POST",
      url: "/narrate",
      payload: { locale: "en", events },
    });
    expect(response.statusCode).toBe(200);
    const result = response.json();
    expect(result.summary).toContain("Oceans formed");
    expect(result.summary).toContain("Forests appeared");
    expect(result.groundedEventIds).toEqual(events.map((event) => event.id));
    const titleWords = result.summary
      .replace("Event sequence: ", "")
      .replace(/\.$/, "")
      .split("; ");
    expect(titleWords).toEqual(events.map((event) => event.titleEn));
  });
});
