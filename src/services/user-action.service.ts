import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UserAction, ActionType } from '../model/user-actions.model';
import {
  CreateUserActionDto,
  GetUserActionsQueryDto,
} from '../dto/user-action.dto';

@Injectable()
export class UserActionService {
  private readonly logger = new Logger(UserActionService.name);

  constructor(
    @InjectRepository(UserAction)
    private readonly userActionRepository: Repository<UserAction>
  ) {}

  /**
   * Record a user action
   * @param userId - The ID of the user performing the action
   * @param createUserActionDto - The action data
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent string
   * @returns The created user action record
   */
  async recordAction(
    userId: string,
    createUserActionDto: CreateUserActionDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserAction> {
    console.error(`\n>>> UserActionService.recordAction CALLED <<<`);
    console.error(
      `Recording action: ${createUserActionDto.action_type} for user: ${userId}`
    );
    console.error(`Action details: ${JSON.stringify(createUserActionDto)}`);
    this.logger.log(
      `Recording action: ${createUserActionDto.action_type} for user: ${userId}`
    );
    this.logger.log(`Action details: ${JSON.stringify(createUserActionDto)}`);

    try {
      const userAction = this.userActionRepository.create({
        user_id: userId,
        action_type: createUserActionDto.action_type,
        store_id: createUserActionDto.store_id,
        product_id: createUserActionDto.product_id,
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
  ): Promise<UserAction> {
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
}
