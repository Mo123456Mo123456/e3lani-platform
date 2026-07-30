import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { LAYER_IDS, type LayerId } from "@kawkab/shared-types";
import { CurrentUser, Public, Roles, type AuthUser } from "../common/decorators.js";
import { WorldManager } from "./world-manager.js";
import { WorldsService } from "./worlds.service.js";

@ApiTags("worlds")
@Controller("worlds")
export class WorldsController {
  constructor(
    private readonly worlds: WorldsService,
    private readonly manager: WorldManager,
  ) {}

  @Public()
  @Get()
  list() {
    return this.worlds.listPlanets();
  }

  @ApiOperation({ summary: "Create a new procedurally generated planet (SIM_ADMIN+)" })
  @Roles("SIM_ADMIN", "SYS_ADMIN", "SUPER_ADMIN")
  @Post()
  async create(@Body() body: { name: string; seed?: string; description?: string }, @CurrentUser() user: AuthUser) {
    const seed = body.seed?.trim() || `kawkab-${Date.now().toString(36)}`;
    return this.manager.createPlanet({ name: body.name, seed, description: body.description, createdById: user.id });
  }

  @Public()
  @Get(":id")
  get(@Param("id") id: string) {
    return this.worlds.getPlanet(id);
  }

  @Public()
  @Get(":id/regions/:index")
  region(@Param("id") id: string, @Param("index", ParseIntPipe) index: number) {
    return this.worlds.getRegion(id, index);
  }

  @Public()
  @Get(":id/layers/:layerId")
  layer(@Param("id") id: string, @Param("layerId") layerId: string) {
    if (!(LAYER_IDS as readonly string[]).includes(layerId)) throw new NotFoundException("unknown layer");
    return this.worlds.getLayer(id, layerId as LayerId);
  }

  @Public()
  @Get(":id/civilizations")
  civilizations(@Param("id") id: string) {
    return this.worlds.getCivilizations(id);
  }

  @Public()
  @Get(":id/civilizations/:civId")
  civilization(@Param("id") id: string, @Param("civId") civId: string) {
    return this.worlds.getCivilizationDetail(id, civId);
  }

  @Public()
  @Get(":id/species")
  species(@Param("id") id: string) {
    return this.worlds.getSpeciesList(id);
  }

  @Public()
  @Get(":id/plants")
  plants(@Param("id") id: string) {
    return this.worlds.getPlantsList(id);
  }

  @Public()
  @Get(":id/technologies")
  technologies(@Param("id") id: string) {
    return this.worlds.getTechnologies(id);
  }

  @Public()
  @Get(":id/trade-routes")
  tradeRoutes(@Param("id") id: string) {
    return this.worlds.getTradeRoutes(id);
  }

  @Public()
  @Get(":id/alliances")
  alliances(@Param("id") id: string) {
    return this.worlds.getAlliances(id);
  }

  @Public()
  @Get(":id/wars")
  wars(@Param("id") id: string) {
    return this.worlds.getWars(id);
  }
}
