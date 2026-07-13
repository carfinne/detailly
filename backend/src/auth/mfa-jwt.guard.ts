import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MFA_JWT_STRATEGY } from './mfa-jwt.strategy';

/**
 * Guard fuer die zweite Login-Stufe: laesst NUR das kurzlebige mfaPending-Token
 * durch (Claim `mfa:true`). Wird ausschliesslich an `POST /auth/mfa/verify`
 * gehaengt.
 */
@Injectable()
export class MfaJwtGuard extends AuthGuard(MFA_JWT_STRATEGY) {}
