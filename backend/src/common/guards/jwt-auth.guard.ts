import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Standard-JWT-Guard auf Basis der Passport-Strategie. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
