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
      createStoreDto.ownerId =
        (dto.ownerId as string) || '3a9fda4b-9068-4a7f-99bc-a7b927981c67';
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
            width: 600,
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
      return await this.storeService.createStore(createStoreDto);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
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
    return this.storeService.createBranchForStore(storeId, createBranchDto);
  }

  /**
   * Get all stores
   *
   * GET /stores
   */
  @Get()
  async getAllStores(): Promise<Store[]> {
    return await this.storeService.findAllStores();
  }

  /**
   * Get a store by ID
   *
   * GET /stores/:id
   */
  @Get(':id')
  async getStoreById(@Param('id') id: string): Promise<Store> {
    return await this.storeService.findStoreById(id);
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
      return await this.storeService.updateStore(id, updateStoreDto);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
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
    return await this.storeService.findAllBranchesByStoreId(storeId);
  }

  /**
   * Get a specific branch
   *
   * GET /stores/branches/:branchId
   */
  @Get('branches/:branchId')
  async getBranchById(@Param('branchId') branchId: string): Promise<Branch> {
    return await this.storeService.findBranchById(branchId);
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
    return await this.storeService.updateBranch(branchId, updateBranchDto);
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
    return await this.storeService.updateBranch(branchId, updateBranchDto);
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
    return { message: `Branch with ID ${branchId} deleted successfully` };
  }
}
