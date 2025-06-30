import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const options: Record<string, unknown> = {};
    const query = req.query as Record<string, unknown>;
    if (
      query &&
      typeof query === 'object' &&
      Object.prototype.hasOwnProperty.call(query, 'state')
    ) {
      const stateValue = query['state'];
      if (typeof stateValue === 'string') {
        (options as { state?: string }).state = stateValue;
      }
    }
    return options;
  }
}
