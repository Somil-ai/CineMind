import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TmdbService } from './tmdb.service';

class SearchQ { @IsString() @Length(1, 100) q: string; @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) page?: number }
class PageQ { @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) page?: number; @IsOptional() @IsString() @Length(2, 2) region?: string }

@ApiTags('movies') @Controller()
export class MoviesController {
  constructor(private tmdb: TmdbService) {}
  @Get('movies/trending') trending(@Query() q: PageQ) { return this.tmdb.get('/trending/movie/week', { page: q.page ?? 1 }); }
  @Get('movies/popular') popular(@Query() q: PageQ) { return this.tmdb.get('/movie/popular', { page: q.page ?? 1 }); }
  @Get('movies/top-rated') top(@Query() q: PageQ) { return this.tmdb.get('/movie/top_rated', { page: q.page ?? 1 }); }
  @Get('movies/new-releases') news(@Query() q: PageQ) { return this.tmdb.get('/movie/now_playing', { page: q.page ?? 1 }); }
  @Get('search/movies') search(@Query() q: SearchQ) { return this.tmdb.get('/search/movie', { query: q.q, page: q.page ?? 1 }); }
  @Get('search/multi') multi(@Query() q: SearchQ) { return this.tmdb.get('/search/multi', { query: q.q, page: q.page ?? 1 }); }
  @Get('movies/:id') detail(@Param('id', ParseIntPipe) id: number) { return this.tmdb.get(`/movie/${id}`, { append_to_response: 'credits,videos,similar' }); }
  @Get('movies/:id/similar') similar(@Param('id', ParseIntPipe) id: number) { return this.tmdb.get(`/movie/${id}/similar`); }
  @Get('movies/:id/credits') credits(@Param('id', ParseIntPipe) id: number) { return this.tmdb.get(`/movie/${id}/credits`); }
  @Get('movies/:id/videos') videos(@Param('id', ParseIntPipe) id: number) { return this.tmdb.get(`/movie/${id}/videos`); }
  @Get('movies/:id/watch-providers') async providers(@Param('id', ParseIntPipe) id: number, @Query() q: PageQ) {
    const d = await this.tmdb.get(`/movie/${id}/watch/providers`); return { region: q.region ?? 'US', ...(d.results?.[(q.region ?? 'US').toUpperCase()] ?? {}) };
  }
}
