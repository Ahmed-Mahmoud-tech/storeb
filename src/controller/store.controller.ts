import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFiles,
  HttpStatus,
  HttpException,
  BadRequestException,
  OnModuleInit,
  Patch,
  Logger,
} from '@nestjs/common';
import { StoreService } from '../services/store.service';
import { FileUploadService } from '../services/file-upload.service';
import { CreateStoreDto } from '../dto/store.dto';
import { CreateBranchDto } from '../dto/branch.dto';
import { Store } from '../model/store.model';
import { Branch } from '../model/branches.model';
import { createFileFieldsInterceptor } from '../interceptors/file-upload.interceptor';
import { FormDataParserInterceptor } from '../interceptors/form-data-parser.interceptor';
import { FormDataHelper } from '../utils/form-data.helper';

@Controller('stores')
export class StoreController implements OnModuleInit {
  private readonly logger = new Logger(StoreController.name);

  constructor(
    private readonly storeService: StoreService,
    private readonly fileUploadService: FileUploadService
  ) {}

  onModuleInit() {
    // Ensure upload directories exist when the application starts
    this.fileUploadService.ensureUploadDirectories();
  }

  /**
   * Create a new store with optional branches
   *
   * POST /stores
   */
  @Post()
  @UseInterceptors(
    FormDataParserInterceptor,
    createFileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'banner', maxCount: 1 },
    ])
  )
  async createStore(
    @Body() dto: Record<string, unknown>,
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; banner?: Express.Multer.File[] }
  ): Promise<Store> {
    try {
      // Create a type-safe DTO object
      const createStoreDto = new CreateStoreDto();

      // Basic string properties
      createStoreDto.storeName = dto.storeName as string;
      createStoreDto.ownerId = dto.ownerId as string;
      createStoreDto.logo = dto.logo as string;
      createStoreDto.banner = dto.banner as string;
      createStoreDto.themeColor = dto.themeColor as string;
      createStoreDto.phoneNumber = dto.phoneNumber as string;

      // Complex properties that need parsing
      createStoreDto.storeTypes = FormDataHelper.parseIfJSON<string[]>(
        dto.storeTypes,
        []
      );
      createStoreDto.hasDelivery = FormDataHelper.parseBoolean(dto.hasDelivery);
      createStoreDto.branches = FormDataHelper.parseIfJSON<CreateBranchDto[]>(
        dto.branches,
        []
      );

      // Ensure uploads directories exist
      this.fileUploadService.ensureUploadDirectories();

      // Handle logo file if uploaded
      if (files?.logo && files.logo.length > 0) {
        const logoPath = await this.fileUploadService.validateAndProcessUpload(
          files.logo[0],
          {
            width: 400,
            quality: 85,
            format: 'webp',
          }
        );
        createStoreDto.logo = logoPath || undefined;
      } else if (
        createStoreDto.logo &&
        typeof createStoreDto.logo !== 'string'
      ) {
        throw new BadRequestException(
          'Logo must be a valid image file or a string path'
        );
      }

      // Handle banner file if uploaded
      if (files?.banner && files.banner.length > 0) {
        const bannerPath =
          await this.fileUploadService.validateAndProcessUpload(
            files.banner[0],
            {
              width: 1200,
              height: 400,
              quality: 80,
              format: 'webp',
            }
          );
        createStoreDto.banner = bannerPath || undefined;
      } else if (
        createStoreDto.banner &&
        typeof createStoreDto.banner !== 'string'
      ) {
        throw new BadRequestException(
          'Banner must be a valid image file or a string path'
        );
      }

      // Create the store with processed image paths
      const store = await this.storeService.createStore(createStoreDto);
      this.logger.log(`Store created: ${store.name} (ID: ${store.id})`);
      return store;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      this.logger.error(
        `Error processing store images: ${errorMessage}`,
        error instanceof Error && error.stack ? error.stack : undefined
      );
      throw new HttpException(
        errorMessage || 'Error processing store images',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Add a new branch to an existing store
   *
   * POST /stores/:storeId/branches
   */
  @Post(':storeId/branches')
  async createBranch(
    @Param('storeId') storeId: string,
    @Body() createBranchDto: CreateBranchDto
  ): Promise<Branch> {
    const branch = await this.storeService.createBranchForStore(
      storeId,
      createBranchDto
    );
    this.logger.log(
      `Branch created for store ${storeId}: ${branch.name} (ID: ${branch.id})`
    );
    return branch;
  }

  /**
   * Get all stores
   *
   * GET /stores
   */
  @Get()
  async getAllStores(): Promise<Store[]> {
    const stores = await this.storeService.findAllStores();
    this.logger.log(`Retrieved ${stores.length} stores`);
    return stores;
  }

  /**
   * Get a store by ID
   *
   * GET /stores/:id
   */
  @Get(':id')
  async getStoreById(@Param('id') id: string): Promise<Store> {
    const store = await this.storeService.findStoreById(id);
    this.logger.log(`Retrieved store: ${store.name} (ID: ${store.id})`);
    return store;
  }

  @Get('storeName/:name')
  async findStoreByName(@Param('name') name: string): Promise<Store> {
    const store = await this.storeService.findStoreByName(name);
    this.logger.log(`Retrieved store by name: ${store.name} (ID: ${store.id})`);
    return store;
  }

  /**
   * Update a store
   *
   * PUT /stores/:id
   */
  @Put(':id')
  @UseInterceptors(
    FormDataParserInterceptor,
    createFileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'banner', maxCount: 1 },
    ])
  )
  async updateStore(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; banner?: Express.Multer.File[] }
  ): Promise<Store> {
    try {
      const updateStoreDto: Partial<CreateStoreDto> = {};

      // Only set properties that are provided
      if (dto.storeName) {
        updateStoreDto.storeName = dto.storeName as string;
      }

      if (dto.themeColor) {
        updateStoreDto.themeColor = dto.themeColor as string;
      }

      if (dto.phoneNumber) {
        updateStoreDto.phoneNumber = dto.phoneNumber as string;
      }

      if (dto.hasDelivery !== undefined) {
        updateStoreDto.hasDelivery = FormDataHelper.parseBoolean(
          dto.hasDelivery
        );
      }

      if (dto.storeTypes) {
        updateStoreDto.storeTypes = FormDataHelper.parseIfJSON<string[]>(
          dto.storeTypes,
          []
        );
      }

      // Process branches if provided
      if (dto.branches) {
        updateStoreDto.branches = FormDataHelper.parseIfJSON<CreateBranchDto[]>(
          dto.branches,
          []
        );
      }

      if (dto.ownerId) {
        updateStoreDto.ownerId = dto.ownerId as string;
      }

      // Process logo if provided
      if (files?.logo && files.logo.length > 0) {
        const logoPath = await this.fileUploadService.validateAndProcessUpload(
          files.logo[0],
          {
            width: 600,
            quality: 85,
            format: 'webp',
          }
        );
        updateStoreDto.logo = logoPath || undefined;
      } else if (dto.logo !== undefined) {
        updateStoreDto.logo = dto.logo as string;
      }

      // Process banner if provided
      if (files?.banner && files.banner.length > 0) {
        const bannerPath =
          await this.fileUploadService.validateAndProcessUpload(
            files.banner[0],
            {
              width: 1200,
              height: 400,
              quality: 80,
              format: 'webp',
            }
          );
        updateStoreDto.banner = bannerPath || undefined;
      } else if (dto.banner !== undefined) {
        updateStoreDto.banner = dto.banner as string;
      }

      // Update the store
      const updatedStore = await this.storeService.updateStore(
        id,
        updateStoreDto
      );
      this.logger.log(
        `Store updated: ${updatedStore.name} (ID: ${updatedStore.id})`
      );
      return updatedStore;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      this.logger.error(
        `Error updating store: ${errorMessage}`,
        error instanceof Error && error.stack ? error.stack : undefined
      );
      throw new HttpException(
        errorMessage || 'Error updating store',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Delete a store
   *
   * DELETE /stores/:id
   */
  @Delete(':id')
  async deleteStore(@Param('id') id: string): Promise<{ message: string }> {
    await this.storeService.deleteStore(id);
    this.logger.log(`Store deleted (ID: ${id})`);
    return { message: `Store with ID ${id} deleted successfully` };
  }

  /**
   * Get all branches of a store
   *
   * GET /stores/:storeId/branches
   */
  @Get(':storeId/branches')
  async getBranchesByStoreId(
    @Param('storeId') storeId: string
  ): Promise<Branch[]> {
    const branches = await this.storeService.findAllBranchesByStoreId(storeId);
    this.logger.log(
      `Retrieved ${branches.length} branches for store ${storeId}`
    );
    return branches;
  }

  /**
   * Get a specific branch
   *
   * GET /stores/branches/:branchId
   */
  @Get('branches/:branchId')
  async getBranchById(@Param('branchId') branchId: string): Promise<Branch> {
    const branch = await this.storeService.findBranchById(branchId);
    this.logger.log(`Retrieved branch: ${branch.name} (ID: ${branch.id})`);
    return branch;
  }

  /**
   * Update a branch
   *
   * PUT /stores/branches/:branchId
   */
  @Put('branches/:branchId')
  async updateBranch(
    @Param('branchId') branchId: string,
    @Body() updateBranchDto: Partial<CreateBranchDto>
  ): Promise<Branch> {
    const branch = await this.storeService.updateBranch(
      branchId,
      updateBranchDto
    );
    this.logger.log(`Branch updated: ${branch.name} (ID: ${branch.id})`);
    return branch;
  }

  /**
   * Partial update of a branch
   *
   * PATCH /stores/branches/:branchId
   */
  @Patch('branches/:branchId')
  async patchBranch(
    @Param('branchId') branchId: string,
    @Body() updateBranchDto: Partial<CreateBranchDto>
  ): Promise<Branch> {
    const branch = await this.storeService.updateBranch(
      branchId,
      updateBranchDto
    );
    this.logger.log(
      `Branch partially updated: ${branch.name} (ID: ${branch.id})`
    );
    return branch;
  }

  /**
   * Delete a branch
   *
   * DELETE /stores/branches/:branchId
   */
  @Delete('branches/:branchId')
  async deleteBranch(
    @Param('branchId') branchId: string
  ): Promise<{ message: string }> {
    await this.storeService.deleteBranch(branchId);
    this.logger.log(`Branch deleted (ID: ${branchId})`);
    return { message: `Branch with ID ${branchId} deleted successfully` };
  }
}
