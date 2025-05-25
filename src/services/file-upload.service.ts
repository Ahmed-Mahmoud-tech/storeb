import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { existsSync, mkdirSync } from 'fs';

// Max file size is 5MB
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

@Injectable()
export class FileUploadService {
  // Create uploads directory if it doesn't exist
  createUploadsDir(): string {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    try {
      // Check if directory is writable
      const testFile = path.join(uploadDir, '.test-write-access');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (err) {
      console.error(`Uploads directory is not writable: ${uploadDir}`, err);
      throw new HttpException(
        'Cannot write to uploads directory',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    return uploadDir;
  }

  // Ensure the uploads directory exists
  ensureUploadDirectories(): void {
    this.createUploadsDir();
  }

  /**
   * Process and optimize image
   */
  async processImage(
    filePath: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'webp' | 'jpeg' | 'png';
    } = {}
  ): Promise<string> {
    // Default options
    const width = options.width || 1200; // Reasonable max width
    const height = options.height || null;
    const quality = options.quality || 80; // Good quality with smaller file size
    const format = options.format || 'webp'; // WebP for better compression

    console.log('Processing image:', {
      filePath,
      width,
      height,
      quality,
      format,
    });

    // Ensure file path is absolute
    const absoluteFilePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    console.log('Checking file at absolute path:', absoluteFilePath);

    // Check if file exists
    if (!fs.existsSync(absoluteFilePath)) {
      console.error('File does not exist:', absoluteFilePath);
      throw new HttpException('Upload file not found', HttpStatus.BAD_REQUEST);
    }

    // Check file size before processing
    const stats = fs.statSync(absoluteFilePath);
    console.log('File size:', stats.size, 'bytes');

    if (stats.size > MAX_FILE_SIZE) {
      // Delete the uploaded file if too large
      fs.unlinkSync(absoluteFilePath);
      throw new HttpException(
        `File size exceeds the maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      // Create a processed version with a new name
      const uploadDir = this.createUploadsDir();
      console.log('Upload directory created:', uploadDir);

      const originalName = path.basename(absoluteFilePath);
      const filename = path.parse(originalName).name;
      const timestamp = Date.now();
      const outputFilename = `${filename}-${timestamp}.${format}`;
      const outputPath = path.join(uploadDir, outputFilename);

      console.log('Original file:', absoluteFilePath);
      console.log('Target output path:', outputPath);

      // Check if original file exists
      if (!fs.existsSync(absoluteFilePath)) {
        console.error('Original file does not exist:', absoluteFilePath);
        throw new HttpException(
          'Original file not found',
          HttpStatus.BAD_REQUEST
        );
      }

      // Get image info
      const metadata = await sharp(absoluteFilePath).metadata();
      console.log('Image metadata:', {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
      });

      // Create a transform stream
      let transform = sharp(absoluteFilePath);

      // Resize image if it exceeds the width/height limits
      if (
        (width && metadata.width && metadata.width > width) ||
        (height && metadata.height && metadata.height > height)
      ) {
        transform = transform.resize({
          width: width || undefined,
          height: height || undefined,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Set format based on selected format
      console.log(`Converting to ${format} with quality:`, quality);

      if (format === 'webp') {
        await transform.webp({ quality }).toFile(outputPath);
      } else if (format === 'jpeg') {
        await transform.jpeg({ quality }).toFile(outputPath);
      } else if (format === 'png') {
        await transform.png({ quality }).toFile(outputPath);
      }

      // Check if output file was created successfully
      if (!fs.existsSync(outputPath)) {
        console.error('Output file was not created:', outputPath);
        throw new HttpException(
          'Failed to create output file',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      console.log('Output file created successfully:', outputPath);

      // If the processed file is not the same as the original, delete the original
      if (absoluteFilePath !== outputPath) {
        try {
          fs.unlinkSync(absoluteFilePath);
          console.log('Original file deleted:', absoluteFilePath);
        } catch (err) {
          console.error('Error deleting original file:', err);
        }
      }

      // Construct the URL path for database storage
      const dbPath = `/uploads/${outputFilename}`;
      console.log('URL path for database:', dbPath);

      // Return the path that should be stored in the database
      return dbPath;
    } catch (error) {
      console.error('Error processing image:', error);
      throw new HttpException(
        'Error processing image',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Process an uploaded file, validate it, and return the processed image path
   * @param file The uploaded file from multer
   * @param options Options for image processing
   */
  async validateAndProcessUpload(
    file: Express.Multer.File | undefined,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'webp' | 'jpeg' | 'png';
    } = {}
  ): Promise<string | null> {
    if (!file) {
      return null;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new HttpException(
        `File size exceeds the maximum allowed size of ${
          MAX_FILE_SIZE / (1024 * 1024)
        } MB`,
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      console.log('File received:', file);
      console.log('File path:', file.path);

      // Process the image and get the optimized file path
      return await this.processImage(file.path, options);
    } catch (error) {
      console.error('Error processing uploaded file:', error);
      throw new HttpException(
        'Error processing uploaded file',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Delete a file from the uploads directory
   * @param filePath The relative path to the file to delete (e.g., /uploads/filename.webp)
   * @returns boolean indicating if deletion was successful
   */
  deleteFile(filePath: string): boolean {
    if (!filePath) return false;

    try {
      // Remove the leading slash if it exists
      const relativePath = filePath.startsWith('/')
        ? filePath.substring(1)
        : filePath;
      const absolutePath = path.join(process.cwd(), relativePath);

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log('File deleted successfully:', absolutePath);
        return true;
      } else {
        console.log('File not found, nothing to delete:', absolutePath);
        return false;
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }
}
