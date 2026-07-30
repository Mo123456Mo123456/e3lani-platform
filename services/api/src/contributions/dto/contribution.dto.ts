import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { BIOME_TYPES, ELEMENT_CATEGORIES } from "../../common/domain.constants";

export class AnalyzeContributionDto {
  @ApiProperty({ example: "نبات يضيء ليلا ويغذي التربة" })
  @IsString()
  @Length(3, 5000)
  text!: string;

  @ApiPropertyOptional({ enum: ELEMENT_CATEGORIES })
  @IsOptional()
  @IsIn(ELEMENT_CATEGORIES)
  categoryHint?: string;

  @ApiPropertyOptional({ example: "ar" })
  @IsOptional()
  @IsString()
  locale?: string;
}

export class ElementDto {
  @ApiProperty({ enum: ELEMENT_CATEGORIES })
  @IsIn(ELEMENT_CATEGORIES)
  category!: string;

  @ApiProperty({ example: "Luminous Moss" })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiPropertyOptional({ example: "طحلب مضيء" })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  nameAr?: string;

  @ApiPropertyOptional({ example: "Luminous Moss" })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  nameEn?: string;

  @ApiProperty({ example: "A moss that glows at night and enriches soil." })
  @IsString()
  @Length(3, 2000)
  description!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  traits!: Record<string, unknown>;

  @ApiProperty({ enum: BIOME_TYPES, isArray: true })
  @IsArray()
  @ArrayMaxSize(12)
  @IsIn(BIOME_TYPES, { each: true })
  possibleBiomes!: string[];

  @ApiProperty({ example: ["May spread too quickly"], isArray: true })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  risks!: string[];

  @ApiProperty({ example: ["Improves fertility"], isArray: true })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  benefits!: string[];

  @ApiProperty({ example: 0.82 })
  @Min(0)
  @Max(1)
  balanceScore!: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  wasBalanced?: boolean;

  @ApiPropertyOptional({ isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  balanceNotes?: string[];
}

export class PreviewContributionDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => ElementDto)
  element!: ElementDto;

  @ApiProperty()
  @IsString()
  planetId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regionId?: string;
}

export class CreateContributionDto {
  @ApiProperty()
  @IsString()
  planetId!: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => ElementDto)
  element!: ElementDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regionId?: string;
}
