import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../model/payment.model';
import { User } from '../model/users.model';
import { Store } from '../model/store.model';
import {
  CreatePaymentDto,
  UpgradeDowngradePaymentDto,
  PaymentResponseDto,
} from '../dto/payment.dto';
import { addMonths } from 'date-fns';

// Pricing configuration from environment variables
const PRODUCT_UNIT = parseInt(process.env.PRODUCT_UNIT || '50', 10);
const BASE_PRICE = parseInt(process.env.BASE_PRICE || '50', 10);
const DEFAULT_MONTH_COUNT = parseInt(
  process.env.DEFAULT_MONTH_COUNT || '3',
  10
);

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>
  ) {}

  /**
   * Calculate total price based on product limit and month count
   * Formula: (product_limit / PRODUCT_UNIT) * BASE_PRICE * month_count
   * Base: PRODUCT_UNIT products = £BASE_PRICE
   */
  private calculateTotalPrice(
    productLimit: number,
    monthCount: number
  ): number {
    const units = productLimit / PRODUCT_UNIT; // Number of product units
    return units * BASE_PRICE * monthCount;
  }

  /**
   * Create a new payment/subscription plan
   */
  async create(
    createPaymentDto: CreatePaymentDto
  ): Promise<PaymentResponseDto> {
    this.logger.log(
      `Creating payment for store: ${createPaymentDto.store_name}`
    );

    // Validate product limit is multiple of PRODUCT_UNIT
    if (createPaymentDto.product_limit % PRODUCT_UNIT !== 0) {
      throw new HttpException(
        `Product limit must be a multiple of ${PRODUCT_UNIT}`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Get user and their credit
    const user = await this.userRepository.findOne({
      where: { id: createPaymentDto.user_id },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Calculate total price
    const totalPrice = this.calculateTotalPrice(
      createPaymentDto.product_limit,
      createPaymentDto.month_count
    );

    // Ensure user.credit is a number (it may come from DB as string)
    const currentCredit = Number(user.credit) || 0;

    // Apply user credit
    const creditApplied = Math.min(currentCredit, totalPrice);
    const finalPrice = totalPrice - creditApplied;
    const isPaid = finalPrice === 0;

    // Calculate expiry date
    const startDate = new Date();
    const expiryDate = addMonths(startDate, createPaymentDto.month_count);

    // Create payment record
    const payment = this.paymentRepository.create({
      ...createPaymentDto,
      total_price: totalPrice,
      is_paid: isPaid,
      start_date: startDate,
      expiry_date: expiryDate,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Update user credit
    if (creditApplied > 0) {
      user.credit = Math.round((currentCredit - creditApplied) * 100) / 100;
      await this.userRepository.save(user);
    }

    this.logger.log(`Payment created successfully with ID: ${savedPayment.id}`);

    return this.formatPaymentResponse(savedPayment);
  }

  /**
   * Create default payment when store is created
   * Default: PRODUCT_UNIT products / DEFAULT_MONTH_COUNT months / is_paid = true
   */
  async createDefaultPayment(
    userId: string,
    storeId: string,
    storeName: string
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Creating default payment for store: ${storeName}`);

    const defaultDto: CreatePaymentDto = {
      user_id: userId,
      store_id: storeId,
      store_name: storeName,
      product_limit: PRODUCT_UNIT,
      month_count: DEFAULT_MONTH_COUNT,
      is_paid: true,
    };

    return this.create(defaultDto);
  }

  /**
   * Get payment by ID
   */
  async findOne(id: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['user', 'store'],
    });

    if (!payment) {
      throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
    }

    return this.formatPaymentResponse(payment);
  }

  /**
   * Get active payment for a store
   * IMPORTANT: Returns the latest paid payment for display as current plan
   * Orders by updated_at DESC to get the most recently modified/created payment
   */
  async findActivePaymentByStore(
    storeIdOrName: string
  ): Promise<PaymentResponseDto | null> {
    // Check if input is a valid UUID
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    let payment;
    console.log(storeIdOrName, '444444444444555555555555');

    if (uuidRegex.test(storeIdOrName)) {
      payment = await this.paymentRepository.findOne({
        where: { store_id: storeIdOrName },
        order: { updated_at: 'DESC' },
        relations: ['user', 'store'],
      });
    } else {
      payment = await this.paymentRepository.findOne({
        where: { store_name: storeIdOrName },
        order: { updated_at: 'DESC' },
        relations: ['user', 'store'],
      });
    }
    if (!payment) {
      return null;
    }
    return this.formatPaymentResponse(payment);
  }

  /**
   * Get all payments for a user
   */
  async findByUser(userId: string): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentRepository.find({
      where: { user_id: userId },
      relations: ['user', 'store'],
      order: { start_date: 'DESC' },
    });

    return payments.map((p) => this.formatPaymentResponse(p));
  }

  /**
   * Check if plan is expired
   */
  isPlanExpired(expiryDate: Date): boolean {
    return new Date() > expiryDate;
  }

  /**
   * Check if plan is expired beyond grace period (1 month)
   */
  isExpiredBeyondGracePeriod(expiryDate: Date): boolean {
    const gracePeriodEnd = addMonths(expiryDate, 1);
    return new Date() > gracePeriodEnd;
  }

  /**
   * Check product quota - can user create more products?
   */
  async canCreateProduct(
    storeId: string,
    currentProductCount: number
  ): Promise<{
    allowed: boolean;
    messageKey?: string;
    params?: Record<string, any>;
  }> {
    const payment = await this.findActivePaymentByStore(storeId);

    if (!payment) {
      this.logger.warn(`No active payment found for store: ${storeId}`);
      return {
        allowed: false,
        messageKey: 'noActiveSubscriptionPlan',
      };
    }

    this.logger.log(
      `Payment found for store ${storeId}: product_limit=${payment.product_limit}, currentCount=${currentProductCount}`
    );

    // Check if plan is expired
    if (this.isPlanExpired(payment.expiry_date)) {
      this.logger.warn(`Plan expired for store ${storeId}`);
      return {
        allowed: false,
        messageKey: 'subscriptionPlanExpired',
      };
    }

    // Check product limit
    if (currentProductCount >= payment.product_limit) {
      this.logger.warn(
        `Product limit reached for store ${storeId}: current=${currentProductCount}, limit=${payment.product_limit}`
      );
      return {
        allowed: false,
        messageKey: 'productLimitReached',
        params: { limit: payment.product_limit },
      };
    }

    this.logger.log(`Product creation allowed for store ${storeId}`);
    return { allowed: true };
  }

  /**
   * Calculate remaining value of current plan (pro-rated)
   * Returns the value of unused time on the current plan
   */
  private calculateRemainingValue(
    productLimit: number,
    monthCount: number,
    startDate: Date,
    expiryDate: Date
  ): number {
    const now = new Date();

    // If already expired, no remaining value
    if (now >= expiryDate) {
      return 0;
    }

    const totalDuration = expiryDate.getTime() - startDate.getTime();
    const usedDuration = now.getTime() - startDate.getTime();

    // Calculate remaining ratio, but handle edge cases:
    // - If used less than 1 day, consider it as 100% remaining (no proration for same-day changes)
    const oneDayMs = 24 * 60 * 60 * 1000;
    let remainingRatio: number;

    if (usedDuration < oneDayMs) {
      // Less than 1 day used - give full value back
      remainingRatio = 1;
    } else {
      remainingRatio = Math.max(
        0,
        (totalDuration - usedDuration) / totalDuration
      );
    }

    const fullPrice = this.calculateTotalPrice(productLimit, monthCount);

    // Round to nearest whole number to avoid floating point issues
    return Math.round(fullPrice * remainingRatio);
  }

  /**
   * Upgrade or Downgrade payment by Store Name
   */
  async upgradeOrDowngradeByStoreName(
    storeName: string,
    upgradeDowngradeDto: UpgradeDowngradePaymentDto,
    currentProductCount: number
  ): Promise<PaymentResponseDto> {
    // Find payment by store_name
    const payment = await this.paymentRepository.findOne({
      where: { store_name: storeName },
      order: { start_date: 'DESC' },
      relations: ['user'],
    });

    if (!payment) {
      throw new HttpException(
        'Payment not found for this store',
        HttpStatus.NOT_FOUND
      );
    }

    // Get current user for credit updates
    const user = await this.userRepository.findOne({
      where: { id: payment.user_id },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Validate new product limit is multiple of PRODUCT_UNIT
    if (upgradeDowngradeDto.new_product_limit % PRODUCT_UNIT !== 0) {
      throw new HttpException(
        `Product limit must be a multiple of ${PRODUCT_UNIT}`,
        HttpStatus.BAD_REQUEST
      );
    }

    // If downgrading, check that user won't exceed new limit
    if (upgradeDowngradeDto.new_product_limit < payment.product_limit) {
      if (currentProductCount > upgradeDowngradeDto.new_product_limit) {
        throw new HttpException(
          `Cannot downgrade to ${upgradeDowngradeDto.new_product_limit} products. You currently have ${currentProductCount} products.`,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Calculate remaining value of current plan (credit for unused time)
    const remainingCredit = this.calculateRemainingValue(
      payment.product_limit,
      payment.month_count,
      payment.start_date,
      payment.expiry_date
    );

    // Calculate new plan price
    const newMonthCount =
      upgradeDowngradeDto.new_month_count || payment.month_count;
    const newPlanPrice = this.calculateTotalPrice(
      upgradeDowngradeDto.new_product_limit,
      newMonthCount
    );

    // Net cost = new plan price - remaining credit from old plan
    const netCost = newPlanPrice - remainingCredit;

    // Ensure user.credit is a number (it may come from DB as string)
    let currentCredit = Number(user.credit) || 0;

    this.logger.log(
      `Plan change: remainingCredit=${remainingCredit}, newPlanPrice=${newPlanPrice}, netCost=${netCost}, userCredit=${currentCredit}`
    );

    // Update payment record
    payment.product_limit = upgradeDowngradeDto.new_product_limit;
    payment.month_count = newMonthCount;
    payment.total_price = newPlanPrice;
    payment.start_date = new Date();
    payment.expiry_date = addMonths(new Date(), newMonthCount);

    if (netCost > 0) {
      // User needs to pay more - use their credit balance first
      const creditToUse = Math.min(currentCredit, netCost);
      currentCredit = currentCredit - creditToUse;
      const remainingToPay = netCost - creditToUse;
      payment.is_paid = remainingToPay === 0;

      this.logger.log(
        `Upgrade: used ${creditToUse} credit, remaining to pay: ${remainingToPay}`
      );
    } else if (netCost < 0) {
      // User gets a refund (added to credit)
      currentCredit = currentCredit + Math.abs(netCost);
      payment.is_paid = true;

      this.logger.log(`Downgrade: added ${Math.abs(netCost)} to user credit`);
    } else {
      // No change in cost
      payment.is_paid = true;
    }

    // Round to 2 decimal places to avoid floating point issues
    user.credit = Math.round(currentCredit * 100) / 100;

    await this.userRepository.save(user);
    const updatedPayment = await this.paymentRepository.save(payment);

    this.logger.log(
      `Payment for store ${storeName} upgraded/downgraded. Net cost: ${netCost}, New user credit: ${user.credit}`
    );

    return this.formatPaymentResponse(updatedPayment);
  }

  /**
   * Upgrade or Downgrade payment by Store ID (deprecated - use upgradeOrDowngradeByStoreName)
   */
  async upgradeOrDowngradeByStore(
    storeId: string,
    upgradeDowngradeDto: UpgradeDowngradePaymentDto,
    currentProductCount: number
  ): Promise<PaymentResponseDto> {
    // Find payment by store_id
    const payment = await this.paymentRepository.findOne({
      where: { store_id: storeId },
      order: { start_date: 'DESC' },
      relations: ['user'],
    });

    if (!payment) {
      throw new HttpException(
        'Payment not found for this store',
        HttpStatus.NOT_FOUND
      );
    }

    // Get current user for credit updates
    const user = await this.userRepository.findOne({
      where: { id: payment.user_id },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Validate new product limit is multiple of PRODUCT_UNIT
    if (upgradeDowngradeDto.new_product_limit % PRODUCT_UNIT !== 0) {
      throw new HttpException(
        `Product limit must be a multiple of ${PRODUCT_UNIT}`,
        HttpStatus.BAD_REQUEST
      );
    }

    // If downgrading, check that user won't exceed new limit
    if (upgradeDowngradeDto.new_product_limit < payment.product_limit) {
      if (currentProductCount > upgradeDowngradeDto.new_product_limit) {
        throw new HttpException(
          `Cannot downgrade to ${upgradeDowngradeDto.new_product_limit} products. You currently have ${currentProductCount} products.`,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Calculate remaining value of current plan (credit for unused time)
    const remainingCredit = this.calculateRemainingValue(
      payment.product_limit,
      payment.month_count,
      payment.start_date,
      payment.expiry_date
    );

    // Calculate new plan price
    const newMonthCount =
      upgradeDowngradeDto.new_month_count || payment.month_count;
    const newPlanPrice = this.calculateTotalPrice(
      upgradeDowngradeDto.new_product_limit,
      newMonthCount
    );

    // Net cost = new plan price - remaining credit from old plan
    const netCost = newPlanPrice - remainingCredit;

    // Ensure user.credit is a number (it may come from DB as string)
    let currentCredit = Number(user.credit) || 0;

    this.logger.log(
      `Plan change: remainingCredit=${remainingCredit}, newPlanPrice=${newPlanPrice}, netCost=${netCost}, userCredit=${currentCredit}`
    );

    // Update payment record
    payment.product_limit = upgradeDowngradeDto.new_product_limit;
    payment.month_count = newMonthCount;
    payment.total_price = newPlanPrice;
    payment.start_date = new Date();
    payment.expiry_date = addMonths(new Date(), newMonthCount);

    if (netCost > 0) {
      // User needs to pay more - use their credit balance first
      const creditToUse = Math.min(currentCredit, netCost);
      currentCredit = currentCredit - creditToUse;
      const remainingToPay = netCost - creditToUse;
      payment.is_paid = remainingToPay === 0;

      this.logger.log(
        `Upgrade: used ${creditToUse} credit, remaining to pay: ${remainingToPay}`
      );
    } else if (netCost < 0) {
      // User gets a refund (added to credit)
      currentCredit = currentCredit + Math.abs(netCost);
      payment.is_paid = true;

      this.logger.log(`Downgrade: added ${Math.abs(netCost)} to user credit`);
    } else {
      // No change in cost
      payment.is_paid = true;
    }

    // Round to 2 decimal places to avoid floating point issues
    user.credit = Math.round(currentCredit * 100) / 100;

    await this.userRepository.save(user);
    const updatedPayment = await this.paymentRepository.save(payment);

    this.logger.log(
      `Payment for store ${storeId} upgraded/downgraded. Net cost: ${netCost}, New user credit: ${user.credit}`
    );

    return this.formatPaymentResponse(updatedPayment);
  }

  /**
   * Upgrade or Downgrade payment (deprecated - use upgradeOrDowngradeByStore)
   */
  async upgradeOrDowngrade(
    paymentId: string,
    upgradeDowngradeDto: UpgradeDowngradePaymentDto,
    currentProductCount: number
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['user'],
    });

    if (!payment) {
      throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
    }

    // Get current user for credit updates
    const user = await this.userRepository.findOne({
      where: { id: payment.user_id },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Validate new product limit is multiple of PRODUCT_UNIT
    if (upgradeDowngradeDto.new_product_limit % PRODUCT_UNIT !== 0) {
      throw new HttpException(
        `Product limit must be a multiple of ${PRODUCT_UNIT}`,
        HttpStatus.BAD_REQUEST
      );
    }

    // If downgrading, check that user won't exceed new limit
    if (upgradeDowngradeDto.new_product_limit < payment.product_limit) {
      if (currentProductCount > upgradeDowngradeDto.new_product_limit) {
        throw new HttpException(
          `Cannot downgrade to ${upgradeDowngradeDto.new_product_limit} products. You currently have ${currentProductCount} products.`,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Calculate old and new prices
    const oldPrice = this.calculateTotalPrice(
      payment.product_limit,
      payment.month_count
    );

    const newMonthCount =
      upgradeDowngradeDto.new_month_count || payment.month_count;
    const newPrice = this.calculateTotalPrice(
      upgradeDowngradeDto.new_product_limit,
      newMonthCount
    );

    const priceDifference = newPrice - oldPrice;

    // Ensure user.credit is a number (it may come from DB as string)
    let currentCredit = Number(user.credit) || 0;

    // Update payment
    payment.product_limit = upgradeDowngradeDto.new_product_limit;
    payment.month_count = newMonthCount;
    payment.total_price = newPrice;
    payment.expiry_date = addMonths(new Date(), newMonthCount);

    // If upgrading, deduct from credit or mark as unpaid
    if (priceDifference > 0) {
      const creditToUse = Math.min(currentCredit, priceDifference);
      currentCredit = currentCredit - creditToUse;
      const remainingDiff = priceDifference - creditToUse;
      payment.is_paid = remainingDiff === 0;
    }
    // If downgrading, add the difference to user credit
    else if (priceDifference < 0) {
      currentCredit = currentCredit + Math.abs(priceDifference);
      payment.is_paid = true; // Downgrade is instantly paid (refund to credit)
    }

    // Round to 2 decimal places to avoid floating point issues
    user.credit = Math.round(currentCredit * 100) / 100;

    await this.userRepository.save(user);
    const updatedPayment = await this.paymentRepository.save(payment);

    this.logger.log(
      `Payment ${paymentId} upgraded/downgraded. Price difference: ${priceDifference}`
    );

    return this.formatPaymentResponse(updatedPayment);
  }

  /**
   * Mark payment as paid
   */
  async markAsPaid(paymentId: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
    }

    payment.is_paid = true;
    payment.payment_date = new Date();
    const updatedPayment = await this.paymentRepository.save(payment);

    this.logger.log(`Payment ${paymentId} marked as paid`);

    return this.formatPaymentResponse(updatedPayment);
  }

  /**
   * Delete payment record
   */
  async remove(id: string): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
    });

    if (!payment) {
      throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
    }

    await this.paymentRepository.remove(payment);
    this.logger.log(`Payment ${id} deleted`);
  }

  /**
   * Format payment response - dates are already at midnight UTC
   */
  private formatPaymentResponse(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      user_id: payment.user_id,
      store_id: payment.store_id,
      store_name: payment.store_name,
      product_limit: payment.product_limit,
      month_count: payment.month_count,
      total_price: Number(payment.total_price),
      is_paid: payment.is_paid,
      payment_date: payment.payment_date,
      start_date: payment.start_date,
      expiry_date: payment.expiry_date,
      notes: payment.notes,
      updated_at: payment.updated_at,
    };
  }
}
