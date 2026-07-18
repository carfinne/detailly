import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { KassenbuchService } from './kassenbuch.service';
import {
  CreateKassenbuchEintragDto,
  UpdateKassenbuchEintragDto,
  StornoKassenbuchDto,
  ListKassenbuchQueryDto,
  KassenbuchExportQueryDto,
} from './dto/kassenbuch.dto';

/**
 * GoBD-Kassenbuch (Barzahlungen). KERN – gesetzliche/steuerliche Pflicht, daher
 * KEIN Tarif-Feature-Gate (analog Rechnungen / E-Rechnungs-Empfang).
 *
 * Rollen: Kassen-Bediener + Leitung (OWNER/MANAGER/RECEPTIONIST) fuehren die
 * Kasse; der Export ist Leitung-only (OWNER/MANAGER, wie der Buchhaltungs-
 * Export). TECHNICIAN hat mit der Barkasse nichts zu tun. Guard-Reihenfolge:
 * Jwt -> Subscription -> Roles.
 */
@ApiTags('kassenbuch')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.RECEPTIONIST)
@Controller('kassenbuch')
export class KassenbuchController {
  constructor(private readonly service: KassenbuchService) {}

  @Get()
  @ApiOperation({ summary: 'Kassenbuch-Eintraege auflisten (paginiert, Zeitraum-/Typ-Filter)' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListKassenbuchQueryDto) {
    return this.service.findAll(user.tenantId, query);
  }

  // WICHTIG: statische Routen VOR @Get(':id') deklarieren (sonst faengt :id sie ab).
  @Get('saldo')
  @ApiOperation({ summary: 'Kassenbestand + Tages-/Monatssaldo' })
  saldo(@CurrentUser() user: AuthUser, @Query('datum') datum?: string) {
    return this.service.saldo(user.tenantId, datum);
  }

  @Get('export')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'GoBD-CSV-Export (Zeitraum optional)' })
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: KassenbuchExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename, contentType } = await this.service.buildExport(user.tenantId, {
      von: query.von,
      bis: query.bis,
    });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Eintrag laden' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Eintrag anlegen (Entwurf)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateKassenbuchEintragDto) {
    return this.service.create(user, dto);
  }

  // WICHTIG: statische POST-Route VOR @Post(':id/...') – Tagesabschluss.
  @Post('festschreiben')
  @ApiOperation({ summary: 'Tagesabschluss: alle offenen Entwuerfe festschreiben' })
  festschreibenAlle(@CurrentUser() user: AuthUser) {
    return this.service.festschreibenAlle(user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Entwurf aendern (nur letzter, nicht festgeschriebener Eintrag)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateKassenbuchEintragDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Entwurf loeschen (nur letzter, nicht festgeschriebener Eintrag)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }

  @Post(':id/festschreiben')
  @ApiOperation({ summary: 'Eintrag festschreiben (danach unveraenderlich, idempotent)' })
  festschreiben(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.festschreiben(user, id);
  }

  @Post(':id/storno')
  @ApiOperation({ summary: 'Storno-Gegenbuchung zu einem festgeschriebenen Eintrag' })
  storno(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: StornoKassenbuchDto,
  ) {
    return this.service.storno(user, id, dto);
  }
}
