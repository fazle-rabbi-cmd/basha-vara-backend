import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewService } from './review.service.js';
import { CreateReviewDto, ReviewResponseDto } from './dto/review.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Reviews')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @ApiOperation({ summary: 'Create a review' })
  @ApiResponse({ status: 201, description: 'Review created successfully', type: ReviewResponseDto })
  async createReview(
    @CurrentUser() user: any,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.createReview(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reviews for current user' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully', type: [ReviewResponseDto] })
  async getReviews(
    @CurrentUser() user: any,
  ): Promise<ReviewResponseDto[]> {
    return this.reviewService.getReviewsForUser(user.id, user.roles);
  }

  @Get('property/:propertyId')
  @ApiOperation({ summary: 'Get reviews for a property' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully', type: [ReviewResponseDto] })
  async getPropertyReviews(
    @Param('propertyId') propertyId: string,
  ): Promise<ReviewResponseDto[]> {
    return this.reviewService.getReviewsForProperty(propertyId);
  }

  @Get('user/:userId/rating')
  @ApiOperation({ summary: 'Get user rating' })
  @ApiResponse({ status: 200, description: 'User rating retrieved successfully' })
  async getUserRating(
    @Param('userId') userId: string,
  ): Promise<{ averageRating: number; totalReviews: number }> {
    return this.reviewService.getUserRating(userId);
  }
}
