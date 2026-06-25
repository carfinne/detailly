import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    // Gleiche Normalisierung wie bei der Registrierung, damit ein Login mit
    // abweichender Gross-/Kleinschreibung auch bei case-sensitiver DB-Collation
    // funktioniert.
    const user = await this.userRepository.findOne({
      where: { email: email.trim().toLowerCase(), isActive: true },
    });
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Ungueltige Anmeldedaten');
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    return this.buildAuthResult(user);
  }

  /**
   * Baut die Standard-Login-Antwort (JWT + reduziertes User-Objekt) fuer einen
   * bereits verifizierten Benutzer. Einzige Quelle der Wahrheit fuer das
   * Token-Payload-Format; wird von login() und der Self-Registrierung genutzt.
   */
  buildAuthResult(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, tenantId: user.tenantId },
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
