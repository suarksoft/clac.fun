import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { TokenFilter } from '../tokens.service';

const validFilters: TokenFilter[] = ['live', 'dying', 'dead', 'new', 'hot'];

export class TokenListQueryDto {
  @IsOptional()
  @IsIn(validFilters)
  filter: TokenFilter = 'live';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
