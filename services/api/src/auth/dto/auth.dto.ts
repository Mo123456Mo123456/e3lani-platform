import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from "class-validator";
import { USER_ROLES } from "../../common/domain.constants";

export class RegisterDto {
  @ApiProperty({ example: "explorer@planet-born.local" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Explorer!2026", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: "Planet Explorer" })
  @IsString()
  @Length(2, 80)
  displayName!: string;

  @ApiPropertyOptional({ example: "ar" })
  @IsOptional()
  @IsString()
  locale?: string;
}

export class LoginDto {
  @ApiProperty({ example: "explorer@planet-born.local" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Explorer!2026" })
  @IsString()
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class UpdateRoleDto {
  @ApiProperty({ enum: USER_ROLES })
  @IsIn(USER_ROLES)
  role!: string;
}
