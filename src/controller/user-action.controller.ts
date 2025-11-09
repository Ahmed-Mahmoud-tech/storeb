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
import { CreateUserActionDto, GetUserActionsQueryDto } from '../dto/user-action.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('user-actions')
export class UserActionController {
  constructor(private readonly userActionService: UserActionService) {}

  /**
   * Record a user action
   * POST /user-actions
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async recordAction(
    @Body() createUserActionDto: CreateUserActionDto,
    @Req() request: Request
  ) {
    const userId = (request.user as any)?.id;
    const ipAddress = request.ip || request.headers['x-forwarded-for'] as string;
    const userAgent = request.headers['user-agent'];

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
    const userId = (request.user as any)?.id;
    return await this.userActionService.getUserActions(userId, query);
  }

  /**
   * Get current user's action statistics
   * GET /user-actions/me/stats
   */
  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  async getMyStats(@Req() request: Request) {
    const userId = (request.user as any)?.id;
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
    @Param('storeId') storeId: string,
    @Query() query: GetUserActionsQueryDto
  ) {
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
}
