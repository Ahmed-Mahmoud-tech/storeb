import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentService } from '../services/payment.service';
import { ProductService } from '../services/product.service';
import { StoreService } from '../services/store.service';

/**
 * Guard to check if user has reached product quota
 * Usage: @UseGuards(ProductQuotaGuard)
 */
@Injectable()
export class ProductQuotaGuard implements CanActivate {
  private readonly logger = new Logger(ProductQuotaGuard.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly productService: ProductService,
    private readonly storeService: StoreService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as Record<string, unknown> | undefined;
    const query = request.query as Record<string, unknown> | undefined;
    let storeId = (body?.storeId || query?.storeId) as string | undefined;

    this.logger.log(`=== ProductQuotaGuard Starting ===`);
    this.logger.log(`Request body: ${JSON.stringify(body)}`);
    this.logger.log(`Request query: ${JSON.stringify(query)}`);
    this.logger.log(`Request user: ${JSON.stringify(request.user)}`);
    this.logger.log(`Initial storeId from body/query: ${storeId}`);

    // If storeId not in body/query, try to get from user's authenticated session
    if (!storeId && request.user) {
      const user = request.user as any;

      this.logger.log(`User object keys: ${Object.keys(user).join(', ')}`);
      this.logger.log(
        `User.id: ${user.id}, User.store_id: ${user.store_id}, User.storeId: ${user.storeId}`
      );

      // First check if storeId is directly on user object
      if (user.store_id || user.storeId) {
        storeId = user.store_id || user.storeId;
        this.logger.log(`Found storeId on user object: ${storeId}`);
      } else if (user.id) {
        // If not, get user's store by owner_id
        try {
          this.logger.log(`Attempting to fetch store for owner_id: ${user.id}`);
          const userStore = await this.storeService.findStoreByOwnerId(user.id);

          if (userStore) {
            storeId = userStore.id;
            this.logger.log(`✓ Found store ${storeId} for user ${user.id}`);
          } else {
            this.logger.warn(`No store returned for owner_id ${user.id}`);
          }
        } catch (error) {
          this.logger.error(
            `✗ Error fetching store for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else {
        this.logger.warn(
          `User object has no id field. User keys: ${Object.keys(user).join(', ')}`
        );
      }
    } else {
      this.logger.log(`Using storeId from request: ${storeId}`);
    }

    if (!storeId) {
      this.logger.error(
        '❌ Store ID could not be determined from request or user session'
      );
      throw new HttpException('Store ID is required', HttpStatus.BAD_REQUEST);
    }

    try {
      this.logger.log(`✓ Proceeding with quota check for store: ${storeId}`);

      // Get current product count for the store
      const currentProductCount =
        await this.productService.getProductCountByStore(storeId);

      this.logger.log(
        `Current product count for store ${storeId}: ${currentProductCount}`
      );

      // Check if user can create product
      const canCreate = await this.paymentService.canCreateProduct(
        storeId,
        currentProductCount
      );

      this.logger.log(
        `Can create product: ${canCreate.allowed}, MessageKey: ${canCreate.messageKey}`
      );

      if (!canCreate.allowed) {
        throw new HttpException(
          {
            statusCode: HttpStatus.FORBIDDEN,
            message: 'Cannot create product',
            messageKey: canCreate.messageKey || 'cannotCreateProduct',
            params: canCreate.params,
          },
          HttpStatus.FORBIDDEN
        );
      }

      return true;
    } catch (error) {
      this.logger.error(`Error in ProductQuotaGuard: ${error}`);
      throw error;
    }
  }
}
