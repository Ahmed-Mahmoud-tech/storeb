import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentService } from '../services/payment.service';
import {
  CreatePaymentDto,
  UpgradeDowngradePaymentDto,
  PaymentResponseDto,
} from '../dto/payment.dto';
import { ProductService } from '../services/product.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly productService: ProductService
  ) {}

  /**
   * Create a new subscription plan
   * POST /payments
   */
  @Post()
  async create(
    @Body() createPaymentDto: CreatePaymentDto
  ): Promise<PaymentResponseDto> {
    this.logger.log('Creating new payment');
    return this.paymentService.create(createPaymentDto);
  }

  /**
   * Upgrade or Downgrade subscription plan
   * PATCH /payments/store/:storeName/upgrade-downgrade
   */
  @Patch('store/:storeName/upgrade-downgrade')
  async upgradeOrDowngrade(
    @Param('storeName') storeName: string,
    @Body() upgradeDowngradeDto: UpgradeDowngradePaymentDto
  ): Promise<PaymentResponseDto> {
    if (!storeName) {
      throw new HttpException('Store name is required', HttpStatus.BAD_REQUEST);
    }

    // Decode store name (replace underscores with spaces)
    const decodedStoreName = storeName.replace(/_/g, ' ');

    try {
      const currentProductCount =
        await this.productService.getProductCountByStoreName(decodedStoreName);
      return this.paymentService.upgradeOrDowngradeByStoreName(
        decodedStoreName,
        upgradeDowngradeDto,
        currentProductCount
      );
    } catch (error) {
      this.logger.error(`Error during upgrade/downgrade: ${error}`);
      throw error;
    }
  }

  /**
   * Get active payment for a store
   * GET /payments/store/:storeId
   */
  @Get('store/:storeId')
  async getActivePaymentByStore(
    @Param('storeId') storeId: string
  ): Promise<PaymentResponseDto | { message: string }> {
    const payment = await this.paymentService.findActivePaymentByStore(storeId);

    if (!payment) {
      return { message: 'No active payment found for this store' };
    }

    return payment;
  }

  /**
   * Get payment by ID
   * GET /payments/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PaymentResponseDto> {
    return this.paymentService.findOne(id);
  }

  /**
   * Get all payments for the authenticated user
   * GET /payments/user/me
   */
  @Get('user/me')
  async getMyPayments(
    @Query('userId') userId: string
  ): Promise<PaymentResponseDto[]> {
    if (!userId) {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }
    return this.paymentService.findByUser(userId);
  }

  /**
   * Check if user can create a product
   * GET /payments/check-quota/:storeId
   */
  @Get('check-quota/:storeId')
  async checkProductQuota(@Param('storeId') storeId: string): Promise<{
    allowed: boolean;
    message?: string;
    productLimit?: number;
    currentCount?: number;
  }> {
    try {
      const currentProductCount =
        await this.productService.getProductCountByStore(storeId);
      const result = await this.paymentService.canCreateProduct(
        storeId,
        currentProductCount
      );

      const payment =
        await this.paymentService.findActivePaymentByStore(storeId);

      return {
        ...result,
        productLimit: payment?.product_limit,
        currentCount: currentProductCount,
      };
    } catch (error) {
      this.logger.error(`Error checking quota: ${error}`);
      throw error;
    }
  }

  /**
   * Mark payment as paid
   * PATCH /payments/:id/mark-as-paid
   */
  @Patch(':id/mark-as-paid')
  async markAsPaid(@Param('id') id: string): Promise<PaymentResponseDto> {
    this.logger.log(`Marking payment ${id} as paid`);
    return this.paymentService.markAsPaid(id);
  }

  /**
   * Delete a payment record
   * DELETE /payments/:id
   */
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.paymentService.remove(id);
    return { message: 'Payment deleted successfully' };
  }

  /**
   * Check plan expiry status
   * GET /payments/:id/expiry-status
   */
  @Get(':id/expiry-status')
  async checkExpiryStatus(@Param('id') paymentId: string): Promise<{
    isExpired: boolean;
    isExpiredBeyondGracePeriod: boolean;
    daysUntilExpiry: number;
    expiryDate: Date;
  }> {
    const payment = await this.paymentService.findOne(paymentId);

    const isExpired = this.paymentService.isPlanExpired(payment.expiry_date);
    const isExpiredBeyondGracePeriod =
      this.paymentService.isExpiredBeyondGracePeriod(payment.expiry_date);

    const now = new Date();
    const expiryTime = payment.expiry_date.getTime() - now.getTime();
    const daysUntilExpiry = Math.ceil(expiryTime / (1000 * 60 * 60 * 24));

    return {
      isExpired,
      isExpiredBeyondGracePeriod,
      daysUntilExpiry,
      expiryDate: payment.expiry_date,
    };
  }
}
