import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from '../model/favorite.model';
import { CreateFavoriteDto, UpdateFavoriteDto } from '../dto/favorite.dto';
import { ProductService } from './product.service';
import { UserActionService } from './user-action.service';
import { ActionType } from '../model/user-actions.model';
import { Branch } from '../model/branches.model';

@Injectable()
export class FavoriteService {
  private readonly logger = new Logger(FavoriteService.name);

  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @Inject(forwardRef(() => ProductService))
    private productService: ProductService,
    private userActionService: UserActionService
  ) {}

  async create(createFavoriteDto: CreateFavoriteDto): Promise<Favorite> {
    console.error('\n\n=== FAVORITE CREATE START ===');
    console.error(`Creating favorite: ${JSON.stringify(createFavoriteDto)}`);
    this.logger.log(`Creating favorite: ${JSON.stringify(createFavoriteDto)}`);

    const favorite = this.favoriteRepository.create(createFavoriteDto);
    const savedFavorite = await this.favoriteRepository.save(favorite);

    console.error(`Favorite saved: ${savedFavorite.id}`);
    console.error('Now attempting to track action...');
    this.logger.log('Favorite saved, now attempting to track action...');

    // Track the favorite action
    try {
      console.error(
        `About to get branches for product: ${createFavoriteDto.product}`
      );
      this.logger.log(
        `Tracking favorite action for product: ${createFavoriteDto.product}`
      );
      this.logger.log(`User ID: ${createFavoriteDto.user_id}`);

      // Get product details to find store_id
      let storeId: string | undefined;
      try {
        console.error('Calling productService.findProductBranches...');
        const branchIds = await this.productService.findProductBranches(
          createFavoriteDto.product
        );
        console.error(`Got branchIds: ${JSON.stringify(branchIds)}`);
        this.logger.log(`Found ${branchIds.length} branches for product`);

        if (branchIds && branchIds.length > 0) {
          // Get the first branch to find store_id
          const branch = await this.branchRepository.findOne({
            where: { id: branchIds[0] },
          });
          console.error(`Found branch: ${JSON.stringify(branch)}`);
          if (branch) {
            storeId = branch.store_id;
            console.error(`Found store_id: ${storeId}`);
            this.logger.log(`Found store_id: ${storeId}`);
          } else {
            console.error(`Branch not found for ID: ${branchIds[0]}`);
            this.logger.warn(`Branch not found for ID: ${branchIds[0]}`);
          }
        } else {
          console.error(
            `No branches found for product: ${createFavoriteDto.product}`
          );
          this.logger.warn(
            `No branches found for product: ${createFavoriteDto.product}`
          );
        }
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
        console.error(`Error getting store_id: ${err.message}`);
        console.error(`Stack: ${err.stack}`);
        this.logger.error(
          `Error getting store_id from product: ${err.message}`
        );
        this.logger.error(err.stack);
      }

      console.error('About to call userActionService.recordAction...');
      console.error(
        `Parameters: userId=${createFavoriteDto.user_id}, action_type=PRODUCT_FAVORITE, ` +
          `product_id=${createFavoriteDto.product}, store_id=${storeId}`
      );
      this.logger.log('Calling userActionService.recordAction...');
      this.logger.log(`   - User ID: ${createFavoriteDto.user_id}`);
      this.logger.log(`   - Product ID: ${createFavoriteDto.product}`);
      this.logger.log(`   - Store ID: ${storeId}`);

      const actionResult = await this.userActionService.recordAction(
        createFavoriteDto.user_id,
        {
          action_type: ActionType.PRODUCT_FAVORITE,
          product_id: createFavoriteDto.product,
          store_id: storeId,
        },
        undefined,
        undefined
      );

      if (actionResult) {
        console.error(
          `Successfully tracked action! Record ID: ${actionResult.id}`
        );
        this.logger.log(
          `Successfully tracked favorite action! Record ID: ${actionResult.id}`
        );
      } else {
        console.error('Action was skipped (user is owner/staff of store)');
        this.logger.log('Action was skipped (user is owner/staff of store)');
      }
    } catch (error: unknown) {
      console.error(
        '\n!!! CRITICAL ERROR - Failed to track favorite action !!!'
      );
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      const err = error instanceof Error ? error : new Error(errorMessage);
      console.error(`Error: ${err.message}`);
      console.error(`Stack: ${err.stack}`);
      this.logger.error('CRITICAL ERROR - Failed to track favorite action:');
      this.logger.error(`Error: ${err.message}`);
      this.logger.error(`Stack: ${err.stack}`);
      // Don't throw - we still want the favorite to be saved even if tracking fails
    }

    console.error('=== FAVORITE CREATE END ===\n');
    return savedFavorite;
  }

  async findAll(): Promise<Favorite[]> {
    this.logger.log('Fetching all favorites');
    return await this.favoriteRepository.find();
  }

  async findOne(id: string): Promise<Favorite> {
    this.logger.log(`Fetching favorite with id: ${id}`);
    const favorite = await this.favoriteRepository.findOne({ where: { id } });
    if (!favorite) throw new NotFoundException('Favorite not found');
    return favorite;
  }

  async update(
    id: string,
    updateFavoriteDto: UpdateFavoriteDto
  ): Promise<Favorite> {
    this.logger.log(`Updating favorite with id: ${id}`);
    const favorite = await this.findOne(id);
    Object.assign(favorite, updateFavoriteDto);
    return await this.favoriteRepository.save(favorite);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing favorite with id: ${id}`);
    const favorite = await this.findOne(id);

    // Track the unfavorite action
    try {
      // Get store_id from product
      let storeId: string | undefined;
      try {
        const branchIds = await this.productService.findProductBranches(
          favorite.product
        );
        if (branchIds && branchIds.length > 0) {
          const branch = await this.branchRepository.findOne({
            where: { id: branchIds[0] },
          });
          if (branch) {
            storeId = branch.store_id;
          }
        }
      } catch (error) {
        this.logger.warn('Could not get store_id from product:', error);
      }

      await this.userActionService.recordAction(
        favorite.user_id,
        {
          action_type: ActionType.PRODUCT_UNFAVORITE,
          product_id: favorite.product,
          store_id: storeId,
        },
        undefined,
        undefined
      );
    } catch (error) {
      this.logger.error('Failed to track unfavorite action:', error);
    }

    await this.favoriteRepository.remove(favorite);
  }

  async removeByUserAndProduct(
    user_id: string,
    product: string
  ): Promise<void> {
    this.logger.log(
      `Removing favorite for user ${user_id} and product ${product}`
    );
    const favorite = await this.favoriteRepository.findOne({
      where: { user_id, product },
    });
    if (!favorite) throw new NotFoundException('Favorite not found');

    // Track the unfavorite action
    try {
      // Get store_id from product
      let storeId: string | undefined;
      try {
        const branchIds =
          await this.productService.findProductBranches(product);
        if (branchIds && branchIds.length > 0) {
          const branch = await this.branchRepository.findOne({
            where: { id: branchIds[0] },
          });
          if (branch) {
            storeId = branch.store_id;
          }
        }
      } catch (error) {
        this.logger.warn('Could not get store_id from product:', error);
      }

      await this.userActionService.recordAction(
        user_id,
        {
          action_type: ActionType.PRODUCT_UNFAVORITE,
          product_id: product,
          store_id: storeId,
        },
        undefined,
        undefined
      );
    } catch (error) {
      this.logger.error('Failed to track unfavorite action:', error);
    }

    await this.favoriteRepository.remove(favorite);
  }

  // Get user's favorites by user_id
  async findByUserId(user_id: string): Promise<Favorite[]> {
    this.logger.log(`Fetching favorites for user_id: ${user_id}`);
    return await this.favoriteRepository.find({
      where: { user_id },
    });
  }

  // Check if a product is favorite for a specific user
  async isFavorite(user_id: string, product: string): Promise<string | null> {
    this.logger.log(
      `Checking if product ${product} is favorite for user ${user_id}`
    );
    const favorite = await this.favoriteRepository.findOne({
      where: { user_id, product },
    });
    return favorite?.id || null;
  }

  // Get products favorited by user with pagination
  async findProductsByUserId(
    user_id: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ products: any[]; total: number; page: number; limit: number }> {
    this.logger.log(
      `Fetching products for user_id: ${user_id}, page: ${page}, limit: ${limit}`
    );
    const skip = (page - 1) * limit;

    // Find all favorites for the user
    const favorites = await this.favoriteRepository.find({
      where: { user_id },
      skip,
      take: limit,
    });

    // Get total count of favorites for pagination
    const total = await this.favoriteRepository.count({
      where: { user_id },
    });

    // Fetch full product details for each favorited product with favorite ID
    const products = await Promise.all(
      favorites.map(async (favorite) => {
        const product = await this.productService.findOne(favorite.product);
        // Add the favorite ID to the product data
        return {
          ...product,
          isFavorite: favorite.id,
        };
      })
    );

    return {
      products,
      total,
      page,
      limit,
    };
  }
}
