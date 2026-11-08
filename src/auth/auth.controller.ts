import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { GoogleAuthDto } from './dto/google-auth.dto.js';
import { RequestPasswordLinkDto } from './dto/request-password-link.dto.js';
import { CompletePasswordSetupDto } from './dto/complete-password-setup.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setAuthCookie(res: Response, token: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new tenant or landlord user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'Email or phone already in use' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setAuthCookie(res, result.accessToken);
    return {
      message: 'Account successfully registered',
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or account suspended' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAuthCookie(res, result.accessToken);
    return {
      message: 'Successfully logged in',
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with Google OAuth' })
  @ApiResponse({ status: 200, description: 'Successfully authenticated with Google' })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  async googleLogin(
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.googleLogin(dto.credential);
    this.setAuthCookie(res, result.accessToken);
    return {
      message: 'Successfully logged in with Google',
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Get('google/native/start')
  @ApiOperation({ summary: 'Start Google OAuth for the native app' })
  async nativeGoogleStart(@Res() res: Response) {
    res.redirect(this.authService.getNativeGoogleAuthUrl());
  }

  @Get('google/native/callback')
  @ApiOperation({ summary: 'Complete Google OAuth for the native app' })
  async nativeGoogleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      res.status(HttpStatus.BAD_REQUEST).send('Google authentication was cancelled or incomplete.');
      return;
    }

    const result = await this.authService.completeNativeGoogleLogin(code, state);
    const appUrl = new URL(process.env.NATIVE_APP_REDIRECT_URI ?? 'bashavara://auth/callback');
    appUrl.searchParams.set('token', result.accessToken);
    res.redirect(appUrl.toString());
  }

  @Post('password/request-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password setup or reset email' })
  async requestPasswordLink(@Body() dto: RequestPasswordLinkDto) {
    return this.authService.requestPasswordLink(dto.email);
  }

  @Post('password/complete-setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set or reset a password using a single-use email link' })
  async completePasswordSetup(@Body() dto: CompletePasswordSetupDto) {
    return this.authService.completePasswordSetup(dto.token, dto.password);
  }

  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change password for an authenticated account' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear authentication cookies' })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', {
      path: '/',
    });
    return { message: 'Successfully logged out' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Retrieve currently logged-in user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser('id') userId: string) {
    return this.authService.getCurrentUser(userId);
  }
}
