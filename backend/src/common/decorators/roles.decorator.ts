import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Schraenkt einen Endpunkt auf bestimmte Rollen ein.
 * Verwendung: `@Roles(UserRole.MANAGER, UserRole.OWNER)`.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
