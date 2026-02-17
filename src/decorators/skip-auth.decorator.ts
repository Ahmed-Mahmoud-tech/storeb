import { SetMetadata } from '@nestjs/common';

export const SKIP_AUTH_KEY = 'skipAuth';

/**
 * Decorator to skip JWT authentication for a specific route
 * Usage: @SkipAuth() on a route handler
 */
export const SkipAuth = () => SetMetadata(SKIP_AUTH_KEY, true);
