import { IsString, MaxLength, MinLength } from 'class-validator';

/** E-Mail-Bestaetigung einloesen (Token aus dem Bestaetigungs-Link). */
export class VerifyEmailDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;
}
