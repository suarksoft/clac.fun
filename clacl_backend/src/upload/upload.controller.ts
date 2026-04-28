import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { UploadFromUrlDto } from './dto/upload-from-url.dto';

const imageMime =
  /^image\/(jpeg|jpg|png|gif|webp)$/i;

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!imageMime.test(file.mimetype)) {
          cb(
            new BadRequestException(
              'Only image files allowed (jpeg, png, gif, webp)',
            ) as unknown as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const url = await this.uploadService.uploadImage(file);
    return { url };
  }

  @Post('image-url')
  async uploadFromUrl(@Body() body: UploadFromUrlDto) {
    const url = await this.uploadService.uploadFromUrl(body.url);
    return { url };
  }
}
