import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

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

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
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
