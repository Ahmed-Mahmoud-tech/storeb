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
   * Both dates are normalized to midnight for accurate day counting
   */
  private getDaysUntilExpiry(expiryDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

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
   * Formula: daily_rate * remaining_days
   * This is the refund value for days not yet used in the current plan
   */
  private calculateUnusedValue(
    currentPayment: Payment,
    currentDate: Date = new Date()
  ): number {
    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);

    const originalExpiryDate = new Date(currentPayment.expiry_date);
    originalExpiryDate.setHours(0, 0, 0, 0);

    if (originalExpiryDate <= today) {
      console.log('🔵 UNUSED VALUE CALC: Plan already expired, returning 0');
      return 0; // Plan already expired
    }

    // Calculate remaining days in current plan
    const remainingDays = this.getDaysUntilExpiry(originalExpiryDate);

    // Calculate daily rate for current plan based on product limit
    const dailyRate = this.getDailyPrice(currentPayment.product_limit);

    // Calculate unused value: daily_rate * remaining_days
    const unusedValue = Math.round(dailyRate * remainingDays * 100) / 100;

    console.log('🔵 UNUSED VALUE CALC:', {
      currentProductLimit: currentPayment.product_limit,
      currentExpiryDate: currentPayment.expiry_date,
      today: today.toISOString().split('T')[0],
      remainingDays,
      dailyRate: dailyRate.toFixed(4),
      calculatedUnusedValue: unusedValue,
      formula: `${dailyRate.toFixed(4)} × ${remainingDays} days = ${unusedValue}`,
    });

    return unusedValue;
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
        .orderBy('payment.updated_at', 'DESC')
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
      let requestedPriceCalc: {
        days: number;
        dailyPrice: number;
        totalPrice: number;
      };
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

        // IMPORTANT: Recalculate current plan price using same formula as SubscriptionPlan (matching reference)
        // This ensures current_total_price matches what the frontend calculates
        const currentPriceCalc = this.calculateDayBasedPrice(
          currentProductLimit,
          currentPayment.expiry_date
        );
        currentTotalPrice = currentPriceCalc.totalPrice;

        console.log(
          '🔵 [7] RECALCULATED CURRENT PLAN PRICE (matching SubscriptionPlan formula):',
          {
            productLimit: currentProductLimit,
            expiryDate: currentPayment.expiry_date,
            daysRemaining: currentPriceCalc.days,
            dailyRate: currentPriceCalc.dailyPrice,
            recalculatedPrice: currentTotalPrice,
            originalStoredPrice: Number(currentPayment.total_price) || 0,
          }
        );

        console.log('🔵 [7.5] CALCULATING UNUSED VALUE for expired plan');
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

      // Get user credit from user table
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });

      const userCredit = Number(user?.credit) || 0;
      console.log('🔵 [9.5] USER CREDIT:', userCredit);

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
      // price_difference: requested_price - current_price (positive for upgrade, negative for downgrade)
      const priceDifference = requestedPriceCalc.totalPrice - currentTotalPrice;

      // Net cost calculation (matching frontend logic):
      // For upgrade:
      //   - Available credit = user_credit + unused_value_from_current_plan
      //   - creditToUse = min(available_credit, price_difference)
      //   - netCost = max(0, price_difference - creditToUse)
      // For downgrade/renewal: netCost = 0
      let netCost = 0;
      if (priceDifference > 0) {
        // UPGRADE: Calculate available credit and apply it
        const totalAvailableCredit = userCredit + unusedValue;
        const creditToUse = Math.min(totalAvailableCredit, priceDifference);
        netCost = Math.max(0, priceDifference - creditToUse);

        console.log('🔵 [11] UPGRADE CALCULATION:', {
          priceDifference,
          userCredit,
          unusedValue,
          totalAvailableCredit,
          creditToUse,
          netCost,
        });
      } else {
        // DOWNGRADE or RENEWAL: No payment required
        console.log('🔵 [11] DOWNGRADE/RENEWAL:', {
          priceDifference,
          netCost: 0,
        });
      }

      // Check if there's already a pending request for this store
      // If exists, automatically REJECT it (only one valid request per store)
      console.log('🔵 [12] CHECKING FOR EXISTING PENDING REQUESTS');
      const existingRequests = await queryRunner.manager.find(
        SubscriptionRequest,
        {
          where: {
            store_id: dto.store_id,
            status: SubscriptionRequestStatus.PENDING,
          },
        }
      );

      if (existingRequests.length > 0) {
        console.log(
          '🔵 [12.1] FOUND',
          existingRequests.length,
          'EXISTING PENDING REQUEST(S) - AUTO-REJECTING'
        );

        // Auto-reject all existing pending requests
        for (const oldRequest of existingRequests) {
          oldRequest.status = SubscriptionRequestStatus.REJECTED;
          oldRequest.admin_notes = 'Auto-rejected: New request created';
          oldRequest.processed_by = null; // No admin manually rejected it
          oldRequest.processed_at = new Date();
          await queryRunner.manager.save(SubscriptionRequest, oldRequest);
          console.log('🔵 [12.2] AUTO-REJECTED REQUEST:', oldRequest.id);
        }
      }

      console.log('🔵 [13] PROCEEDING WITH NEW REQUEST');

      // Create the subscription request
      // Set start date to today at midnight (same as frontend calculation)
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

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
        current_total_price: currentPayment ? currentTotalPrice : null, // Use recalculated price (matching SubscriptionPlan formula)
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

        // Credit Calculation Logic when accepting payment request
        // a = user credit (existing account balance)
        // b = remaining_credit_value (price of remainder of current plan)
        // c = requested_total_price (new request plan price)
        //
        // Formula: new_credit = a + b - c
        // If (a + b - c) > 0: user credit = a + b - c
        // If (a + b - c) <= 0: user credit = 0
        //
        // NOTE: Decimal columns from PostgreSQL need parseFloat conversion
        const userCredit = parseFloat(String(user.credit || 0)); // a
        const remainingPlanValue = parseFloat(
          String(request.remaining_credit_value || 0)
        ); // b
        const newRequestPrice = parseFloat(
          String(request.requested_total_price || 0)
        ); // c

        console.log('🔵 CREDIT CALCULATION DEBUG:', {
          a_userCredit: userCredit,
          b_remainingPlanValue: remainingPlanValue,
          c_newRequestPrice: newRequestPrice,
          formula: `${userCredit} + ${remainingPlanValue} - ${newRequestPrice} = ${userCredit + remainingPlanValue - newRequestPrice}`,
        });

        // Calculate new credit: a + b - c
        const calculatedCredit =
          userCredit + remainingPlanValue - newRequestPrice;
        const newCredit = Math.round(Math.max(0, calculatedCredit) * 100) / 100;

        console.log('🔵 CREDIT UPDATE RESULT:', {
          calculatedCredit: calculatedCredit,
          finalCredit: newCredit,
        });

        user.credit = newCredit;

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
          notes: `Created from subscription request ${request.id}. User Credit (a): £${userCredit.toFixed(2)}, Remaining Plan Value (b): £${remainingPlanValue.toFixed(2)}, New Request Price (c): £${newRequestPrice.toFixed(2)}, Final Credit: £${newCredit.toFixed(2)}`,
        });

        await queryRunner.manager.save(Payment, newPayment);

        // // If there was a previous payment, mark it as unpaid (expired)
        // const currentPayment = await queryRunner.manager.find(Payment, {
        //   where: { store_id: request.store_id, is_paid: true },
        //   order: { updated_at: 'DESC' },
        //   take: 2,
        // });

        // if (currentPayment.length > 1) {
        //   const previousPayment = currentPayment[1];
        //   previousPayment.is_paid = false;
        //   await queryRunner.manager.save(Payment, previousPayment);
        // }
      }

      const updatedRequest = await queryRunner.manager.save(
        SubscriptionRequest,
        request
      );

      // Reload user to get updated credit
      const updatedUser = await queryRunner.manager.findOne(User, {
        where: { id: request.user_id },
      });

      await queryRunner.commitTransaction();

      const response = this.formatResponse(updatedRequest);
      // Include updated user credit in response
      if (updatedUser) {
        response.user = {
          ...response.user,
          credit: parseFloat(String(updatedUser.credit || 0)),
        };
      }
      return response;
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
              credit: request.user.credit, // Include user credit for payment breakdown display
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
