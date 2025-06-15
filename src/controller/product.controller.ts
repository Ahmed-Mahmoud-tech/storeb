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
  Req,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ProductService } from '../services/product.service';
import { FileUploadService } from '../services/file-upload.service';
import { FavoriteService } from '../services/favorite.service';
import { CreateProductDto, UpdateProductDto } from '../dto/product.dto';
import { Product } from '../model/product.model';
import { AuthHelper } from '../utils/auth.helper';
import { createFileFieldsInterceptor } from '../interceptors/file-upload.interceptor';
import { FormDataParserInterceptor } from '../interceptors/form-data-parser.interceptor';
import { FormDataHelper } from '../utils/form-data.helper';

@Controller('products')
export class ProductController implements OnModuleInit {
  private readonly logger = new Logger(ProductController.name);

  constructor(
    private readonly productService: ProductService,
    private readonly fileUploadService: FileUploadService,
    private readonly favoriteService: FavoriteService
  ) {}

  onModuleInit() {
    this.logger.log('ProductController module initialized');
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
    this.logger.log('Create product endpoint called');
    this.logger.log('Files received:', files);
    this.logger.log('DTO received:', dto);
    try {
      // Create a type-safe DTO object
      const createProductDto = new CreateProductDto();

      // Basic string properties
      createProductDto.product_code = FormDataHelper.parseString(
        dto.product_code
      );

      this.logger.log(createProductDto.product_code, 'product_code');

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

      this.logger.log(dto.tags, 'sssssssssssssssss000');
      createProductDto.tags = FormDataHelper.parseIfJSON(dto.tags, {});
      this.logger.log(
        dto.tags,
        'sssssssssssssssss',
        createProductDto.tags,
        '444'
      );

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
      this.logger.log(createProductDto.product_code, 'exists:', exists);

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
   */ @Get()
  async findAll(
    @Req() req: Request,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('status') status?: string | string[],
    @Query('category') category?: string,
    @Query('tag') tag?: string | string[],
    @Query('branchId') branchId?: string,
    @Query('storeId') storeId?: string,
    @Query('search') search?: string,
    @Query('storeName') storeName?: string,
    @Query('createdBy') createdBy?: string,
    @Query('sale') sale?: string
  ) {
    // Get user ID from authorization token
    const authHeader = req.headers.authorization;
    this.logger.log('Auth header found:', authHeader);

    const user = AuthHelper.extractUserIdFromToken(authHeader);
    if (user) {
      this.logger.log('User ID extracted from token:', user);
    }

    // Convert createdBy to boolean
    const createdByBool = createdBy === 'true' || createdBy === '1';
    // Convert sale to boolean
    const saleBool = sale === 'true' || sale === '1';

    return await this.productService.findAll(
      limit ? +limit : 10,
      page ? +page : 1,
      status,
      category,
      tag,
      branchId,
      storeId,
      search,
      storeName,
      createdByBool,
      saleBool,
      user?.userId
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
   */ @Get(':productCode')
  async findOne(
    @Param('productCode') productCode: string,
    @Req() req: Request
  ) {
    try {
      const product = await this.productService.findOne(productCode);
      this.logger.log('authHeader', 'Auth header in findOne');

      // Get branch IDs for this product
      const branchIds =
        await this.productService.findProductBranches(productCode);

      // Get user ID from authorization token
      const authHeader = req.headers.authorization;
      let isFavorite = null;

      // Check if user is logged in and if this product is their favorite
      if (authHeader) {
        const user = AuthHelper.extractUserIdFromToken(authHeader);
        if (user && user.userId) {
          // Check if the product is favorited by the user
          isFavorite = await this.favoriteService.isFavorite(
            user.userId,
            productCode
          );
        }
      }

      // Return combined data
      return {
        ...product,
        branchIds,
        isFavorite,
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
    this.logger.log(dto, 'Update product DTO:');

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
      this.logger.log(dto.removeImages, 'removeImages');

      // Handle image removal if specified
      const imagesToRemove = FormDataHelper.parseIfJSON<string[]>(
        dto.removeImages,
        []
      );

      // Delete the files from the upload folder and remove from DB
      for (const image of imagesToRemove) {
        const deletionResult = this.fileUploadService.deleteFile(image);
        this.logger.log(
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
  /**
   * Get product details, its branches, and the store of the first branch
   * GET /products/:productCode/with-branches-and-store
   */
  @Get(':productCode/with-branches-and-store')
  async getProductWithBranchesAndStore(
    @Param('productCode') productCode: string,
    @Req() req: Request
  ) {
    // 1. Get product details
    const product = await this.productService.findOne(productCode);
    if (!product) {
      throw new NotFoundException(`Product with code ${productCode} not found`);
    }

    // Get userId from cookies (if present)
    let userId: string | undefined;
    if (req.cookies && req.cookies.userId) {
      userId = req.cookies.userId;
    } else {
      // fallback: try to extract from token if not in cookies
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const user = AuthHelper.extractUserIdFromToken(authHeader);
        if (user && user.userId) {
          userId = user.userId;
        }
      }
    }

    // Check if the product is favorited by the user
    let isFavorite = null;
    let customerProductStatus = null;
    if (userId) {
      isFavorite = await this.favoriteService.isFavorite(userId, productCode);
      // Get user phone from users table
      const branchRepo = this.productService['productBranchRepository'].manager;
      const userResult = await branchRepo.query(
        `SELECT phone FROM "user" WHERE id = $1 LIMIT 1`,
        [userId]
      );
      let userPhone: string | undefined = undefined;
      if (
        Array.isArray(userResult) &&
        userResult.length > 0 &&
        userResult[0] &&
        typeof userResult[0] === 'object' &&
        Object.prototype.hasOwnProperty.call(userResult[0], 'phone')
      ) {
        userPhone = (userResult[0] as Record<string, any>)['phone'];
      }
      if (userPhone) {
        // Now check in customer_products for this phone and productCode
        const statusResult = await branchRepo.query(
          `SELECT * FROM customer_products WHERE phone = $1 AND $2 = ANY(product_code) LIMIT 1`,
          [userPhone, productCode]
        );
        if (Array.isArray(statusResult) && statusResult.length > 0) {
          const firstResult = statusResult[0];
          if (
            firstResult &&
            typeof firstResult === 'object' &&
            Object.prototype.hasOwnProperty.call(firstResult, 'status')
          ) {
            customerProductStatus = (firstResult as { status: any }).status;
          } else {
            customerProductStatus = true;
          }
        } else {
          customerProductStatus = false;
        }
      } else {
        customerProductStatus = false;
      }
    }

    // 2. Get branch IDs for this product
    const branchIds =
      await this.productService.findProductBranches(productCode);
    let branches: any[] = [];
    let store: any = null;
    if (branchIds.length > 0) {
      // 3. Get branch details
      const placeholders = branchIds.map((_, idx) => `$${idx + 1}`).join(',');
      const query = `SELECT * FROM branches WHERE id IN (${placeholders})`;
      const branchRepo = this.productService['productBranchRepository'].manager;
      branches = await branchRepo.query(query, branchIds);

      // 4. Get store from the first branch (if exists)
      const firstBranch = branches[0] as Record<string, any>;
      if (firstBranch && firstBranch.store_id) {
        const storeQuery = `SELECT * FROM store WHERE id = $1 LIMIT 1`;
        const stores: any[] = await branchRepo.query(storeQuery, [
          firstBranch.store_id,
        ]);
        if (Array.isArray(stores) && stores.length > 0) {
          store = stores[0];
        }
      }
    }
    return {
      ...product,
      branches,
      store,
      isFavorite,
      customerProductStatus,
    };
  }
}
