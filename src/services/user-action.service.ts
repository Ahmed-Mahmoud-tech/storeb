import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UserAction, ActionType } from '../model/user-actions.model';
import {
  CreateUserActionDto,
  GetUserActionsQueryDto,
} from '../dto/user-action.dto';
import { Store } from '../model/store.model';
import { EmployeeService } from './employee.service';
import { Branch } from '../model/branches.model';
import { Product } from '../model/product.model';
import { ProductBranch } from '../model/product_branches.model';

@Injectable()
export class UserActionService {
  private readonly logger = new Logger(UserActionService.name);

  constructor(
    @InjectRepository(UserAction)
    private readonly userActionRepository: Repository<UserAction>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductBranch)
    private readonly productBranchRepository: Repository<ProductBranch>,
    private readonly employeeService: EmployeeService
  ) {}

  /**
   * Check if user is owner or staff of a store
   * @param userId - The user ID to check
   * @param storeId - The store ID to check
   * @returns true if user is owner or staff, false otherwise
   */
  private async isUserOwnerOrStaffOfStore(
    userId: string,
    storeId: string
  ): Promise<boolean> {
    try {
      const store = await this.storeRepository.findOne({
        where: { id: storeId },
      });

      if (!store) {
        return false;
      }

      // Check if user is the owner
      if (store.owner_id === userId) {
        return true;
      }

      // Check if user is staff (manager or sales)
      const isStaff = await this.employeeService.isUserStaffOfStore(
        userId,
        storeId
      );
      return isStaff;
    } catch (error) {
      this.logger.warn(
        `Error checking if user ${userId} is owner/staff of store ${storeId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
      return false;
    }
  }

  /**
   * Get the store ID for a product
   * @param productId - The product ID
   * @returns The store ID if product belongs to a store, null otherwise
   */
  private async getStoreIdForProduct(
    productId: string
  ): Promise<string | null> {
    try {
      // Get product branches for this product
      const productBranch = await this.productBranchRepository.findOne({
        where: { product_code: productId },
      });

      if (!productBranch || !productBranch.branch_id) {
        return null;
      }

      // Get the branch to find its store
      const branch = await this.branchRepository.findOne({
        where: { id: productBranch.branch_id },
      });

      return branch?.store_id || null;
    } catch (error) {
      this.logger.warn(
        `Error getting store for product ${productId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
      return null;
    }
  }

  /**
   * Record a user action
   * @param userId - The ID of the user performing the action (can be a UUID or anon-* identifier for anonymous users)
   * @param createUserActionDto - The action data
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent string
   * @returns The created user action record or null if user is owner/staff of the store
   */
  async recordAction(
    userId?: string,
    createUserActionDto?: CreateUserActionDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserAction | null> {
    console.error(`\n>>> UserActionService.recordAction CALLED <<<`);
    console.error(
      `Recording action: ${createUserActionDto?.action_type} for user: ${userId || 'anonymous'}`
    );
    console.error(`Action details: ${JSON.stringify(createUserActionDto)}`);
    this.logger.log(
      `Recording action: ${createUserActionDto?.action_type} for user: ${userId || 'anonymous'}`
    );
    this.logger.log(`Action details: ${JSON.stringify(createUserActionDto)}`);
    // Validate required parameters
    if (!userId || !createUserActionDto) {
      this.logger.warn(
        `Skipped recording action: missing userId or action data`
      );
      return null;
    }

    try {
      let storeIdToCheck: string | undefined;
      let realUserId: string | null = null;
      let anonymousUserId: string | null = null;

      // Determine if this is an anonymous user (starts with anon- or is not a valid UUID)
      const isAnonymous =
        userId.startsWith('anon-') || !this.isValidUuid(userId);

      if (isAnonymous) {
        // For anonymous users: store their identifier in anonymous_user_id, keep user_id as null
        anonymousUserId = userId.startsWith('anon-')
          ? userId
          : `anon-${userId}`;
        realUserId = null;
        this.logger.log(`Anonymous user detected: ${anonymousUserId}`);
      } else {
        // For logged-in users: verify the user exists before storing their UUID
        try {
          const userExists = await this.storeRepository.manager
            .createQueryBuilder()
            .select('id')
            .from('user', 'user')
            .where('id = :userId', { userId })
            .getRawOne();

          if (userExists) {
            realUserId = userId;
            this.logger.log(`Logged-in user detected: ${realUserId}`);
          } else {
            // User ID is a valid UUID but doesn't exist - treat as anonymous
            anonymousUserId = `anon-${userId}`;
            realUserId = null;
            this.logger.log(
              `User ${userId} not found in database, treating as anonymous`
            );
          }
        } catch (error) {
          this.logger.warn(
            `Error verifying user ${userId} existence: ${
              error instanceof Error ? error.message : 'unknown error'
            }, treating as anonymous`
          );
          anonymousUserId = `anon-${userId}`;
          realUserId = null;
        }
      }

      // Determine which store to check based on action type and available data
      if (createUserActionDto.store_id) {
        storeIdToCheck = createUserActionDto.store_id;
      } else if (createUserActionDto.product_id) {
        // If product is involved, get the store that owns the product
        const productStore = await this.getStoreIdForProduct(
          createUserActionDto.product_id
        );
        if (productStore) {
          storeIdToCheck = productStore;
        }
      }

      // Verify that the store_id exists in the database if provided
      let validatedStoreId: string | null = null;
      if (storeIdToCheck) {
        const storeExists = await this.storeRepository.findOne({
          where: { id: storeIdToCheck },
        });
        if (storeExists) {
          validatedStoreId = storeIdToCheck;
        } else {
          this.logger.warn(
            `Store ${storeIdToCheck} does not exist. Recording action without store reference.`
          );
          storeIdToCheck = undefined;
        }
      }

      // Check if user is owner or staff of the store involved in this action (only for real users)
      if (validatedStoreId && realUserId) {
        const isOwnerOrStaff = await this.isUserOwnerOrStaffOfStore(
          realUserId,
          validatedStoreId
        );

        if (isOwnerOrStaff) {
          this.logger.log(
            `Action skipped: User ${realUserId} is owner/staff of store ${validatedStoreId}`
          );
          console.error('Action skipped: User is owner or staff of the store');
          return null;
        }
      }

      const userAction = this.userActionRepository.create({
        user_id: realUserId || null,
        anonymous_user_id: anonymousUserId,
        action_type: createUserActionDto.action_type,
        store_id: validatedStoreId,
        product_id: createUserActionDto.product_id || null,
        metadata: createUserActionDto.metadata,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      console.error(
        `Created user action object: ${JSON.stringify(userAction)}`
      );
      this.logger.log(
        `Created user action object: ${JSON.stringify(userAction)}`
      );

      const savedAction = await this.userActionRepository.save(userAction);

      console.error(`✅ Successfully saved action with ID: ${savedAction.id}`);
      this.logger.log(`Successfully saved action with ID: ${savedAction.id}`);

      return savedAction;
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      const err = error instanceof Error ? error : new Error(errorMessage);
      console.error(`!!! ERROR in recordAction: ${err.message}`);
      console.error(`Stack: ${err.stack}`);
      this.logger.error(`Failed to record action: ${err.message}`);
      this.logger.error(err.stack);
      throw new HttpException(
        'Failed to record user action',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get user actions with optional filters
   * @param userId - The ID of the user
   * @param query - Query parameters for filtering
   * @returns Array of user actions
   */
  async getUserActions(
    userId: string,
    query: GetUserActionsQueryDto
  ): Promise<{ data: UserAction[]; total: number }> {
    this.logger.log(`Fetching actions for user: ${userId}`);

    const {
      action_type,
      store_id,
      product_id,
      start_date,
      end_date,
      limit = '50',
      offset = '0',
    } = query;

    const whereClause: Record<string, any> = { user_id: userId };

    if (action_type) {
      whereClause.action_type = action_type;
    }

    if (store_id) {
      whereClause.store_id = store_id;
    }

    if (product_id) {
      whereClause.product_id = product_id;
    }

    if (start_date && end_date) {
      whereClause.created_at = Between(
        new Date(start_date),
        new Date(end_date)
      );
    }

    try {
      const [data, total] = await this.userActionRepository.findAndCount({
        where: whereClause,
        order: { created_at: 'DESC' },
        take: parseInt(limit, 10),
        skip: parseInt(offset, 10),
        relations: ['store', 'product'],
      });

      return { data, total };
    } catch (error) {
      this.logger.error(`Failed to fetch user actions: ${error}`);
      throw new HttpException(
        'Failed to fetch user actions',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get action statistics for a user
   * @param userId - The ID of the user
   * @returns Action statistics
   */
  async getUserActionStats(userId: string): Promise<any> {
    this.logger.log(`Fetching action stats for user: ${userId}`);

    try {
      const stats = await this.userActionRepository
        .createQueryBuilder('action')
        .select('action.action_type', 'action_type')
        .addSelect('COUNT(*)', 'count')
        .where('action.user_id = :userId', { userId })
        .groupBy('action.action_type')
        .getRawMany();

      return stats;
    } catch (error) {
      this.logger.error(`Failed to fetch action stats: ${error}`);
      throw new HttpException(
        'Failed to fetch action statistics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get actions for a specific store
   * @param storeId - The ID of the store
   * @param query - Query parameters
   * @returns Array of user actions for the store
   */
  async getStoreActions(
    storeId: string,
    query: GetUserActionsQueryDto
  ): Promise<{
    data: UserAction[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    this.logger.log(`Fetching actions for store: ${storeId}`);

    const {
      action_type,
      start_date,
      end_date,
      limit = '10',
      page = '1',
    } = query;

    // Convert page to offset: page 1 = offset 0, page 2 = offset 10, etc.
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = parseInt(limit, 10);
    const offset = (pageNum - 1) * pageSize;

    const whereClause: Record<string, any> = { store_id: storeId };

    if (action_type) {
      whereClause.action_type = action_type;
    }

    if (start_date && end_date) {
      whereClause.created_at = Between(
        new Date(start_date),
        new Date(end_date)
      );
    }

    try {
      const [data, total] = await this.userActionRepository.findAndCount({
        where: whereClause,
        order: { created_at: 'DESC' },
        take: pageSize,
        skip: offset,
        relations: ['user', 'product', 'store'],
      });

      const totalPages = Math.ceil(total / pageSize);

      return { data, total, page: pageNum, pageSize, totalPages };
    } catch (error) {
      this.logger.error(`Failed to fetch store actions: ${error}`);
      throw new HttpException(
        'Failed to fetch store actions',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get actions for a specific product
   * @param productId - The ID of the product
   * @param query - Query parameters
   * @returns Array of user actions for the product
   */
  async getProductActions(
    productId: string,
    query: GetUserActionsQueryDto
  ): Promise<{ data: UserAction[]; total: number }> {
    this.logger.log(`Fetching actions for product: ${productId}`);

    const {
      action_type,
      start_date,
      end_date,
      limit = '50',
      offset = '0',
    } = query;

    const whereClause: Record<string, any> = { product_id: productId };

    if (action_type) {
      whereClause.action_type = action_type;
    }

    if (start_date && end_date) {
      whereClause.created_at = Between(
        new Date(start_date),
        new Date(end_date)
      );
    }

    try {
      const [data, total] = await this.userActionRepository.findAndCount({
        where: whereClause,
        order: { created_at: 'DESC' },
        take: parseInt(limit, 10),
        skip: parseInt(offset, 10),
        relations: ['user', 'store'],
      });

      return { data, total };
    } catch (error) {
      this.logger.error(`Failed to fetch product actions: ${error}`);
      throw new HttpException(
        'Failed to fetch product actions',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Record a product search action
   * @param userId - User ID (can be anonymous)
   * @param storeId - Store ID where search occurred
   * @param searchQuery - The search query string
   * @param ipAddress - Client IP address
   * @param userAgent - Client user agent
   */
  async recordSearch(
    userId: string,
    storeId: string,
    searchQuery: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserAction | null> {
    this.logger.log(
      `Recording search: "${searchQuery}" in store: ${storeId}, user: ${userId || 'anonymous'}`
    );

    return this.recordAction(
      userId,
      {
        action_type: ActionType.SEARCH,
        store_id: storeId,
        metadata: {
          search_query: searchQuery,
        },
      },
      ipAddress,
      userAgent
    );
  }

  /**
   * Check if a string is a valid UUID
   * @param uuid - The string to validate
   * @returns true if valid UUID, false otherwise
   */
  private isValidUuid(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
