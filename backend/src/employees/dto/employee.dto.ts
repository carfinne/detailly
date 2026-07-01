import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { UserRole, TENANT_ROLLEN } from '../../users/entities/user.entity';

export class CreateEmployeeDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  // NUR Betriebs-Rollen zulassen: eine Plattform-Rolle im Body wird schon hier
  // (Validierung) mit 400 abgelehnt – zusaetzlich zum Service-Guard.
  @ApiProperty({ enum: TENANT_ROLLEN })
  @IsIn(TENANT_ROLLEN)
  role: UserRole;

  @ApiPropertyOptional({ description: 'Interner Stundenlohn in € (fuer Lohnkosten-Auswertung)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  stundenlohn?: number;
}

export class UpdateEmployeeDto extends PartialType(OmitType(CreateEmployeeDto, ['password'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;
}
