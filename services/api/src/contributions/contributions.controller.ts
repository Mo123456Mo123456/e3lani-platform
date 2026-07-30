import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ContributionsService } from "./contributions.service";
import {
  AnalyzeContributionDto,
  CreateContributionDto,
  PreviewContributionDto,
} from "./dto/contribution.dto";

@ApiTags("contributions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("contributions")
export class ContributionsController {
  constructor(private readonly contributions: ContributionsService) {}

  @Post("analyze")
  analyze(@Body() dto: AnalyzeContributionDto, @CurrentUser() user: RequestUser) {
    return this.contributions.analyze(dto, user);
  }

  @Post("preview")
  preview(@Body() dto: PreviewContributionDto) {
    return this.contributions.preview(dto);
  }

  @Post()
  create(@Body() dto: CreateContributionDto, @CurrentUser() user: RequestUser) {
    return this.contributions.create(dto, user);
  }
}
