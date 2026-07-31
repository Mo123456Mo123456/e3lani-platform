import { Body, Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";

const INTERNAL_TOKEN = process.env["INTERNAL_TOKEN"] ?? "dev-internal-token";

function checkToken(header?: string): void {
  if (header !== INTERNAL_TOKEN) throw new UnauthorizedException("invalid_internal_token");
}

/** Service-to-service endpoints (worker fan-out, world registration). */
@Controller("internal")
export class InternalController {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  @Post("notify-impact")
  async notifyImpact(
    @Headers("x-internal-token") token: string,
    @Body() body: {
      planetId: string;
      contributionId: string;
      eventSeq: number;
      type: string;
      title: string;
      body: string;
    },
  ) {
    checkToken(token);
    const contribution = await this.prisma.userContribution.findUnique({
      where: { id: body.contributionId },
      select: { userId: true },
    });
    if (!contribution) return { delivered: false };
    const notification = await this.notifications.create({
      userId: contribution.userId,
      planetId: body.planetId,
      type: body.type,
      title: body.title,
      body: body.body,
      eventSeq: body.eventSeq,
    });
    return { delivered: true, id: notification.id };
  }

  @Post("planets/register")
  async registerPlanet(
    @Headers("x-internal-token") token: string,
    @Body() body: {
      id: string;
      name: string;
      seed: number;
      yearsPerTick: number;
      gridWidth: number;
      gridHeight: number;
    },
  ) {
    checkToken(token);
    const planet = await this.prisma.planet.upsert({
      where: { id: body.id },
      create: {
        id: body.id,
        name: body.name,
        seed: body.seed,
        yearsPerTick: body.yearsPerTick,
        gridWidth: body.gridWidth,
        gridHeight: body.gridHeight,
        status: "running",
      },
      update: {},
    });
    return { id: planet.id, registered: true };
  }
}
