import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UserActionService } from '../services/user-action.service';
import {
  CreateUserActionDto,
  GetUserActionsQueryDto,
} from '../dto/user-action.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { canActivate } from 'src/decorators/auth-helpers';
import { DataSource } from 'typeorm';
@Controller('user-actions')
export class UserActionController {
  constructor(
    private readonly userActionService: UserActionService,
    private readonly dataSource: DataSource
  ) {}

  /**
   * Record a user action (supports both authenticated and anonymous users)
   * POST /user-actions
   */
  @Post()
  async recordAction(
    @Body() createUserActionDto: CreateUserActionDto,
    @Req() request: Request
  ) {
    const user = request.user as { id: string } | undefined;
    const userId = user?.id || createUserActionDto.user_id;

    // If no user ID from auth or DTO, reject the request
    if (!userId) {
      throw new Error(
        'User ID is required. Either authenticate or provide user_id in the request body.'
      );
    }

    const ipAddress =
      request.ip || (request.headers['x-forwarded-for'] as string) || '';
    const userAgent = request.headers['user-agent'] || '';

    return await this.userActionService.recordAction(
      userId,
      createUserActionDto,
      ipAddress,
      userAgent
    );
  }

  /**
   * Get current user's actions
   * GET /user-actions/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyActions(
    @Query() query: GetUserActionsQueryDto,
    @Req() request: Request
  ) {
    const user = request.user as { id: string } | undefined;
    const userId = user?.id;
    if (!userId) {
      throw new Error('User ID not found');
    }
    return await this.userActionService.getUserActions(userId, query);
  }

  /**
   * Get current user's action statistics
   * GET /user-actions/me/stats
   */
  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  async getMyStats(@Req() request: Request) {
    const user = request.user as { id: string } | undefined;
    const userId = user?.id;
    if (!userId) {
      throw new Error('User ID not found');
    }
    return await this.userActionService.getUserActionStats(userId);
  }

  /**
   * Get actions for a specific user (admin only - you may want to add admin guard)
   * GET /user-actions/user/:userId
   */
  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserActions(
    @Param('userId') userId: string,
    @Query() query: GetUserActionsQueryDto
  ) {
    return await this.userActionService.getUserActions(userId, query);
  }

  /**
   * Get actions for a specific store
   * GET /user-actions/store/:storeId
   */
  @Get('store/:storeId')
  @UseGuards(JwtAuthGuard)
  async getStoreActions(
    @Req() request: Request,
    @Param('storeId') storeId: string,
    @Query() query: GetUserActionsQueryDto
  ) {
    await canActivate(this.dataSource, {
      roles: ['owner', 'manager', 'sales'],
      user: request.user as { id: string; type: string },
      storeId: storeId,
    });
    return await this.userActionService.getStoreActions(storeId, query);
  }

  /**
   * Get actions for a specific product
   * GET /user-actions/product/:productId
   */
  @Get('product/:productId')
  @UseGuards(JwtAuthGuard)
  async getProductActions(
    @Param('productId') productId: string,
    @Query() query: GetUserActionsQueryDto
  ) {
    return await this.userActionService.getProductActions(productId, query);
  }

  /**
   * Record a search action in a store
   * POST /user-actions/search
   * Body: { storeId: string, searchQuery: string, user_id?: string }
   */
  @Post('search')
  async recordSearch(
    @Body() body: { storeId: string; searchQuery: string; user_id?: string },
    @Req() request: Request
  ) {
    const user = request.user as { id: string } | undefined;
    const userId = user?.id || body.user_id;
    const ipAddress =
      request.ip || (request.headers['x-forwarded-for'] as string) || '';
    const userAgent = request.headers['user-agent'] || '';

    return await this.userActionService.recordSearch(
      userId,
      body.storeId,
      body.searchQuery,
      ipAddress,
      userAgent
    );
  }
}
