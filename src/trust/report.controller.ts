import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportService } from './report.service.js';
import { CreateReportDto, ResolveReportDto, ReportResponseDto } from './dto/report.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @ApiOperation({ summary: 'Create a report' })
  @ApiResponse({ status: 201, description: 'Report created successfully', type: ReportResponseDto })
  async createReport(
    @CurrentUser() user: any,
    @Body() dto: CreateReportDto,
  ): Promise<ReportResponseDto> {
    return this.reportService.createReport(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reports for current user' })
  @ApiResponse({ status: 200, description: 'Reports retrieved successfully', type: [ReportResponseDto] })
  async getReports(
    @CurrentUser() user: any,
  ): Promise<ReportResponseDto[]> {
    return this.reportService.getReports(user.id, user.roles);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending reports (admin only)' })
  @ApiResponse({ status: 200, description: 'Pending reports retrieved successfully', type: [ReportResponseDto] })
  async getPendingReports(): Promise<ReportResponseDto[]> {
    return this.reportService.getPendingReports();
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Resolve a report (admin only)' })
  @ApiResponse({ status: 200, description: 'Report resolved successfully', type: ReportResponseDto })
  async resolveReport(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: ResolveReportDto,
  ): Promise<ReportResponseDto> {
    return this.reportService.resolveReport(id, user.id, dto);
  }
}
