import { Body, Controller, Get, Inject, Patch } from "@nestjs/common";
import type { Kysely } from "kysely";
import { AuthService } from "../auth/auth.service";
import type { AccessClaims } from "../auth/jwt.util";
import { CurrentUser } from "../common/auth.guard";
import { DB } from "../db/database.module";
import type { Database } from "../db/kysely.types";

@Controller("users")
export class UsersController {
  constructor(
    private readonly auth: AuthService,
    @Inject(DB) private readonly db: Kysely<Database>,
  ) {}

  @Get("me")
  me(@CurrentUser() user: AccessClaims) {
    return this.auth.getUserDto(user.sub);
  }

  @Patch("me")
  async updateMe(@CurrentUser() user: AccessClaims, @Body() body: { locale?: string; displayName?: string }) {
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (body.locale && ["ar", "en"].includes(body.locale)) updates.locale = body.locale;
    if (body.displayName && body.displayName.length >= 2 && body.displayName.length <= 60) {
      updates.display_name = body.displayName;
    }
    await this.db.updateTable("users").set(updates).where("id", "=", user.sub).execute();
    return this.auth.getUserDto(user.sub);
  }

  @Get("me/dashboard")
  async dashboard(@CurrentUser() user: AccessClaims) {
    const [contributions, impactEvents, affectedCivs, notifications] = await Promise.all([
      this.db
        .selectFrom("user_contributions")
        .where("user_id", "=", user.sub)
        .where("status", "=", "applied")
        .select((eb) => eb.fn.countAll<number>().as("c"))
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("causal_links")
        .innerJoin("user_contributions", "user_contributions.id", "causal_links.contribution_id")
        .where("user_contributions.user_id", "=", user.sub)
        .select((eb) => eb.fn.countAll<number>().as("c"))
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("civilizations")
        .innerJoin("user_contributions", "user_contributions.id", "civilizations.contribution_id")
        .where("user_contributions.user_id", "=", user.sub)
        .select((eb) => eb.fn.countAll<number>().as("c"))
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("notifications")
        .where("user_id", "=", user.sub)
        .where("read", "=", false)
        .select((eb) => eb.fn.countAll<number>().as("c"))
        .executeTakeFirstOrThrow(),
    ]);
    const profile = await this.db
      .selectFrom("profiles")
      .select(["impact_score", "achievements"])
      .where("user_id", "=", user.sub)
      .executeTakeFirst();
    return {
      appliedContributions: Number(contributions.c),
      descendantEvents: Number(impactEvents.c),
      civilizationsFounded: Number(affectedCivs.c),
      unreadNotifications: Number(notifications.c),
      impactScore: profile?.impact_score ?? 0,
      achievements: (profile?.achievements as unknown as string[]) ?? [],
    };
  }
}
