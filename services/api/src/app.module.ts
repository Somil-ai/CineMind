import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { MemoryStore, Store } from './store';
import { PgStore } from './pg.store';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { JwtGuard } from './auth/jwt.guard';
import { AdminController, UserController } from './user/user.controller';
import { MoviesController } from './movies/movies.controller';
import { TmdbService } from './movies/tmdb.service';
import { RecoController } from './reco/reco.controller';
import { RecoService } from './reco/reco.service';

const secret = process.env.JWT_ACCESS_SECRET ?? (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_ACCESS_SECRET is required in production'); })() : 'dev-only-secret-change-me');

@Module({
  imports: [JwtModule.register({ global: true, secret, signOptions: { expiresIn: '15m' } }), ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])],
  controllers: [AuthController, UserController, AdminController, MoviesController, RecoController],
  providers: [{ provide: Store, useFactory: () => (process.env.DATABASE_URL ? new PgStore() : new MemoryStore()) }, { provide: APP_GUARD, useClass: ThrottlerGuard }, AuthService, JwtGuard, TmdbService, RecoService],
})
export class AppModule {}
