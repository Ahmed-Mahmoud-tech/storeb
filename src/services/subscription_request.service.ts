import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  SubscriptionRequest,
  SubscriptionRequestStatus,
  SubscriptionRequestType,
} from '../model/subscription_request.model';
import { Payment } from '../model/payment.model';
import { User } from '../model/users.model';
import { Store } from '../model/store.model';
import {
  CreateSubscriptionRequestDto,
  ProcessSubscriptionRequestDto,
} from '../dto/subscription_request.dto';

@Injectable()
export class SubscriptionRequestService {
  private readonly PRODUCT_UNIT = 50;
  private readonly DAILY_RATE_PER_PRODUCT = 49 / 30; // £1.633 per 50 products per day (30 days = £49)

  constructor(
    @InjectRepository(SubscriptionRequest)
    private subscriptionRequestRepository: Repository<SubscriptionRequest>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    private dataSource: DataSource
  ) {}

  /**
   * Calculate days from today to expiry date
   */
  private getDaysUntilExpiry(expiryDate: Date): number {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    return days;
  }

  /**
   * Get daily price based on product limit
   * Formula: (productLimit / 50) * (49/30)
   */
  private getDailyPrice(productLimit: number): number {
    return (productLimit / 50) * this.DAILY_RATE_PER_PRODUCT;
  }

  /**
   * Calculate total price based on days until expiry
   */
  private calculateDayBasedPrice(
    productLimit: number,
    expiryDate: Date
  ): {
    days: number;
    dailyPrice: number;
    totalPrice: number;
  } {
    const days = this.getDaysUntilExpiry(expiryDate);
    const dailyPrice = this.getDailyPrice(productLimit);
    const totalPrice = Math.round(dailyPrice * days * 100) / 100; // Round to 2 decimal places

    return { days, dailyPrice, totalPrice };
  }

  /**
   * Calculate unused value from current subscription (prorated refund)
   */
  private calculateUnusedValue(
    currentPayment: Payment,
    currentDate: Date = new Date()
  ): number {
    const originalExpiryDate = new Date(currentPayment.expiry_date);

    if (originalExpiryDate <= currentDate) {
      return 0; // Plan already expired
    }

    // Calculate remaining days in current plan
    const remainingDays = this.getDaysUntilExpiry(originalExpiryDate);

    // Calculate daily rate for current plan
    const dailyRate = this.getDailyPrice(currentPayment.product_limit);

    return Math.round(dailyRate * remainingDays * 100) / 100;
  }

  async createRequest(userId: string, dto: CreateSubscriptionRequestDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      console.log('🔵 [1] CREATE REQUEST - Input:', {
        userId,
        storeId: dto.store_id,
        productLimit: dto.new_product_limit,
        expiryDate: dto.expiry_date,
      });

      // Parse and validate expiry date
      const expiryDate = new Date(dto.expiry_date);
      if (isNaN(expiryDate.getTime())) {
        throw new BadRequestException(
          `Invalid expiry date format: ${dto.expiry_date}`
        );
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expiryDate.setHours(0, 0, 0, 0);

      console.log('🔵 [2] DATE CHECK - Today:', today, 'Expiry:', expiryDate);

      if (expiryDate <= today) {
        throw new BadRequestException(
          `Expiry date must be in the future. Today: ${today.toISOString()}, Provided: ${expiryDate.toISOString()}`
        );
      }

      // Get current payment for the store
      console.log('🔵 [3] FETCHING CURRENT PAYMENT for store:', dto.store_id);
      const currentPayment = await queryRunner.manager
        .createQueryBuilder(Payment, 'payment')
        .where('payment.store_id = :store_id', { store_id: dto.store_id })
        .andWhere('payment.is_paid = :is_paid', { is_paid: true })
        .orderBy('payment.start_date', 'DESC')
        .take(1)
        .getOne();

      console.log(
        '🔵 [4] CURRENT PAYMENT:',
        currentPayment
          ? {
              id: currentPayment.id,
              product_limit: currentPayment.product_limit,
              total_price: currentPayment.total_price,
              expiry_date: currentPayment.expiry_date,
            }
          : 'NONE'
      );

      // Calculate requested price based on days until expiry
      console.log(
        '🔵 [5] CALCULATING PRICE for:',
        dto.new_product_limit,
        'products until',
        expiryDate
      );
      let requestedPriceCalc;
      try {
        requestedPriceCalc = this.calculateDayBasedPrice(
          dto.new_product_limit,
          expiryDate
        );
        console.log('🔵 [6] PRICE CALCULATION RESULT:', requestedPriceCalc);
      } catch (priceCalcError) {
        console.error('🔴 [6] PRICE CALCULATION FAILED:', priceCalcError);
        throw new BadRequestException(
          `Price calculation failed: ${priceCalcError instanceof Error ? priceCalcError.message : String(priceCalcError)}`
        );
      }

      // Get current plan details
      let currentTotalPrice = 0;
      let currentProductLimit = 50;
      let unusedValue = 0;

      if (currentPayment) {
        currentProductLimit = Number(currentPayment.product_limit) || 50;
        currentTotalPrice = Number(currentPayment.total_price) || 0;

        console.log('🔵 [7] CALCULATING UNUSED VALUE for expired plan');
        try {
          // Calculate unused value (prorated)
          if (currentPayment.expiry_date) {
            unusedValue = this.calculateUnusedValue(currentPayment);
            console.log('🔵 [8] UNUSED VALUE:', unusedValue);
          }
        } catch (unusedError) {
          console.error('🔴 [8] UNUSED VALUE CALCULATION FAILED:', unusedError);
          unusedValue = 0; // Default to 0 if calculation fails
        }
      }

      console.log('🔵 [9] CURRENT PLAN DETAILS:', {
        productLimit: currentProductLimit,
        totalPrice: currentTotalPrice,
        unusedValue,
      });

      // Determine request type
      let requestType = SubscriptionRequestType.NEW;
      if (currentPayment) {
        if (
          dto.new_product_limit > currentProductLimit ||
          requestedPriceCalc.totalPrice > currentTotalPrice
        ) {
          requestType = SubscriptionRequestType.UPGRADE;
        } else if (
          dto.new_product_limit < currentProductLimit ||
          requestedPriceCalc.totalPrice < currentTotalPrice
        ) {
          requestType = SubscriptionRequestType.DOWNGRADE;
        } else {
          requestType = SubscriptionRequestType.RENEWAL;
        }
      }

      console.log('🔵 [10] REQUEST TYPE:', requestType);

      // Calculate price difference and net cost
      const priceDifference = requestedPriceCalc.totalPrice - currentTotalPrice;
      const netCost = Math.max(0, priceDifference - unusedValue);

      console.log('🔵 [11] FINANCIALS:', {
        priceDifference,
        netCost,
      });

      // Check if there's already a pending request for this store
      console.log('🔵 [12] CHECKING FOR EXISTING PENDING REQUEST');
      const existingRequest = await queryRunner.manager.findOne(
        SubscriptionRequest,
        {
          where: {
            store_id: dto.store_id,
            status: SubscriptionRequestStatus.PENDING,
          },
        }
      );

      if (existingRequest) {
        throw new BadRequestException(
          'A pending subscription request already exists for this store'
        );
      }

      console.log('🔵 [13] NO EXISTING PENDING REQUEST - PROCEEDING');

      // Create the subscription request
      const startDate = new Date();

      // Calculate days for requested_month_count (legacy field, store as number of days)
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const request = queryRunner.manager.create(SubscriptionRequest, {
        user_id: userId,
        store_id: dto.store_id,
        store_name: dto.store_name,
        current_product_limit: currentPayment?.product_limit || null,
        current_start_date: currentPayment?.start_date || null,
        current_end_date: currentPayment?.expiry_date || null,
        current_total_price: currentPayment?.total_price || null,
        requested_product_limit: dto.new_product_limit,
        requested_start_date: startDate,
        requested_end_date: expiryDate,
        requested_total_price: requestedPriceCalc.totalPrice,
        price_difference: priceDifference,
        remaining_credit_value: unusedValue,
        net_cost: netCost,
        request_type: requestType,
        user_notes: dto.user_notes || null,
        status: SubscriptionRequestStatus.PENDING,
        requested_month_count: daysUntilExpiry, // Store days as legacy month_count field
      });

      console.log('🔵 [14] REQUEST OBJECT CREATED:', {
        id: 'will-be-generated',
        store_id: request.store_id,
        requested_product_limit: request.requested_product_limit,
        requested_total_price: request.requested_total_price,
        status: request.status,
      });

      console.log('🔵 [15] SAVING TO DATABASE');
      const savedRequest = await queryRunner.manager.save(
        SubscriptionRequest,
        request
      );

      console.log('🔵 [16] SAVED REQUEST ID:', savedRequest.id);

      await queryRunner.commitTransaction();
      console.log('🔵 [17] TRANSACTION COMMITTED');

      const response = this.formatResponse(savedRequest);
      console.log('🔵 [18] FORMATTED RESPONSE SENT');
      return response;
    } catch (error) {
      console.error(
        '🔴 ERROR IN CREATE REQUEST:',
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
            }
          : String(error)
      );
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
      console.log('🔵 [19] QUERY RUNNER RELEASED');
    }
  }

  async processRequest(
    requestId: string,
    adminUserId: string,
    dto: ProcessSubscriptionRequestDto
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(SubscriptionRequest, {
        where: { id: requestId },
        relations: ['user'],
      });

      if (!request) {
        throw new NotFoundException('Subscription request not found');
      }

      if (request.status !== SubscriptionRequestStatus.PENDING) {
        throw new BadRequestException('Request has already been processed');
      }

      // Update request status
      request.status = dto.status;
      request.admin_notes = dto.admin_notes;
      request.processed_by = adminUserId;
      request.processed_at = new Date();

      if (dto.status === SubscriptionRequestStatus.APPROVED) {
        // Get user
        const user = await queryRunner.manager.findOne(User, {
          where: { id: request.user_id },
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        const userCredit = Number(user.credit) || 0;
        const unusedValue = Number(request.remaining_credit_value) || 0;
        const requestedPrice = Number(request.requested_total_price);

        // Calculate actual payment required
        let creditApplied = 0;
        let paymentRequired = 0;

        // First apply unused value from current plan
        const totalAvailableCredit = userCredit + unusedValue;
        creditApplied = Math.min(totalAvailableCredit, requestedPrice);
        paymentRequired = Math.max(0, requestedPrice - totalAvailableCredit);

        // Update user credit
        user.credit = Math.max(0, totalAvailableCredit - requestedPrice);

        await queryRunner.manager.save(User, user);

        // Create new payment record with date-based expiry
        const startDate = new Date(request.requested_start_date);
        const endDate = new Date(request.requested_end_date);

        const newPayment = queryRunner.manager.create(Payment, {
          user_id: request.user_id,
          store_id: request.store_id,
          store_name: request.store_name,
          product_limit: request.requested_product_limit,
          month_count: Math.max(
            1,
            Math.ceil(this.getDaysUntilExpiry(endDate) / 30)
          ), // Convert days to approximate months for compatibility
          total_price: request.requested_total_price,
          is_paid: true,
          payment_date: new Date(),
          start_date: startDate,
          expiry_date: endDate,
          notes: `Created from subscription request ${request.id}. Credit Applied: £${creditApplied.toFixed(2)}, Payment Required: £${paymentRequired.toFixed(2)}`,
        });

        await queryRunner.manager.save(Payment, newPayment);

        // If there was a previous payment, mark it as unpaid (expired)
        const currentPayment = await queryRunner.manager.find(Payment, {
          where: { store_id: request.store_id, is_paid: true },
          order: { start_date: 'DESC' },
          take: 2,
        });

        if (currentPayment.length > 1) {
          const previousPayment = currentPayment[1];
          previousPayment.is_paid = false;
          await queryRunner.manager.save(Payment, previousPayment);
        }
      }

      const updatedRequest = await queryRunner.manager.save(
        SubscriptionRequest,
        request
      );
      await queryRunner.commitTransaction();

      return this.formatResponse(updatedRequest);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    status?: SubscriptionRequestStatus,
    storeId?: string,
    userId?: string,
    page: number = 1,
    limit: number = 20
  ) {
    const queryBuilder = this.subscriptionRequestRepository
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.user', 'user')
      .leftJoinAndSelect('sr.store', 'store')
      .leftJoinAndSelect('sr.processor', 'processor')
      .orderBy('sr.created_at', 'DESC');

    if (status) {
      queryBuilder.andWhere('sr.status = :status', { status });
    }

    if (storeId) {
      queryBuilder.andWhere('sr.store_id = :storeId', { storeId });
    }

    if (userId) {
      queryBuilder.andWhere('sr.user_id = :userId', { userId });
    }

    const [requests, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: requests.map((request) => this.formatResponse(request)),
      total,
      page,
      limit,
    };
  }

  async findByUser(userId: string) {
    const requests = await this.subscriptionRequestRepository.find({
      where: { user_id: userId },
      relations: ['store', 'processor'],
      order: { created_at: 'DESC' },
    });

    return requests.map((request) => this.formatResponse(request));
  }

  async findPendingByStore(storeId: string) {
    try {
      const request = await this.subscriptionRequestRepository.findOne({
        where: {
          store_id: storeId,
          status: SubscriptionRequestStatus.PENDING,
        },
        relations: ['user'],
      });

      return request ? this.formatResponse(request) : null;
    } catch (error) {
      console.error('Error in findPendingByStore:', error);
      throw error;
    }
  }

  async findOne(id: string) {
    const request = await this.subscriptionRequestRepository.findOne({
      where: { id },
      relations: ['user', 'store', 'processor'],
    });

    if (!request) {
      throw new NotFoundException('Subscription request not found');
    }

    return this.formatResponse(request);
  }

  async cancelRequest(requestId: string, userId: string) {
    const request = await this.subscriptionRequestRepository.findOne({
      where: { id: requestId, user_id: userId },
    });

    if (!request) {
      throw new NotFoundException('Subscription request not found');
    }

    if (request.status !== SubscriptionRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    await this.subscriptionRequestRepository.remove(request);
    return { message: 'Request cancelled successfully' };
  }

  private formatResponse(request: SubscriptionRequest) {
    try {
      return {
        id: request.id,
        user_id: request.user_id,
        store_id: request.store_id,
        store_name: request.store_name,
        current_product_limit: request.current_product_limit,
        current_start_date: request.current_start_date,
        current_end_date: request.current_end_date,
        current_total_price: request.current_total_price,
        requested_product_limit: request.requested_product_limit,
        requested_start_date: request.requested_start_date,
        requested_end_date: request.requested_end_date,
        requested_total_price: request.requested_total_price,
        price_difference: request.price_difference,
        remaining_credit_value: request.remaining_credit_value,
        net_cost: request.net_cost,
        request_type: request.request_type,
        status: request.status,
        user_notes: request.user_notes,
        admin_notes: request.admin_notes,
        processed_by: request.processed_by,
        processed_at: request.processed_at,
        created_at: request.created_at,
        updated_at: request.updated_at,
        user: request.user
          ? {
              id: request.user.id,
              email: request.user.email,
              name: request.user.name,
            }
          : undefined,
        store: {
          id: request.store_id,
          name: request.store_name,
        },
        processor: request.processor
          ? {
              id: request.processor.id,
              email: request.processor.email,
            }
          : undefined,
      };
    } catch (error) {
      console.error('Error in formatResponse:', error, 'Request:', request);
      throw error;
    }
  }
}
