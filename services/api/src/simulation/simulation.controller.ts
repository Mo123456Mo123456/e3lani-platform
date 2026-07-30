import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { RollbackDto, SimulationTickDto } from "./dto/simulation.dto";
import { SimulationService } from "./simulation.service";

@ApiTags("simulation")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("simulation")
export class SimulationController {
  constructor(private readonly simulation: SimulationService) {}

  @Post(":planetId/tick")
  @Roles("simulation_manager", "system_admin", "super_admin")
  tick(@Param("planetId") planetId: string, @Body() dto: SimulationTickDto) {
    return this.simulation.tick(planetId, dto);
  }

  @Post(":planetId/rollback")
  @Roles("simulation_manager", "system_admin", "super_admin")
  rollback(@Param("planetId") planetId: string, @Body() dto: RollbackDto) {
    return this.simulation.rollback(planetId, dto);
  }
}
