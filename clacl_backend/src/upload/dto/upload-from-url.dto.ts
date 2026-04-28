import { IsString, IsUrl, MaxLength } from 'class-validator';

export class UploadFromUrlDto {
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  url: string;
}
