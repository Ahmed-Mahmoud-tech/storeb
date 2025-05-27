import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { ProductService } from '../services/product.service';
import { FileUploadService } from '../services/file-upload.service';
import { CreateProductDto, UpdateProductDto } from '../dto/product.dto';
import { Product } from '../model/product.model';
import { createFileFieldsInterceptor } from '../interceptors/file-upload.interceptor';
import { FormDataParserInterceptor } from '../interceptors/form-data-parser.interceptor';
import { FormDataHelper } from '../utils/form-data.helper';

@Controller('products')
export class ProductController implements OnModuleInit {
  constructor(
    private readonly productService: ProductService,
    private readonly fileUploadService: FileUploadService
  ) {}

  onModuleInit() {
    // Ensure upload directories exist when the application starts
    this.fileUploadService.ensureUploadDirectories();
  }

  /**
   * Create a new product
   *
   * POST /products
   */ @Post()
  @UseInterceptors(
    FormDataParserInterceptor,
    createFileFieldsInterceptor([{ name: 'images', maxCount: 3 }])
  )
  async createProduct(
    @Body() dto: Record<string, unknown>,
    @UploadedFiles()
    files: { images?: Express.Multer.File[] }
  ): Promise<Product> {
    console.log('Create product endpoint called');
    console.log('Files received:', files);
    console.log('DTO received:', dto);
    try {
      // Create a type-safe DTO object
      const createProductDto = new CreateProductDto();

      // Basic string properties
      createProductDto.product_code = FormDataHelper.parseString(
        dto.product_code
      );

      console.log(createProductDto.product_code, 'product_code');

      if (!createProductDto.product_code) {
        throw new BadRequestException(
          'Product code is required and cannot be empty'
        );
      }
      createProductDto.product_name = dto.product_name as string;
      createProductDto.category = dto.category as string;
      createProductDto.details = dto.details as string;
      createProductDto.createdBy = dto.createdBy as string;

      // Numeric properties
      createProductDto.price = FormDataHelper.parseNumber(dto.price);
      if (dto.priceBeforeSale) {
        createProductDto.priceBeforeSale = FormDataHelper.parseNumber(
          dto.priceBeforeSale
        );
      }

      // Boolean properties
      createProductDto.isActive = FormDataHelper.parseBoolean(dto.isActive);
      createProductDto.newArrival = FormDataHelper.parseBoolean(dto.newArrival);
      createProductDto.isFeatured = FormDataHelper.parseBoolean(dto.isFeatured);

      // Complex properties that need parsing
      createProductDto.branchIds = FormDataHelper.parseIfJSON<string[]>(
        dto.branchIds,
        []
      );

      console.log(dto.tags, 'sssssssssssssssss000');
      createProductDto.tags = FormDataHelper.parseIfJSON(dto.tags, {});
      console.log(dto.tags, 'sssssssssssssssss', createProductDto.tags, '444');

      // Handle product images if uploaded
      const imageUrls: string[] = [];
      if (files?.images && files.images.length > 0) {
        for (const file of files.images) {
          const imagePath =
            await this.fileUploadService.validateAndProcessUpload(file, {
              width: 800,
              quality: 85,
              format: 'webp',
            });
          if (imagePath) {
            imageUrls.push(imagePath);
          }
        }
      }

      // If we have existing image paths as strings, merge them with newly uploaded ones
      const existingImages = FormDataHelper.parseIfJSON<string[]>(
        dto.images,
        []
      );
      createProductDto.images = [...imageUrls, ...existingImages];

      // Validate product code uniqueness
      const exists = await this.productService.productExists(
        createProductDto.product_code
      );
      console.log(createProductDto.product_code, 'exists:', exists);

      if (exists && createProductDto.product_code !== undefined) {
        throw new BadRequestException('Product with this code already exists');
      }

      // Create product
      return await this.productService.createProduct(createProductDto);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create product: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all products with pagination and filtering
   *
   * GET /products
   */
  @Get()
  async findAll(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('tag') tag?: string
  ) {
    return await this.productService.findAll(
      limit ? +limit : 10,
      offset ? +offset : 0,
      status,
      category,
      tag
    );
  }

  /**
   * Get products by branch ID
   *
   * GET /products/branch/:branchId
   */
  @Get('branch/:branchId')
  async findByBranch(
    @Param('branchId') branchId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ) {
    return await this.productService.findByBranch(
      branchId,
      limit ? +limit : 10,
      offset ? +offset : 0
    );
  }

  /**
   * Get a single product by product code
   *
   * GET /products/:productCode
   */
  @Get(':productCode')
  async findOne(@Param('productCode') productCode: string) {
    try {
      const product = await this.productService.findOne(productCode);

      // Get branch IDs for this product
      const branchIds =
        await this.productService.findProductBranches(productCode);

      // Return combined data
      return {
        ...product,
        branchIds,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error fetching product: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update a product
   *
   * PUT /products/:productCode
   */
  @Put(':productCode')
  @UseInterceptors(
    FormDataParserInterceptor,
    createFileFieldsInterceptor([{ name: 'images', maxCount: 10 }])
  )
  async update(
    @Param('productCode') productCode: string,
    @Body() dto: Record<string, unknown>,
    @UploadedFiles()
    files: { images?: Express.Multer.File[] }
  ) {
    console.log(dto, 'Update product DTO:');

    try {
      // Verify product exists
      await this.productService.findOne(productCode);

      // Create update DTO
      const updateProductDto = new UpdateProductDto();

      // Set basic properties if present
      if (dto.product_name)
        updateProductDto.product_name = dto.product_name as string;
      if (dto.category) updateProductDto.category = dto.category as string;
      if (dto.details) updateProductDto.details = dto.details as string;
      if (dto.updatedBy) updateProductDto.updatedBy = dto.updatedBy as string;

      // Numeric properties
      if (dto.price !== undefined) {
        updateProductDto.price = FormDataHelper.parseNumber(dto.price);
      }
      if (dto.priceBeforeSale !== undefined) {
        updateProductDto.priceBeforeSale = FormDataHelper.parseNumber(
          dto.priceBeforeSale
        );
      }

      // Boolean properties
      if (dto.isActive !== undefined) {
        updateProductDto.isActive = FormDataHelper.parseBoolean(dto.isActive);
      }
      if (dto.newArrival !== undefined) {
        updateProductDto.newArrival = FormDataHelper.parseBoolean(
          dto.newArrival
        );
      }
      if (dto.isFeatured !== undefined) {
        updateProductDto.isFeatured = FormDataHelper.parseBoolean(
          dto.isFeatured
        );
      }

      // Complex properties
      if (dto.branchIds) {
        updateProductDto.branchIds = FormDataHelper.parseIfJSON<string[]>(
          dto.branchIds,
          []
        );
      }
      if (dto.tags) {
        updateProductDto.tags = FormDataHelper.parseIfJSON(dto.tags, {});
      }

      // Ensure removeImages is included in the DTO
      if (!dto.removeImages) {
        dto.removeImages = [];
      }
      console.log(dto.removeImages, 'removeImages');

      // Handle image removal if specified
      const imagesToRemove = FormDataHelper.parseIfJSON<string[]>(
        dto.removeImages,
        []
      );

      // Delete the files from the upload folder and remove from DB
      for (const image of imagesToRemove) {
        const deletionResult = this.fileUploadService.deleteFile(image);
        console.log(
          `Attempting to delete file: ${image}, Success: ${deletionResult}`
        );
      }

      // Remove only the imagesToRemove from the database
      const product = await this.productService.findOne(productCode);
      const updatedImages = product.images.filter(
        (img) => !imagesToRemove.includes(img)
      );
      const partialUpdateDto = new UpdateProductDto();
      partialUpdateDto.images = updatedImages;
      await this.productService.update(productCode, partialUpdateDto);

      // Handle image uploads
      const imageUrls: string[] = [];
      if (files?.images && files.images.length > 0) {
        for (const file of files.images) {
          const imagePath =
            await this.fileUploadService.validateAndProcessUpload(file, {
              width: 800,
              quality: 85,
              format: 'webp',
            });
          if (imagePath) {
            imageUrls.push(imagePath);
          }
        }
      }

      // Merge newly uploaded images with existing images from the database, excluding imagesToRemove
      const finalImages = [
        ...product.images.filter((image) => !imagesToRemove.includes(image)),
        ...imageUrls,
      ];

      if (finalImages.length > 0) {
        updateProductDto.images = finalImages;
      }

      // Update product
      return await this.productService.update(productCode, updateProductDto);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update product: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a product
   *
   * DELETE /products/:productCode
   */
  @Delete(':productCode')
  async remove(@Param('productCode') productCode: string) {
    try {
      await this.productService.remove(productCode);
      return { message: `Product ${productCode} deleted successfully` };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to delete product: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
