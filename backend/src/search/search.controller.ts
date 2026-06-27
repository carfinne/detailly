import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Globale Suche (Kunden, Fahrzeuge, Aufträge, Rechnungen, Termine)' })
  search(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    // tenantId kommt IMMER aus dem Token, nie aus dem Request -> strikte Mandantentrennung.
    return this.service.globalSearch(user.tenantId, q ?? '');
  }
}
