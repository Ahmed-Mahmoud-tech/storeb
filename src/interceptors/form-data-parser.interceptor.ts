import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

/**
 * Interceptor to parse JSON strings in form-data requests into proper JavaScript objects
 */
@Injectable()
export class FormDataParserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.body && typeof request.body === 'object') {
      const body = request.body as Record<string, unknown>;
      this.parseJsonField(body, 'branches');

      // Process nested objects within branches if they exist
      if (Array.isArray(body.branches)) {
        body.branches = body.branches.map((branch: unknown) => {
          if (branch && typeof branch === 'object') {
            const branchObj = branch as Record<string, unknown>;

            // Parse nested properties
            this.parseJsonField(branchObj, 'coordinates');
            this.parseJsonField(branchObj, 'supportNumbers');
          }
          return branch;
        });
      }
    }

    return next.handle();
  }

  /**
   * Helper method to safely parse a JSON string field
   */
  private parseJsonField(
    obj: Record<string, unknown>,
    fieldName: string
  ): void {
    if (
      Object.prototype.hasOwnProperty.call(obj, fieldName) &&
      typeof obj[fieldName] === 'string'
    ) {
      try {
        const value = obj[fieldName];
        obj[fieldName] = JSON.parse(value);
        console.log(
          `Successfully parsed ${fieldName} as JSON:`,
          obj[fieldName]
        );
      } catch (error) {
        console.error(`Failed to parse ${fieldName} as JSON:`, error);
        // Keep the original string if parsing fails
      }
    }
  }
}
