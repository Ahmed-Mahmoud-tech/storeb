import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionRequestService } from '../services/subscription_request.service';
import {
  CreateSubscriptionRequestDto,
  ProcessSubscriptionRequestDto,
  SubscriptionRequestListQueryDto,
} from '../dto/subscription_request.dto';
import { SubscriptionRequestStatus } from '../model/subscription_request.model';

interface AuthenticatedRequest {
  user: {
    id: string;
    email?: string;
    role?: string;
  };
}

@Controller('subscription-requests')
export class SubscriptionRequestController {
  private readonly logger = new Logger(SubscriptionRequestController.name);

  constructor(
    private readonly subscriptionRequestService: SubscriptionRequestService
  ) {}

  /**
   * Create a new subscription request (user)
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async createRequest(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateSubscriptionRequestDto
  ) {
    this.logger.log(
      `User ${req.user.id} creating subscription request for store ${dto.store_name}`
    );
    return this.subscriptionRequestService.createRequest(req.user.id, dto);
  }

  /**
   * Get all subscription requests (admin)
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Request() _req: AuthenticatedRequest,
    @Query() query: SubscriptionRequestListQueryDto
  ) {
    // TODO: Add admin role check
    this.logger.log(
      `Fetching subscription requests with filters: ${JSON.stringify(query)}`
    );
    return this.subscriptionRequestService.findAll(
      query.status,
      query.store_id,
      query.user_id,
      query.page,
      query.limit
    );
  }

  /**
   * Get pending requests count (admin dashboard)
   */
  @Get('pending-count')
  @UseGuards(JwtAuthGuard)
  async getPendingCount() {
    const result = await this.subscriptionRequestService.findAll(
      SubscriptionRequestStatus.PENDING
    );
    return { count: result.total };
  }

  /**
   * Get my requests (user)
   */
  @Get('my-requests')
  @UseGuards(JwtAuthGuard)
  async findMyRequests(@Request() req: AuthenticatedRequest) {
    return this.subscriptionRequestService.findByUser(req.user.id);
  }

  /**
   * Get pending request for a store (user)
   * Returns null if no pending request exists
   */
  @Get('store/:storeId/pending')
  @UseGuards(JwtAuthGuard)
  async findPendingByStore(@Param('storeId') storeId: string) {
    const result =
      await this.subscriptionRequestService.findPendingByStore(storeId);
    return result || null; // Explicitly return null if no pending request
  }

  /**
   * Get a specific request
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.subscriptionRequestService.findOne(id);
  }

  /**
   * Process a request (admin - approve/reject)
   */
  @Patch(':id/process')
  @UseGuards(JwtAuthGuard)
  async processRequest(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ProcessSubscriptionRequestDto
  ) {
    // TODO: Add admin role check
    this.logger.log(
      `Admin ${req.user.id} processing request ${id} with status ${dto.status}`
    );
    return this.subscriptionRequestService.processRequest(id, req.user.id, dto);
  }

  /**
   * Cancel a pending request (user)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async cancelRequest(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string
  ) {
    this.logger.log(`User ${req.user.id} cancelling request ${id}`);
    return this.subscriptionRequestService.cancelRequest(id, req.user.id);
  }
}
