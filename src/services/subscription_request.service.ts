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

  async createRequest(userId: string, dto: CreateSubscriptionRequestDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get current payment for the store
      const currentPayment = await queryRunner.manager
        .find(Payment, {
          where: { store_id: dto.store_id, is_paid: true },
          order: { start_date: 'DESC' },
          take: 1,
        })
        .then((payments) => payments[0]);

      // Calculate requested total price
      const PRODUCT_UNIT = 50;
      const BASE_PRICE = 50;
      const units = Math.max(1, dto.new_product_limit / PRODUCT_UNIT);
      const requestedTotalPrice = units * BASE_PRICE * dto.new_month_count;

      // Calculate current plan details
      let currentProductLimit = 50;
      let currentMonthCount = 1;
      let currentTotalPrice = BASE_PRICE;

      if (currentPayment) {
        currentProductLimit = currentPayment.product_limit;
        currentMonthCount = currentPayment.month_count;
        currentTotalPrice = Number(currentPayment.total_price);
      }

      // Determine request type
      let requestType = SubscriptionRequestType.NEW;
      if (currentPayment) {
        const currentUnits = Math.max(1, currentProductLimit / PRODUCT_UNIT);
        const currentPrice = currentUnits * BASE_PRICE * currentMonthCount;
        if (requestedTotalPrice > currentPrice) {
          requestType = SubscriptionRequestType.UPGRADE;
        } else if (requestedTotalPrice < currentPrice) {
          requestType = SubscriptionRequestType.DOWNGRADE;
        } else {
          requestType = SubscriptionRequestType.RENEWAL;
        }
      }

      // Calculate price difference and net cost
      const priceDifference = requestedTotalPrice - currentTotalPrice;
      const netCost = Math.max(0, priceDifference); // Only charge for upgrades

      // Check if there's already a pending request for this store
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

      // Create the subscription request
      const request = queryRunner.manager.create(SubscriptionRequest, {
        user_id: userId,
        store_id: dto.store_id,
        store_name: dto.store_name,
        current_product_limit: currentPayment?.product_limit,
        current_month_count: currentPayment?.month_count,
        current_total_price: currentPayment?.total_price,
        requested_product_limit: dto.new_product_limit,
        requested_month_count: dto.new_month_count,
        requested_total_price: requestedTotalPrice,
        price_difference: priceDifference,
        net_cost: netCost,
        request_type: requestType,
        user_notes: dto.user_notes,
        status: SubscriptionRequestStatus.PENDING,
      });

      const savedRequest = await queryRunner.manager.save(
        SubscriptionRequest,
        request
      );
      await queryRunner.commitTransaction();

      return this.formatResponse(savedRequest);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
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
        // Get current payment
        const currentPayment = await queryRunner.manager
          .find(Payment, {
            where: { store_id: request.store_id, is_paid: true },
            order: { start_date: 'DESC' },
            take: 1,
          })
          .then((payments) => payments[0]);

        // Get user credit
        const user = await queryRunner.manager.findOne(User, {
          where: { id: request.user_id },
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        const userCredit = Number(user.credit) || 0;
        const netCost = Number(request.net_cost);

        // Check if user has enough credit for the upgrade
        if (userCredit < netCost) {
          throw new BadRequestException(
            'User does not have sufficient credit for this upgrade'
          );
        }

        // Deduct credit from user
        user.credit = userCredit - netCost;
        await queryRunner.manager.save(User, user);

        // Create new payment record
        const startDate = new Date();
        const expiryDate = new Date(startDate);
        expiryDate.setMonth(
          expiryDate.getMonth() + request.requested_month_count
        );

        const newPayment = queryRunner.manager.create(Payment, {
          user_id: request.user_id,
          store_id: request.store_id,
          store_name: request.store_name,
          product_limit: request.requested_product_limit,
          month_count: request.requested_month_count,
          total_price: request.requested_total_price,
          is_paid: true,
          start_date: startDate,
          expiry_date: expiryDate,
        });

        await queryRunner.manager.save(Payment, newPayment);

        // If there was a previous payment, mark it as unpaid (expired)
        if (currentPayment) {
          currentPayment.is_paid = false;
          await queryRunner.manager.save(Payment, currentPayment);
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
    const request = await this.subscriptionRequestRepository.findOne({
      where: {
        store_id: storeId,
        status: SubscriptionRequestStatus.PENDING,
      },
      relations: ['user', 'store'],
    });

    return request ? this.formatResponse(request) : null;
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
    return {
      id: request.id,
      user_id: request.user_id,
      store_id: request.store_id,
      store_name: request.store_name,
      current_product_limit: request.current_product_limit,
      current_month_count: request.current_month_count,
      current_total_price: request.current_total_price,
      requested_product_limit: request.requested_product_limit,
      requested_month_count: request.requested_month_count,
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
      store: request.store
        ? {
            id: request.store.id,
            name: request.store.name,
          }
        : undefined,
      processor: request.processor
        ? {
            id: request.processor.id,
            email: request.processor.email,
          }
        : undefined,
    };
  }
}
