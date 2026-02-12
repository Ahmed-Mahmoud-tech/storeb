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

/**
 * Guard to check if subscription plan is expired
 * Redirects to plan page if expired beyond grace period
 */
@Injectable()
export class PlanExpiryGuard implements CanActivate {
  private readonly logger = new Logger(PlanExpiryGuard.name);

  constructor(private readonly paymentService: PaymentService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context
      .switchToHttp()
      .getResponse<{ redirect: (url: string) => void }>();
    const body = request.body as Record<string, string> | undefined;
    const query = request.query as Record<string, string> | undefined;
    const params = request.params as Record<string, string> | undefined;
    const storeId: string | undefined =
      body?.storeId || query?.storeId || params?.storeId;

    if (!storeId) {
      // If no storeId, skip check
      return true;
    }

    try {
      const payment =
        await this.paymentService.findActivePaymentByStore(storeId);

      if (!payment) {
        return true; // No active payment, let through
      }

      // Convert ISO string to Date for comparison
      const expiryDateObj = new Date(payment.expiry_date);

      const isExpired = this.paymentService.isPlanExpired(expiryDateObj);
      const isExpiredBeyondGracePeriod =
        this.paymentService.isExpiredBeyondGracePeriod(expiryDateObj);

      if (isExpiredBeyondGracePeriod) {
        // Redirect to plan page for public view, throw error for API
        if (request.headers['content-type']?.includes('application/json')) {
          throw new HttpException(
            {
              message: 'Your subscription plan has expired beyond grace period',
              redirect: '/plans',
            },
            HttpStatus.GONE
          );
        } else {
          response.redirect('/plans');
          return false;
        }
      }

      if (isExpired) {
        // Log warning but allow access during grace period
        this.logger.warn(
          `Plan expired for store ${storeId}, but within grace period`
        );
      }

      return true;
    } catch (error) {
      this.logger.error(`Error in PlanExpiryGuard: ${error}`);
      // Don't block if there's an error checking expiry
      return true;
    }
  }
}
