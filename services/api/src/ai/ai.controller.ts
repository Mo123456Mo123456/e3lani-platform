import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators.js";
import { AiClientService } from "./ai.service.js";

@ApiTags("ai")
@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiClientService) {}

  /** honest provider status — the UI shows a sandbox badge when offline */
  @Public()
  @Get("provider")
  provider() {
    return this.ai.providerInfo;
  }
}
