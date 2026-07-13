import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength, IsBoolean, IsNumber, Min, Max, IsDateString } from 'class-validator';
import {
  UserRole,
  TENANT_ROLLEN,
  EMPLOYEE_FUNKTIONEN,
  EmployeeFunktion,
} from '../../users/entities/user.entity';
import {
  IsKeinTrivialPasswort,
  PASSWORT_MIN_LAENGE,
} from '../../common/validation/password-policy';

export class CreateEmployeeDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  // A3: Mindestlaenge 10 + Trivial-Passwort-Blocklist (common/validation/password-policy).
  @ApiProperty()
  @IsString()
  @MinLength(PASSWORT_MIN_LAENGE)
  @IsKeinTrivialPasswort()
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

  @ApiPropertyOptional({ description: 'Geburtstag als ISO-Datum, z. B. 1990-05-17 (jaehrliche Kalender-Erinnerung)' })
  @IsOptional()
  @IsDateString()
  geburtstag?: string;

  @ApiPropertyOptional({ enum: EMPLOYEE_FUNKTIONEN, description: 'Gewerk-Funktion (erleichtert Planung/Zuordnung)' })
  @IsOptional()
  @IsIn([...EMPLOYEE_FUNKTIONEN])
  funktion?: EmployeeFunktion;
}

export class UpdateEmployeeDto extends PartialType(OmitType(CreateEmployeeDto, ['password'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetPasswordDto {
  // A3: Mindestlaenge 10 + Trivial-Passwort-Blocklist (common/validation/password-policy).
  @ApiProperty()
  @IsString()
  @MinLength(PASSWORT_MIN_LAENGE)
  @IsKeinTrivialPasswort()
  password: string;
}
