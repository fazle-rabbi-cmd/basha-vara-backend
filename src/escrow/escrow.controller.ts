import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EscrowService } from './escrow.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ReleaseEscrowDto, RefundEscrowDto, DisputeEscrowDto, EscrowResponseDto } from './dto/escrow.dto.js';

@ApiTags('Escrow')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get('payment/:paymentId')
  @ApiOperation({ summary: 'Get escrow status for a payment' })
  @ApiResponse({ status: 200, description: 'Escrow status retrieved successfully', type: EscrowResponseDto })
  async getEscrowStatus(
    @Param('paymentId') paymentId: string,
  ): Promise<EscrowResponseDto> {
    return this.escrowService.getEscrowStatus(paymentId);
  }

  @Get('application/:applicationId')
  @ApiOperation({ summary: 'Get all escrow payments for an application' })
  @ApiResponse({ status: 200, description: 'Escrow payments retrieved successfully', type: [EscrowResponseDto] })
  async getEscrowByApplication(
    @Param('applicationId') applicationId: string,
  ): Promise<EscrowResponseDto[]> {
    return this.escrowService.getEscrowByApplication(applicationId);
  }

  @Get('held')
  @ApiOperation({ summary: 'Get all held escrow payments (admin only)' })
  @ApiResponse({ status: 200, description: 'Held escrow payments retrieved successfully', type: [EscrowResponseDto] })
  async getHeldEscrowPayments(): Promise<EscrowResponseDto[]> {
    return this.escrowService.getHeldEscrowPayments();
  }

  @Post('release')
  @ApiOperation({ summary: 'Release escrow funds to landlord' })
  @ApiResponse({ status: 200, description: 'Escrow released successfully', type: EscrowResponseDto })
  async releaseEscrow(
    @CurrentUser('id') userId: string,
    @Body() dto: ReleaseEscrowDto,
  ): Promise<EscrowResponseDto> {
    return this.escrowService.releaseEscrow(userId, dto);
  }

  @Post('refund')
  @ApiOperation({ summary: 'Refund escrow funds to tenant' })
  @ApiResponse({ status: 200, description: 'Escrow refunded successfully', type: EscrowResponseDto })
  async refundEscrow(
    @CurrentUser('id') userId: string,
    @Body() dto: RefundEscrowDto,
  ): Promise<EscrowResponseDto> {
    return this.escrowService.refundEscrow(userId, dto);
  }

  @Post('dispute')
  @ApiOperation({ summary: 'Dispute escrow payment' })
  @ApiResponse({ status: 200, description: 'Escrow disputed successfully', type: EscrowResponseDto })
  async disputeEscrow(
    @CurrentUser('id') userId: string,
    @Body() dto: DisputeEscrowDto,
  ): Promise<EscrowResponseDto> {
    return this.escrowService.disputeEscrow(userId, dto);
  }

  @Post('resolve/:paymentId')
  @ApiOperation({ summary: 'Resolve escrow dispute (admin only)' })
  @ApiResponse({ status: 200, description: 'Dispute resolved successfully', type: EscrowResponseDto })
  async resolveDispute(
    @Param('paymentId') paymentId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: { resolution: 'release' | 'refund' | 'split'; splitPercentage?: number },
  ): Promise<EscrowResponseDto> {
    return this.escrowService.resolveDispute(paymentId, userId, dto.resolution, dto.splitPercentage);
  }
}
