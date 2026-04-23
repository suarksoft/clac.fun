import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import type { Request } from 'express';
import { AdminPasswordGuard } from './common/guards/admin-password.guard';

const uploadDir = join(process.cwd(), 'uploads');
mkdirSync(uploadDir, { recursive: true });

const imageFileFilter = (
  _req: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.mimetype.startsWith('image/')) {
    callback(new BadRequestException('Only image files are allowed') as unknown as Error, false);
    return;
  }
  callback(null, true);
};

@Controller('uploads')
@UseGuards(AdminPasswordGuard)
export class UploadsController {
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, callback) => {
          const extension = extname(file.originalname) || '.png';
          const safeExt = extension.replace(/[^a-zA-Z0-9.]/g, '');
          const filename = `token-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
          callback(null, filename);
        },
      }),
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadImage(
    @Req() req: Request,
    @UploadedFile() file: { filename: string } | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim();
    const protocol = forwardedProto || req.protocol || 'https';
    const host = req.get('host') || '';
    const urlPath = `/uploads/${file.filename}`;

    return {
      urlPath,
      url: `${protocol}://${host}${urlPath}`,
    };
  }
}
