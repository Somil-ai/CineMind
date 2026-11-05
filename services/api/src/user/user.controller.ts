import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { JwtGuard, Roles } from '../auth/jwt.guard';
import { Store } from '../store';
import { AuthService } from '../auth/auth.service';

class MovieDto { @IsInt() @Min(1) movieId: number }
class RatingDto extends MovieDto { @IsIn([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]) value: number }
class PrefsDto {
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) favoriteGenres?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) languages?: string[];
  @IsOptional() @IsBoolean() allowAdult?: boolean;
}

@ApiTags('user') @ApiBearerAuth() @UseGuards(JwtGuard) @Controller()
export class UserController {
  constructor(private store: Store, private auth: AuthService) {}
  @Post('watchlist') @HttpCode(204) async addWatch(@Req() r: any, @Body() b: MovieDto) { await this.store.addWatchlist(r.user.sub, b.movieId); }
  @Delete('watchlist/:movieId') @HttpCode(204) async rmWatch(@Req() r: any, @Param('movieId', ParseIntPipe) id: number) { await this.store.removeWatchlist(r.user.sub, id); }
  @Post('favorites') @HttpCode(204) async fav(@Req() r: any, @Body() b: MovieDto) { await this.store.addFavorite(r.user.sub, b.movieId); }
  @Post('watched') @HttpCode(204) async watched(@Req() r: any, @Body() b: MovieDto) { await this.store.markWatched(r.user.sub, b.movieId); await this.store.removeWatchlist(r.user.sub, b.movieId); }
  @Post('ratings') @HttpCode(204) async rate(@Req() r: any, @Body() b: RatingDto) {
    const u = r.user.sub;
    await this.store.setRating(u, b.movieId, b.value); await this.store.removeWatchlist(u, b.movieId);
    if (b.value <= 2) await this.store.setNegative(u, b.movieId, 'dislike'); else await this.store.clearNegative(u, b.movieId, 'dislike');
  }
  @Post('not-interested') @HttpCode(204) async notInterested(@Req() r: any, @Body() b: MovieDto) { await this.store.setNegative(r.user.sub, b.movieId, 'not_interested'); }

  /** Everything the UI needs to show watchlist/rating state, in one cheap call. */
  @Get('users/me/signals') async signals(@Req() r: any) {
    const s = await this.store.getSignals(r.user.sub);
    return { ratings: s.ratings, watchlist: [...s.watchlist], favorites: [...s.favorites], watched: [...s.watched], notInterested: [...s.notInterested] };
  }
  @Get('users/me/profile') async profile(@Req() r: any) {
    const s = await this.store.getSignals(r.user.sub);
    return { ...(await this.auth.me(r.user.sub)), prefs: s.prefs, counts: { ratings: Object.keys(s.ratings).length, watchlist: s.watchlist.size, favorites: s.favorites.size } };
  }
  @Patch('users/me/preferences') prefs(@Req() r: any, @Body() b: PrefsDto) { return this.store.updatePrefs(r.user.sub, b); }
}

@ApiTags('admin') @ApiBearerAuth() @Roles('admin') @UseGuards(JwtGuard) @Controller('admin')
export class AdminController {
  constructor(private store: Store, private auth: AuthService) {}
  @Get('users') async users() { return (await this.store.listUsers()).map((u) => this.auth.publicUser(u)); }
}
