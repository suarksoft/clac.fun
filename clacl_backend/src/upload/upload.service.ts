import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { configureCloudinary } from '../config/cloudinary.config';

const TOKEN_FOLDER = 'clac-fun/tokens';

const uploadTransforms = [
  { width: 400, height: 400, crop: 'fill', gravity: 'center' },
  { quality: 'auto', fetch_format: 'auto' },
] as const;

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private configured = false;

  constructor() {
    this.ensureConfigured();
  }

  private ensureConfigured() {
    const name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const key = process.env.CLOUDINARY_API_KEY?.trim();
    const secret = process.env.CLOUDINARY_API_SECRET?.trim();
    if (!name || !key || !secret) {
      return;
    }
    configureCloudinary();
    this.configured = true;
  }

  isReady(): boolean {
    this.ensureConfigured();
    return this.configured;
  }

  assertReady() {
    if (!this.isReady()) {
      throw new ServiceUnavailableException(
        'Image upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.',
      );
    }
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    this.assertReady();
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file provided');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: TOKEN_FOLDER,
          transformation: [...uploadTransforms],
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result?.secure_url) {
            this.logger.error(
              `Cloudinary upload failed: ${error?.message ?? 'unknown'}`,
            );
            reject(error ?? new Error('Cloudinary upload failed'));
            return;
          }
          this.logger.log(`Image uploaded: ${result.secure_url}`);
          resolve(result.secure_url);
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async uploadFromUrl(imageUrl: string): Promise<string> {
    this.assertReady();
    const trimmed = imageUrl.trim();

    try {
      const result = await cloudinary.uploader.upload(trimmed, {
        folder: TOKEN_FOLDER,
        transformation: [...uploadTransforms],
      });
      if (!result.secure_url) {
        throw new Error('No secure_url in response');
      }
      this.logger.log(`Image imported from URL: ${result.secure_url}`);
      return result.secure_url;
    } catch (error) {
      this.logger.error(
        `Cloudinary URL upload failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      throw error;
    }
  }
}
