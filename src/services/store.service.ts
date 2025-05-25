import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../model/store.model';
import { Branch } from '../model/branches.model';
import { StoreBranch } from '../model/store_branches.model';
import { CreateStoreDto } from '../dto/store.dto';
import { CreateBranchDto } from '../dto/branch.dto';
// import { create } from 'domain';

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(StoreBranch)
    private storeBranchRepository: Repository<StoreBranch>
  ) {}
  // createStore(createStoreDto: CreateStoreDto): void {
  //   console.log(createStoreDto, 'createStoreDto');
  // }
  async createStore(createStoreDto: CreateStoreDto): Promise<Store> {
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

    console.log('Store Service - Received logo:', logo);
    console.log('Store Service - Received banner:', banner);

    // Store logo and banner as URLs
    store.logo = logo || null;
    store.banner = banner || null;
    store.theme_color = themeColor;
    store.delivery = hasDelivery;
    store.type = storeTypes[0]; // Using the first store type as primary
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
        .set({ phone: phoneNumber })
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

    // Create store-branch relationship in the junction table
    const storeBranch = new StoreBranch();
    storeBranch.store_id = storeId;
    storeBranch.branch_id = savedBranch.id;

    await this.storeBranchRepository.save(storeBranch);

    return savedBranch;
  }

  // READ operations for Store
  async findAllStores(): Promise<Store[]> {
    return this.storeRepository.find();
  }

  async findStoreById(id: string): Promise<Store> {
    const store = await this.storeRepository.findOne({ where: { id } });
    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }
    return store;
  }

  // UPDATE operations for Store
  async updateStore(
    id: string,
    updateData: Partial<CreateStoreDto>
  ): Promise<Store> {
    // First check if store exists
    const store = await this.findStoreById(id);

    // Update store properties
    if (updateData.storeName) {
      store.name = updateData.storeName;
    }

    if (updateData.logo !== undefined) {
      store.logo = updateData.logo || null;
    }

    if (updateData.banner !== undefined) {
      store.banner = updateData.banner || null;
    }

    if (updateData.themeColor !== undefined) {
      store.theme_color = updateData.themeColor;
    }

    if (updateData.hasDelivery !== undefined) {
      store.delivery = updateData.hasDelivery;
    }

    if (updateData.storeTypes && updateData.storeTypes.length > 0) {
      store.type = updateData.storeTypes[0];
    }

    // Save updated store to database
    const updatedStore = await this.storeRepository.save(store);

    // Update phone number if provided
    if (updateData.phoneNumber) {
      await this.storeRepository.manager
        .createQueryBuilder()
        .update('user')
        .set({ phone: updateData.phoneNumber })
        .where('id = :ownerId', { ownerId: store.owner_id })
        .execute();
    }

    return updatedStore;
  }
  // DELETE operations for Store
  async deleteStore(id: string): Promise<void> {
    // First check if store exists
    await this.findStoreById(id);

    // Find all branches for this store
    const branches = await this.branchRepository.find({
      where: { store_id: id },
    });

    // Delete store-branch relationships first
    await Promise.all(
      branches.map((branch) =>
        this.storeBranchRepository.delete({
          store_id: id,
          branch_id: branch.id,
        })
      )
    );

    // Delete all branches for this store
    if (branches.length > 0) {
      await this.branchRepository.remove(branches);
    }

    // Delete the store
    await this.storeRepository.delete(id);
  }
  // READ operations for Branch
  async findAllBranchesByStoreId(storeId: string): Promise<Branch[]> {
    // First check if store exists
    await this.findStoreById(storeId);

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
    // First check if branch exists
    const branch = await this.findBranchById(id);

    // Delete store-branch relationship first
    await this.storeBranchRepository.delete({
      store_id: branch.store_id,
      branch_id: id,
    });

    // Delete the branch
    await this.branchRepository.delete(id);
  }
}
