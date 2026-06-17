import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceItem } from './entities/service-item.entity';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(ServiceItem)
    private readonly repo: Repository<ServiceItem>,
  ) {}

  findAll(tenantId: string, includeInactive = false): Promise<ServiceItem[]> {
    const where: Record<string, unknown> = { tenantId };
    if (!includeInactive) where.aktiv = true;
    return this.repo.find({ where, order: { kategorie: 'ASC', name: 'ASC' } });
  }

  async findOne(tenantId: string, id: string): Promise<ServiceItem> {
    const item = await this.repo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Leistung nicht gefunden');
    return item;
  }

  create(user: AuthUser, dto: CreateServiceDto): Promise<ServiceItem> {
    return this.repo.save(this.repo.create({ ...dto, tenantId: user.tenantId }));
  }

  async update(user: AuthUser, id: string, dto: UpdateServiceDto): Promise<ServiceItem> {
    const item = await this.findOne(user.tenantId, id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(user: AuthUser, id: string): Promise<{ success: boolean }> {
    const item = await this.findOne(user.tenantId, id);
    item.aktiv = false;
    await this.repo.save(item);
    return { success: true };
  }
}
