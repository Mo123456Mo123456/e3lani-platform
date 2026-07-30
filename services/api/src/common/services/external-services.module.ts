import { Global, Module } from "@nestjs/common";
import { AiOrchestratorService } from "./ai-orchestrator.service";
import { PythonHttpService } from "./python-http.service";
import { SimulationEngineService } from "./simulation-engine.service";

@Global()
@Module({
  providers: [PythonHttpService, AiOrchestratorService, SimulationEngineService],
  exports: [AiOrchestratorService, SimulationEngineService],
})
export class ExternalServicesModule {}
