import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: any, status: any) {
    // If there's no error and user exists, return the user
    if (user) {
      return user;
    }
    // If there's an error or no user, continue without throwing
    // This allows both authenticated and unauthenticated requests
    return null;
  }
}
