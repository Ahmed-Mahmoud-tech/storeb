import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { UserActionService } from '../services/user-action.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActionType } from '../model/user-actions.model';

@Controller('test-tracking')
export class TestTrackingController {
  constructor(private readonly userActionService: UserActionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async testTracking(@Body() body: { userId: string; storeId: string; productId: string }) {
    console.log('Testing tracking with:', body);
    
    try {
      const result = await this.userActionService.recordAction(
        body.userId,
        {
          action_type: ActionType.PRODUCT_FAVORITE,
          store_id: body.storeId,
          product_id: body.productId,
        },
        '127.0.0.1',
        'test-agent'
      );
      
      return {
        success: true,
        message: 'Tracking test successful',
        data: result,
      };
    } catch (error) {
      console.error('Test tracking error:', error);
      return {
        success: false,
        message: error.message,
        error: error,
      };
    }
  }
}
