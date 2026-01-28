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

/**
 * Guard to check if user has reached product quota
 * Usage: @UseGuards(ProductQuotaGuard)
 */
@Injectable()
export class ProductQuotaGuard implements CanActivate {
  private readonly logger = new Logger(ProductQuotaGuard.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly productService: ProductService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as Record<string, unknown> | undefined;
    const query = request.query as Record<string, unknown> | undefined;
    const storeId = body?.storeId || query?.storeId;

    if (!storeId) {
      throw new HttpException('Store ID is required', HttpStatus.BAD_REQUEST);
    }

    try {
      // Get current product count for the store
      const currentProductCount =
        await this.productService.getProductCountByStore(storeId as string);

      // Check if user can create product
      const canCreate = await this.paymentService.canCreateProduct(
        storeId as string,
        currentProductCount
      );

      if (!canCreate.allowed) {
        throw new HttpException(
          canCreate.message || 'Cannot create product',
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
