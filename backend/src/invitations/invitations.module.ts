import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeInvitation } from './entities/employee-invitation.entity';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { PublicInvitationsController } from './public-invitations.controller';
import { EmployeesModule } from '../employees/employees.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Mitarbeiter-Einladung per E-Mail-Link.
 *
 * - `EmployeesModule` liefert den EmployeesService (withSeatGuard) – so teilen
 *   Direkt-Anlage und Einladung EINEN Sitzplatz-Lock + EINE maxUsers-Zaehlregel.
 * - `AuthModule` liefert den AuthService (buildAuthResult -> Auto-Login).
 * - MailService/AuditService/SubscriptionsService kommen aus globalen Modulen.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeeInvitation, User, Tenant]),
    EmployeesModule,
    AuthModule,
  ],
  controllers: [InvitationsController, PublicInvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
