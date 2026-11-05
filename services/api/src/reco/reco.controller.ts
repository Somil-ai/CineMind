import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../auth/jwt.guard';
import { RecoService } from './reco.service';
import { Store } from '../store';

class RecQ { @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) k?: number }
class FeedbackDto {
  @IsOptional() @IsUUID() requestId?: string; @IsInt() @Min(1) movieId: number;
  @IsIn(['click', 'watchlist', 'rate', 'dislike', 'not_interested', 'dismiss']) outcome: string;
}

@ApiTags('recommendations') @Controller('recommendations')
export class RecoController {
  constructor(private reco: RecoService, private store: Store) {}
  @ApiBearerAuth() @UseGuards(JwtGuard) @Get('for-you') forYou(@Req() r: any, @Query() q: RecQ) { return this.reco.forYou(r.user.sub, { k: q.k ?? 20 }); }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Get('mood/:mood') mood(@Req() r: any, @Param('mood') mood: string, @Query() q: RecQ) { return this.reco.forYou(r.user.sub, { k: q.k ?? 20, mood }); }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Get('hidden-gems') gems(@Req() r: any, @Query() q: RecQ) { return this.reco.forYou(r.user.sub, { k: q.k ?? 20, hiddenGems: true }); }
  /** Public (no auth): powers "More like this" on SEO-indexed movie pages. */
  @Get('similar/:movieId') similar(@Param('movieId', ParseIntPipe) id: number, @Query() q: RecQ) { return this.reco.similar(id, q.k ?? 10); }
  @ApiBearerAuth() @UseGuards(JwtGuard) @Get('because-you-watched/:movieId') byw(@Param('movieId', ParseIntPipe) id: number, @Query() q: RecQ) { return this.reco.similar(id, q.k ?? 10); }

  @ApiBearerAuth() @UseGuards(JwtGuard) @Post('feedback') @HttpCode(204) async feedback(@Req() r: any, @Body() b: FeedbackDto) {
    const u = r.user.sub;
    if (b.outcome === 'dislike' || b.outcome === 'not_interested') await this.store.setNegative(u, b.movieId, b.outcome);
    if (b.outcome === 'watchlist') await this.store.addWatchlist(u, b.movieId);
    await this.store.addRecLog({ requestId: b.requestId ?? '', userId: r.user.sub, movieId: b.movieId, outcome: b.outcome, at: Date.now() });
  }
}
