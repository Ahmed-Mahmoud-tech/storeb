import { Logger, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../model/store.model';
import { Branch } from '../model/branches.model';
import { CreateStoreDto } from '../dto/store.dto';
import { CreateBranchDto } from '../dto/branch.dto';
import { FileUploadService } from './file-upload.service';
import { UserActionService } from './user-action.service';
import { ActionType } from '../model/user-actions.model';

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    private fileUploadService: FileUploadService,
    private userActionService: UserActionService
  ) {}

  async createStore(createStoreDto: CreateStoreDto): Promise<Store> {
    this.logger.log(`Creating store: ${createStoreDto.storeName}`);
    const {
      storeName,
      logo,
      banner,
      themeColor,
      hasDelivery,
      storeTypes,
      branches,
      ownerId,
      phoneNumber,
    } = createStoreDto; // Create store entity
    const store = new Store();
    store.name = storeName;

    // Store logo and banner as URLs
    store.logo = logo || null;
    store.banner = banner || null;
    store.theme_color = themeColor;
    store.delivery = hasDelivery;
    store.type = storeTypes; // Using the entire storeTypes array
    store.owner_id = ownerId;

    const existingStore = await this.storeRepository.findOne({
      where: { name: storeName },
    });
    if (existingStore) {
      throw new Error('Store name must be unique');
    }
    // Save store to database
    const savedStore = await this.storeRepository.save(store);
    // Save phoneNumber to user with id ownerId
    if (phoneNumber) {
      await this.storeRepository.manager
        .createQueryBuilder()
        .update('user')
        .set({ phone: phoneNumber, type: 'owner' })
        .where('id = :ownerId', { ownerId })
        .execute();
    }
    // If branches are provided, create them
    if (branches && branches.length > 0) {
      await this.createBranches(savedStore.id, branches);
    }
    return savedStore;
  }

  async createBranches(
    storeId: string,
    branchDtos: CreateBranchDto[]
  ): Promise<void> {
    // Process each branch
    for (const branchDto of branchDtos) {
      await this.createBranchForStore(storeId, branchDto);
    }
  }
  async createBranchForStore(
    storeId: string,
    branchDto: CreateBranchDto
  ): Promise<Branch> {
    // Create branch entity
    const branch = new Branch();
    branch.store_id = storeId;
    branch.name = branchDto.name;
    branch.address = branchDto.coordinates.address;
    branch.lat = branchDto.coordinates.lat.toString();
    branch.lang = branchDto.coordinates.lng.toString();

    // Handle support numbers
    if (branchDto.supportNumbers && branchDto.supportNumbers.length > 0) {
      branch.customer_support = branchDto.supportNumbers.map(
        (support) =>
          `${support.phone}:${support.whatsapp ? 'whatsapp' : 'phone'}`
      );
    }

    // Save branch to database
    const savedBranch = await this.branchRepository.save(branch);

    return savedBranch;
  }

  // READ operations for Store
  async findAllStores(): Promise<Store[]> {
    return this.storeRepository.find();
  }
  async findStoreById(id: string): Promise<Store & { branches?: Branch[] }> {
    const store = await this.storeRepository.findOne({ where: { id } });
    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    // Get branches for this store
    const branches = await this.branchRepository.find({
      where: { store_id: id },
    }); // Return store with branches
    return { ...store, branches };
  }

  async findStoreByName(
    name: string
  ): Promise<Store & { branches?: Branch[]; owner?: any }> {
    let store = await this.storeRepository.findOne({ where: { name } });

    // If not found, try replacing underscores with spaces (for URL-safe names)
    if (!store && name.includes('_')) {
      const nameWithSpaces = name.replace(/_/g, ' ');
      store = await this.storeRepository.findOne({
        where: { name: nameWithSpaces },
      });
      this.logger.log(
        `Store lookup: tried with spaces: ${nameWithSpaces}, found: ${!!store}`
      );
    }

    if (!store) {
      throw new NotFoundException(`Store with name ${name} not found`);
    }

    // Get branches for this store
    const branches = await this.branchRepository.find({
      where: { store_id: store.id },
    });

    // Return store with branches and ensure owner_id is included
    // Fetch full owner data from user table
    const owner = await this.storeRepository.manager
      .createQueryBuilder()
      .select('*')
      .from('user', 'user')
      .where('id = :ownerId', { ownerId: store.owner_id })
      .getRawOne();

    return { ...store, branches, owner };
  }

  async findStoreByOwnerId(
    ownerId: string
  ): Promise<Store & { branches?: Branch[] }> {
    const store = await this.storeRepository.findOne({
      where: { owner_id: ownerId },
    });
    if (!store) {
      throw new NotFoundException(`Store with owner ID ${ownerId} not found`);
    }

    // Get branches for this store
    const branches = await this.branchRepository.find({
      where: { store_id: store.id },
    });

    // Return store with branches
    return { ...store, branches };
  }

  async checkOwnerHasStore(ownerId: string): Promise<boolean> {
    const store = await this.storeRepository.findOne({
      where: { owner_id: ownerId },
    });
    return !!store;
  }

  // UPDATE operations for Store
  async updateStore(
    id: string,
    updateData: Partial<CreateStoreDto>
  ): Promise<Store & { branches?: Branch[] }> {
    // First check if store exists
    const store = await this.findStoreById(id);

    // Update store properties
    if (updateData.storeName) {
      store.name = updateData.storeName;
    }
    if (updateData.logo !== undefined) {
      // Always delete the old logo file if it exists and:
      // - Either we're changing to a different logo
      // - Or we're removing the logo completely
      if (store.logo && (!updateData.logo || store.logo !== updateData.logo)) {
        this.fileUploadService.deleteFile(store.logo);
      }
      store.logo = updateData.logo || null;
    }

    if (updateData.banner !== undefined) {
      // Always delete the old banner file if it exists and:
      // - Either we're changing to a different banner
      // - Or we're removing the banner completely
      if (
        store.banner &&
        (!updateData.banner || store.banner !== updateData.banner)
      ) {
        this.fileUploadService.deleteFile(store.banner);
      }
      store.banner = updateData.banner || null;
    }

    if (updateData.themeColor !== undefined) {
      store.theme_color = updateData.themeColor;
    }

    if (updateData.hasDelivery !== undefined) {
      store.delivery = updateData.hasDelivery;
    }

    if (updateData.storeTypes && updateData.storeTypes.length > 0) {
      store.type = updateData.storeTypes;
    }

    // Save updated store to database
    await this.storeRepository.save(store);

    // Update phone number if provided
    if (updateData.phoneNumber) {
      await this.storeRepository.manager
        .createQueryBuilder()
        .update('user')
        .set({ phone: updateData.phoneNumber })
        .where('id = :ownerId', { ownerId: store.owner_id })
        .execute();
    }

    // Update branches if provided
    if (updateData.branches && updateData.branches.length > 0) {
      await this.updateBranchesForStore(id, updateData.branches);
    } // Get updated store with branches
    return this.findStoreById(id);
  }

  // DELETE operations for Store
  async deleteStore(id: string): Promise<void> {
    // First check if store exists
    const store = await this.findStoreById(id);

    // Find all branches for this store
    const branches = await this.branchRepository.find({
      where: { store_id: id },
    });

    // Delete all branches for this store
    if (branches.length > 0) {
      await this.branchRepository.remove(branches);
    }

    // Delete associated image files
    if (store.logo) {
      this.fileUploadService.deleteFile(store.logo);
    }
    if (store.banner) {
      this.fileUploadService.deleteFile(store.banner);
    }

    // Delete the store
    await this.storeRepository.delete(id);
  }

  // READ operations for Branch
  async findAllBranchesByStoreId(storeId: string): Promise<Branch[]> {
    // Check if store exists directly to avoid circular calls
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    return this.branchRepository.find({
      where: { store_id: storeId },
    });
  }

  async findBranchById(id: string): Promise<Branch> {
    const branch = await this.branchRepository.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }
    return branch;
  }

  // UPDATE operations for Branch
  async updateBranch(
    id: string,
    updateData: Partial<CreateBranchDto>
  ): Promise<Branch> {
    // First check if branch exists
    const branch = await this.findBranchById(id);

    // Update branch properties
    if (updateData.name) {
      branch.name = updateData.name;
    }

    if (updateData.coordinates) {
      if (updateData.coordinates.address) {
        branch.address = updateData.coordinates.address;
      }

      if (updateData.coordinates.lat) {
        branch.lat = updateData.coordinates.lat.toString();
      }

      if (updateData.coordinates.lng) {
        branch.lang = updateData.coordinates.lng.toString();
      }
    }
    if (updateData.supportNumbers && updateData.supportNumbers.length > 0) {
      branch.customer_support = updateData.supportNumbers.map(
        (support) =>
          `${support.phone}:${support.whatsapp ? 'whatsapp' : 'phone'}`
      );
    }

    // Save updated branch to database
    return this.branchRepository.save(branch);
  }

  // DELETE operations for Branch
  async deleteBranch(id: string): Promise<void> {
    // First check if branch exists - validates that it exists
    await this.findBranchById(id);

    // Delete the branch
    await this.branchRepository.delete(id);
  }
  /**
   * Update branches for a store - handles creating, updating, and removing branches
   * @param storeId The ID of the store
   * @param branches The new branches configuration
   */
  async updateBranchesForStore(
    storeId: string,
    branches: CreateBranchDto[]
  ): Promise<void> {
    // Get current branches
    const currentBranches = await this.branchRepository.find({
      where: { store_id: storeId },
    });

    // Create maps of existing branches by ID and name for easy lookup
    const existingBranchMapById = new Map<string, Branch>();
    const existingBranchMapByName = new Map<string, Branch>();

    for (const branch of currentBranches) {
      existingBranchMapById.set(branch.id, branch);
      existingBranchMapByName.set(branch.name, branch);
    }

    // Track which branches have been processed
    const processedBranchIds = new Set<string>();

    // Process each incoming branch
    for (const branchDto of branches) {
      let existingBranch: Branch | undefined;

      // First try to find by ID if provided
      if (branchDto.id) {
        existingBranch = existingBranchMapById.get(branchDto.id);
      }

      // If not found by ID or no ID provided, try by name
      if (!existingBranch) {
        existingBranch = existingBranchMapByName.get(branchDto.name);
      }

      if (existingBranch) {
        // Update existing branch
        await this.updateBranch(existingBranch.id, branchDto);
        processedBranchIds.add(existingBranch.id);
      } else {
        // Create new branch
        const newBranch = await this.createBranchForStore(storeId, branchDto);
        processedBranchIds.add(newBranch.id);
      }
    }

    // Delete branches that are not in the new configuration
    for (const branch of currentBranches) {
      if (!processedBranchIds.has(branch.id)) {
        await this.deleteBranch(branch.id);
      }
    }
  }

  /**
   * Record a store page view
   * Tracks when a user opens/views a store page
   * @param storeName - The name of the store being viewed
   * @param userId - Optional user ID (for anonymous users, this could be their anonymous ID)
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent string
   * @returns The created user action record
   */
  async recordStorePageView(
    storeName: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    try {
      let storeId: string | undefined;

      // Get the store to find its ID
      // Try exact match first, then try replacing underscores with spaces
      let store = await this.storeRepository.findOne({
        where: { name: storeName },
      });

      // If not found, try replacing underscores with spaces (for URL-safe names)
      if (!store && storeName.includes('_')) {
        const storeNameWithSpaces = storeName.replace(/_/g, ' ');
        store = await this.storeRepository.findOne({
          where: { name: storeNameWithSpaces },
        });
        this.logger.log(
          `Store lookup: tried with spaces: ${storeNameWithSpaces}, found: ${!!store}`
        );
      }

      if (store) {
        storeId = store.id;
        this.logger.log(
          `Recording store page view for store: ${store.name} (ID: ${store.id}), user: ${userId || 'anonymous'}`
        );
      } else {
        this.logger.warn(
          `Store not found for name: ${storeName}. Recording action without store reference.`
        );
      }

      const actionResult = await this.userActionService.recordAction(
        userId,
        {
          action_type: ActionType.STORE_DETAILS_OPEN,
          store_id: storeId,
          metadata: {
            store_name: storeName,
            lookup_attempted: true,
          },
        },
        ipAddress,
        userAgent
      );

      this.logger.log(
        `Successfully recorded store page view. Action ID: ${actionResult.id}, store_id: ${storeId || 'null'}`
      );
      return actionResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(
        `Failed to record store page view for store ${storeName}: ${errorMessage}`
      );
      this.logger.error(errorStack);
      // Don't throw - we still want to allow the page to load even if tracking fails
      throw error;
    }
  }

  /**
   * Check if a user is the owner of a specific store
   * @param userId - The user ID to check
   * @param storeId - The store ID to check against
   * @returns true if user is the owner of the store, false otherwise
   */
  async isUserOwnerOfStore(userId: string, storeId: string): Promise<boolean> {
    if (!userId || !storeId) {
      return false;
    }

    try {
      const store = await this.storeRepository.findOne({
        where: { id: storeId },
      });

      return store ? store.owner_id === userId : false;
    } catch (error) {
      this.logger.warn(
        `Error checking if user ${userId} is owner of store ${storeId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
      return false;
    }
  }
}
