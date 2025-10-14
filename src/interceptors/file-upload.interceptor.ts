import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { BadRequestException } from '@nestjs/common';
import * as path from 'path';
import { extname } from 'path';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { MAX_FILE_SIZE } from '../services/file-upload.service';

/**
 * Creates a FileFieldsInterceptor with standard configuration
 * @param fields The file fields to intercept
 * @returns Configured FileFieldsInterceptor
 */
export function createFileFieldsInterceptor(
  fields: { name: string; maxCount: number }[]
) {
  return FileFieldsInterceptor(fields, {
    storage: diskStorage({
      destination: (req, file, cb) => {
        console.log('File upload detected:', file);
        console.log('Request body:', req.body);
        console.log('Request path:', req.path);

        // Upload directory for files
        const uploadDir = path.join(process.cwd(), 'uploads');
        // Ensure the directory exists
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const fileSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        const filename = `${fileSuffix}${ext}`;
        cb(null, filename);
      },
    }),
    fileFilter: (req, file, cb) => {
      // Check if file is an image
      if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
        return cb(
          new BadRequestException(
            'Only image files (jpg, jpeg, png, webp) are allowed!'
          ),
          false
        );
      }
      cb(null, true);
    },
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  });
}

/**
 * Creates a FileInterceptor with standard configuration for a single file
 * @param fieldName The name of the file field
 * @returns Configured FileInterceptor
 */
export function createFileInterceptor(fieldName: string) {
  console.log('Creating FileInterceptor with field:', fieldName);
  return FileInterceptor(fieldName, {
    storage: diskStorage({
      destination: (req, file, cb) => {
        console.log('Single file upload detected:', file);
        console.log('Request body:', req.body);
        console.log('Request path:', req.path);
        cb(null, './uploads');
      },
      filename: (req, file, cb) => {
        const fileSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        const filename = `${fileSuffix}${ext}`;
        cb(null, filename);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
        return cb(
          new BadRequestException(
            'Only image files (jpg, jpeg, png, webp) are allowed!'
          ),
          false
        );
      }
      cb(null, true);
    },
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  });
}
