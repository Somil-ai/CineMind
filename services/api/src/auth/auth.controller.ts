import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';

const AUTH_LIMIT = Number(process.env.AUTH_RATE_LIMIT || 10); // per IP per minute on register/login

class RegisterDto {
  @IsEmail() email: string;
  @IsString() @Length(10, 128) @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'password must contain letters and numbers' }) password: string;
  @IsString() @Length(1, 50) displayName: string;
}
class LoginDto { @IsEmail() email: string; @IsString() @MaxLength(128) password: string }
class RefreshDto { @IsString() @MaxLength(200) refreshToken: string }
class ResetDto { @IsEmail() email: string }

@ApiTags('auth') @Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Throttle({ default: { limit: AUTH_LIMIT, ttl: 60000 } }) @Post('register') register(@Body() b: RegisterDto) { return this.auth.register(b.email, b.password, b.displayName); }
  @Throttle({ default: { limit: AUTH_LIMIT, ttl: 60000 } }) @HttpCode(200) @Post('login') login(@Body() b: LoginDto) { return this.auth.login(b.email, b.password); }
  @HttpCode(200) @Post('refresh') refresh(@Body() b: RefreshDto) { return this.auth.refresh(b.refreshToken); }
  @HttpCode(204) @Post('logout') async logout(@Body() b: RefreshDto) { await this.auth.logout(b.refreshToken); }
  /** Always 202 so the endpoint can't be used to enumerate accounts. Email delivery (reset link) is not wired yet. */
  @HttpCode(202) @Post('password-reset') reset(@Body() _b: ResetDto) { return { message: 'If an account exists, a reset link will be sent.' }; }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Get('me') me(@Req() req: any) { return this.auth.me(req.user.sub); }
}
