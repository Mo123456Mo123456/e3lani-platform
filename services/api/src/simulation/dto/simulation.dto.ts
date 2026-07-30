import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class SimulationTickDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  steps?: number;
}

export class RollbackDto {
  @ApiPropertyOptional({ example: 42 })
  @IsInt()
  @Min(0)
  targetTick!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
