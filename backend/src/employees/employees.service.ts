import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  private sanitize(user: User) {
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async findAll(tenantId: string) {
    const users = await this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
    return users.map((u) => this.sanitize(u));
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.repo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Mitarbeiter nicht gefunden');
    return this.sanitize(user);
  }

  async create(actor: AuthUser, dto: CreateEmployeeDto) {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('E-Mail-Adresse bereits vergeben');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.repo.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: dto.role,
      tenantId: actor.tenantId,
    });
    const saved = await this.repo.save(user);
    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'create',
      entityType: 'User',
      entityId: saved.id,
      payload: { email: saved.email, role: saved.role },
    });
    return this.sanitize(saved);
  }

  async update(actor: AuthUser, id: string, dto: UpdateEmployeeDto) {
    const user = await this.repo.findOne({ where: { id, tenantId: actor.tenantId } });
    if (!user) throw new NotFoundException('Mitarbeiter nicht gefunden');
    Object.assign(user, dto);
    const saved = await this.repo.save(user);
    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'update',
      entityType: 'User',
      entityId: id,
    });
    return this.sanitize(saved);
  }

  async setPassword(actor: AuthUser, id: string, password: string) {
    const user = await this.repo.findOne({ where: { id, tenantId: actor.tenantId } });
    if (!user) throw new NotFoundException('Mitarbeiter nicht gefunden');
    user.passwordHash = await bcrypt.hash(password, 12);
    await this.repo.save(user);
    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'set_password',
      entityType: 'User',
      entityId: id,
    });
    return { success: true };
  }

  async deactivate(actor: AuthUser, id: string) {
    const user = await this.repo.findOne({ where: { id, tenantId: actor.tenantId } });
    if (!user) throw new NotFoundException('Mitarbeiter nicht gefunden');
    user.isActive = false;
    await this.repo.save(user);
    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'deactivate',
      entityType: 'User',
      entityId: id,
    });
    return { success: true };
  }
}
