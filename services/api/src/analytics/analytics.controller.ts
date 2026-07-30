import { Body, Controller, Inject, Post, UsePipes } from "@nestjs/common";
import type { Kysely } from "kysely";
import { analyticsBatchSchema } from "@planet/validation";
import type { AccessClaims } from "../auth/jwt.util";
import { CurrentUser, Public } from "../common/auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { DB } from "../db/database.module";
import type { Database } from "../db/kysely.types";

@Controller("analytics")
export class AnalyticsController {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  @Public()
  @Post("batch")
  @UsePipes(new ZodValidationPipe(analyticsBatchSchema))
  async batch(
    @CurrentUser() user: AccessClaims | null,
    @Body() body: { events: Array<{ name: string; props?: Record<string, unknown>; at?: string }> },
  ) {
    if (!body.events.length) return { accepted: 0 };
    await this.db
      .insertInto("analytics_events")
      .values(
        body.events.map((e) => ({
          user_id: user?.sub ?? null,
          name: e.name,
          props: (e.props ?? {}) as never,
          at: e.at ? new Date(e.at) : new Date(),
        })),
      )
      .execute();
    return { accepted: body.events.length };
  }
}
