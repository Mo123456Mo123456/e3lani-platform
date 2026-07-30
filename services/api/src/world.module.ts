import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  OnModuleInit,
  Param,
  ParseIntPipe,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import {
  BIOMES,
  CONTRIBUTION_CATEGORIES,
  type ContributionAnalysis,
  type ContributionCategory,
  type ContributionIdea,
  type DeltaUpdate,
  type WorldState,
} from "@planet/shared-types";
import {
  addContribution,
  analyzeContribution,
  generateWorld,
  previewContribution,
  runTick,
} from "@planet/simulation-models";
import { IsIn, IsInt, IsString, Length, Max, Min } from "class-validator";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
import {
  AccessTokenGuard,
  AuthModule,
  AuthService,
  CurrentUser,
  RoleGuard,
  Roles,
} from "./auth.module.js";
import { DatabaseService } from "./database.service.js";

class AnalyzeContributionDto {
  @IsIn(CONTRIBUTION_CATEGORIES)
  category!: ContributionCategory;

  @IsString()
  @Length(8, 2_000)
  text!: string;

  @IsIn(["ar", "en"])
  locale: "ar" | "en" = "ar";
}

class PreviewContributionDto extends AnalyzeContributionDto {
  @IsString()
  regionId!: string;

  @IsInt()
  @Min(16)
  @Max(256)
  simulationRuns = 64;
}

class ConfirmContributionDto extends PreviewContributionDto {}

class TickDto {
  @IsIn([1, 10])
  yearsPerTick: 1 | 10 = 1;
}

const analysisSchema = z.object({
  category: z.enum(CONTRIBUTION_CATEGORIES),
  name: z.string().min(2).max(120),
  description: z.string().min(8).max(2_000),
  traits: z.object({
    size: z.number().min(0).max(1),
    growthRate: z.number().min(0).max(1),
    waterNeed: z.number().min(0).max(1),
    pollutionAbsorption: z.number().min(0).max(1),
    nightLuminosity: z.number().min(0).max(1),
    coldResistance: z.number().min(0).max(1),
    heatResistance: z.number().min(0).max(1),
    adaptability: z.number().min(0).max(1),
    reproductionRate: z.number().min(0).max(1),
    aggression: z.number().min(0).max(1),
  }),
  possibleBiomes: z.array(z.enum(BIOMES)).min(1),
  risks: z.array(z.string().max(120)).max(20),
  moderation: z.object({
    accepted: z.boolean(),
    flags: z.array(z.string()),
    reason: z.string().optional(),
  }),
  balance: z.object({
    score: z.number().min(0).max(1),
    adjustments: z.array(z.string()),
  }),
  provider: z.string(),
  sandbox: z.boolean(),
});

@Injectable()
export class WorldService implements OnModuleInit {
  private state!: WorldState;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly database: DatabaseService,
    private readonly gateway: WorldGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    const seed = process.env.PLANET_SEED ?? "KA-2026-07";
    const stored = await this.database.loadLatestWorld(seed);
    if (stored) {
      this.state = stored;
      return;
    }
    this.state = generateWorld(seed, Number(process.env.PLANET_REGION_COUNT ?? 768));
    await this.database.saveWorld(this.state, this.state.latestEvents);
  }

  getState(): WorldState {
    return structuredClone(this.state);
  }

  getRegion(regionId: string) {
    const region = this.state.regions.find((item) => item.id === regionId);
    if (!region) throw new NotFoundException("REGION_NOT_FOUND");
    return {
      region,
      civilization: this.state.civilizations.find((item) => item.regionId === regionId) ?? null,
      contributions: this.state.contributions.filter((item) => item.regionId === regionId),
      events: this.state.latestEvents.filter((item) => item.regionId === regionId).slice(-30),
    };
  }

  async listEvents(limit = 50, beforeSequence?: number) {
    return this.database.listEvents(this.state.planet.id, Math.min(100, Math.max(1, limit)), beforeSequence);
  }

  async analyze(idea: ContributionIdea): Promise<ContributionAnalysis> {
    const orchestratorUrl = process.env.AI_ORCHESTRATOR_URL;
    if (orchestratorUrl) {
      try {
        const response = await fetch(`${orchestratorUrl}/v1/contributions/analyze`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(idea),
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) throw new Error(`AI_ORCHESTRATOR_${response.status}`);
        return analysisSchema.parse(await response.json());
      } catch (error) {
        if (process.env.AI_PROVIDER !== "mock") {
          throw new ServiceUnavailableException({
            code: "AI_ORCHESTRATOR_UNAVAILABLE",
            message: "The configured AI provider did not return validated structured output.",
          });
        }
      }
    }
    if (process.env.AI_PROVIDER !== "mock") {
      throw new ServiceUnavailableException("AI_PROVIDER_NOT_CONFIGURED");
    }
    return analyzeContribution(idea, "deterministic-sandbox");
  }

  async preview(input: PreviewContributionDto) {
    const analysis = await this.analyze(input);
    const region = this.state.regions.find((item) => item.id === input.regionId);
    if (!region) throw new NotFoundException("REGION_NOT_FOUND");
    try {
      return previewContribution(
        this.state.planet.seed,
        analysis,
        region,
        input.simulationRuns,
      );
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  async confirm(ownerId: string, input: ConfirmContributionDto) {
    return this.serialized(async () => {
      const analysis = await this.analyze(input);
      const region = this.state.regions.find((item) => item.id === input.regionId);
      if (!region) throw new NotFoundException("REGION_NOT_FOUND");
      const preview = previewContribution(
        this.state.planet.seed,
        analysis,
        region,
        input.simulationRuns,
      );
      const contributionResult = addContribution(this.state, ownerId, analysis, input.regionId);
      const startedAt = performance.now();
      const tickResult = runTick(contributionResult.state, 1);
      const events = [...contributionResult.events, ...tickResult.events];
      const changedRegionIds = [
        ...new Set([
          ...contributionResult.delta.changedRegions.map((item) => item.id),
          ...tickResult.delta.changedRegions.map((item) => item.id),
        ]),
      ];
      await this.database.saveWorld(
        tickResult.state,
        events,
        changedRegionIds,
        Math.round(performance.now() - startedAt),
      );
      this.state = tickResult.state;
      const delta: DeltaUpdate = {
        sequence: events.at(-1)?.sequence ?? this.state.planet.eventCount,
        tick: this.state.planet.tick,
        changedRegions: tickResult.delta.changedRegions,
        events,
      };
      this.gateway.publishDelta(delta);
      return {
        contribution: this.state.contributions.at(-1),
        preview,
        events,
        planet: this.state.planet,
      };
    });
  }

  async tick(yearsPerTick: 1 | 10) {
    return this.serialized(async () => {
      const startedAt = performance.now();
      const result = runTick(this.state, yearsPerTick);
      await this.database.saveWorld(
        result.state,
        result.events,
        result.delta.changedRegions.map((item) => item.id),
        Math.round(performance.now() - startedAt),
      );
      this.state = result.state;
      this.gateway.publishDelta(result.delta);
      return { planet: this.state.planet, delta: result.delta };
    });
  }

  private async serialized<T>(operation: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.mutationQueue;
    this.mutationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

@WebSocketGateway({
  namespace: "/world",
  cors: {
    origin: process.env.WEB_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  },
  transports: ["websocket"],
})
export class WorldGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly auth: AuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      typeof client.handshake.auth.token === "string" ? client.handshake.auth.token : undefined;
    if (!token) {
      client.data.access = "read-only";
      return;
    }
    try {
      client.data.user = await this.auth.verifyAccessToken(token);
      client.data.access = "authenticated";
    } catch {
      client.emit("world.error", { code: "INVALID_ACCESS_TOKEN" });
      client.disconnect(true);
    }
  }

  @SubscribeMessage("world.subscribe")
  subscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { planetId?: string }) {
    client.join(body.planetId ?? "primary-world");
    return { subscribed: true, mode: client.data.access };
  }

  publishDelta(delta: DeltaUpdate): void {
    this.server?.emit("world.delta", delta);
  }
}

@ApiTags("world")
@Controller()
class WorldController {
  constructor(private readonly world: WorldService) {}

  @Get("world")
  state() {
    return this.world.getState();
  }

  @Get("world/regions/:regionId")
  region(@Param("regionId") regionId: string) {
    return this.world.getRegion(regionId);
  }

  @Get("world/events")
  events(
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("before", new ParseIntPipe({ optional: true })) before?: number,
  ) {
    return this.world.listEvents(limit, before);
  }

  @Post("contributions/analyze")
  analyze(@Body() input: AnalyzeContributionDto) {
    return this.world.analyze(input);
  }

  @Post("contributions/preview")
  preview(@Body() input: PreviewContributionDto) {
    return this.world.preview(input);
  }

  @Post("contributions/confirm")
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  confirm(@CurrentUser() user: { id: string }, @Body() input: ConfirmContributionDto) {
    return this.world.confirm(user.id, input);
  }

  @Post("simulation/tick")
  @ApiBearerAuth()
  @Roles("simulation_admin", "system_admin")
  @UseGuards(AccessTokenGuard, RoleGuard)
  tick(@Body() input: TickDto) {
    return this.world.tick(input.yearsPerTick);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [WorldController],
  providers: [WorldService, WorldGateway],
  exports: [WorldService],
})
export class WorldModule {}
