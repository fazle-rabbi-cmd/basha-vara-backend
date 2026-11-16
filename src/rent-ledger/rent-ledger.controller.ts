import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RentLedgerService } from './rent-ledger.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import {
  CreateRentPaymentDto,
  UpdateRentPaymentDto,
  CreateUtilityChargeDto,
  UpdateUtilityChargeDto,
  RentPaymentResponseDto,
  UtilityChargeResponseDto,
} from './dto/rent-ledger.dto.js';

@ApiTags('Rent Ledger')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('rent-ledger')
export class RentLedgerController {
  constructor(private readonly rentLedgerService: RentLedgerService) {}

  // Rent Payment Endpoints
  @Post('rent-payments')
  @ApiOperation({ summary: 'Create a rent payment record' })
  @ApiResponse({ status: 201, description: 'Rent payment created successfully', type: RentPaymentResponseDto })
  async createRentPayment(
    @CurrentUser() user: any,
    @Body() dto: CreateRentPaymentDto,
  ): Promise<RentPaymentResponseDto> {
    return this.rentLedgerService.createRentPayment(user.id, dto);
  }

  @Get('rent-payments')
  @ApiOperation({ summary: 'Get all rent payments for current user' })
  @ApiResponse({ status: 200, description: 'Rent payments retrieved successfully', type: [RentPaymentResponseDto] })
  async getRentPayments(
    @CurrentUser() user: any,
  ): Promise<RentPaymentResponseDto[]> {
    return this.rentLedgerService.getRentPayments(user.id, user.roles);
  }

  @Get('rent-payments/:id')
  @ApiOperation({ summary: 'Get rent payment by ID' })
  @ApiResponse({ status: 200, description: 'Rent payment retrieved successfully', type: RentPaymentResponseDto })
  async getRentPaymentById(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<RentPaymentResponseDto> {
    return this.rentLedgerService.getRentPaymentById(id, user.id, user.roles);
  }

  @Patch('rent-payments/:id')
  @ApiOperation({ summary: 'Update rent payment status' })
  @ApiResponse({ status: 200, description: 'Rent payment updated successfully', type: RentPaymentResponseDto })
  async updateRentPayment(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateRentPaymentDto,
  ): Promise<RentPaymentResponseDto> {
    return this.rentLedgerService.updateRentPayment(id, user.id, dto);
  }

  @Delete('rent-payments/:id')
  @ApiOperation({ summary: 'Delete rent payment' })
  @ApiResponse({ status: 200, description: 'Rent payment deleted successfully' })
  async deleteRentPayment(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    return this.rentLedgerService.deleteRentPayment(id, user.id);
  }

  // Utility Charge Endpoints
  @Post('utility-charges')
  @ApiOperation({ summary: 'Create a utility charge' })
  @ApiResponse({ status: 201, description: 'Utility charge created successfully', type: UtilityChargeResponseDto })
  async createUtilityCharge(
    @CurrentUser() user: any,
    @Body() dto: CreateUtilityChargeDto,
  ): Promise<UtilityChargeResponseDto> {
    return this.rentLedgerService.createUtilityCharge(user.id, dto);
  }

  @Get('utility-charges')
  @ApiOperation({ summary: 'Get all utility charges for current user' })
  @ApiResponse({ status: 200, description: 'Utility charges retrieved successfully', type: [UtilityChargeResponseDto] })
  async getUtilityCharges(
    @CurrentUser() user: any,
  ): Promise<UtilityChargeResponseDto[]> {
    return this.rentLedgerService.getUtilityCharges(user.id, user.roles);
  }

  @Get('utility-charges/:id')
  @ApiOperation({ summary: 'Get utility charge by ID' })
  @ApiResponse({ status: 200, description: 'Utility charge retrieved successfully', type: UtilityChargeResponseDto })
  async getUtilityChargeById(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<UtilityChargeResponseDto> {
    return this.rentLedgerService.getUtilityChargeById(id, user.id, user.roles);
  }

  @Patch('utility-charges/:id')
  @ApiOperation({ summary: 'Update utility charge status' })
  @ApiResponse({ status: 200, description: 'Utility charge updated successfully', type: UtilityChargeResponseDto })
  async updateUtilityCharge(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateUtilityChargeDto,
  ): Promise<UtilityChargeResponseDto> {
    return this.rentLedgerService.updateUtilityCharge(id, user.id, dto);
  }

  @Delete('utility-charges/:id')
  @ApiOperation({ summary: 'Delete utility charge' })
  @ApiResponse({ status: 200, description: 'Utility charge deleted successfully' })
  async deleteUtilityCharge(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    return this.rentLedgerService.deleteUtilityCharge(id, user.id);
  }

  // Ledger Summary Endpoints
  @Get('summary')
  @ApiOperation({ summary: 'Get ledger summary for current user' })
  @ApiResponse({ status: 200, description: 'Ledger summary retrieved successfully' })
  async getLedgerSummary(
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.rentLedgerService.getLedgerSummary(user.id, user.roles);
  }
}
