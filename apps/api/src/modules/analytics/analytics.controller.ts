import type { UserSession } from '@thallesp/nestjs-better-auth';

import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';

import type { auth } from '../../auth/auth';

import { ErrorResponseDto } from '../../shared/dtos/error-response.dto';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { AnalyticsService } from './analytics.service';
import { CategoryBreakdownResponseDto } from './dtos/category-breakdown-response.dto';
// oxlint-disable-next-line typescript/consistent-type-imports -- runtime import: ValidationPipe needs the @Query paramtype metadata, which SWC erases from type-only imports
import { FindBreakdownQueryDto } from './dtos/find-breakdown-query.dto';
// oxlint-disable-next-line typescript/consistent-type-imports -- runtime import: ValidationPipe needs the @Query paramtype metadata, which SWC erases from type-only imports
import { FindSummaryQueryDto } from './dtos/find-summary-query.dto';
// oxlint-disable-next-line typescript/consistent-type-imports -- runtime import: ValidationPipe needs the @Query paramtype metadata, which SWC erases from type-only imports
import { FindTrendQueryDto } from './dtos/find-trend-query.dto';
import { MonthlySummaryResponseDto } from './dtos/monthly-summary-response.dto';
import { TrendResponseDto } from './dtos/trend-response.dto';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: MonthlySummaryResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getMonthlySummary(
    @Session() session: UserSession<typeof auth>,
    @Query() query: FindSummaryQueryDto,
  ): Promise<MonthlySummaryResponseDto> {
    return this.analyticsService.getMonthlySummary(session.user.id, query);
  }

  @Get('breakdown')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: CategoryBreakdownResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getCategoryBreakdown(
    @Session() session: UserSession<typeof auth>,
    @Query() query: FindBreakdownQueryDto,
  ): Promise<CategoryBreakdownResponseDto> {
    return this.analyticsService.getCategoryBreakdown(session.user.id, query);
  }

  @Get('trend')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: TrendResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getMonthlyTrend(
    @Session() session: UserSession<typeof auth>,
    @Query() query: FindTrendQueryDto,
  ): Promise<TrendResponseDto> {
    return this.analyticsService.getMonthlyTrend(session.user.id, query);
  }
}
