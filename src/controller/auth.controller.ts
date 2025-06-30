import {
  Controller,
  Get,
  Req,
  UseGuards,
  HttpStatus,
  HttpException,
  Res,
  Logger,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { UserService } from '../services/user.service';
import { Response, Request as ExpressRequest, CookieOptions } from 'express';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GoogleAuthGuard } from '../auth/google-auth.guard';

// Extended request interface to include user from Passport and cookies
interface RequestWithUser extends ExpressRequest {
  user: { email: string; name: string; accessToken: string };
}

// Request interface for JWT authenticated requests
interface JwtRequestUser extends ExpressRequest {
  user: { id: string; email: string; type: string };
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {
    // Initiates Google OAuth login
    this.logger.log('Google login initiated');
  }
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: JwtRequestUser) {
    // The user is automatically added to the request by the JwtAuthGuard
    const userId = req.user?.id;
    if (!userId) {
      throw new HttpException('User ID not found', HttpStatus.BAD_REQUEST);
    }
    this.logger.log(`Fetching profile for user ID: ${userId}`);
    return this.userService.getUserById(userId);
  }

  @Get('google/callback')
  @UseGuards(PassportAuthGuard('google'))
  async googleLoginCallback(
    @Req() req: RequestWithUser,
    @Res() res: Response
  ): Promise<void> {
    // Handles the Google OAuth callback
    const { email, name } = req.user;
    // const { email, name, accessToken } = req.user;

    if (!email) {
      throw new HttpException(
        'Email not provided by Google',
        HttpStatus.BAD_REQUEST
      );
    }

    // Check if user exists in our database
    let user = await this.userService.findUserByEmail(email);

    // If user doesn't exist, create a new one
    if (!user) {
      try {
        user = await this.userService.createUser({
          name,
          email,
          type: 'client', // Default role, you might want to customize this
        });
        this.logger.log(`New user created: ${email}`);
      } catch {
        throw new HttpException(
          'Failed to create user from Google OAuth',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    } else {
      this.logger.log(`User logged in: ${email}`);
    }

    // Generate JWT token
    const token = this.jwtService.sign(
      {
        userId: user.id,
        email: user.email,
        type: user.type,
      },
      {
        expiresIn: '7d', // Token expires in 7 days
      }
    );

    // Debug the cookie headers
    this.logger.log(`Cookie headers: ${req.headers.cookie}`);

    // Parse redirect info from OAuth state param ONLY
    let redirectLink = '';
    let redirectSection = '';

    if (req.query.state) {
      try {
        const state = decodeURIComponent(req.query.state as string);
        const params = new URLSearchParams(state);
        if (params.get('redirectLink')) {
          redirectLink = params.get('redirectLink')!;
        }
        if (params.get('section')) {
          redirectSection = params.get('section')!;
        }
        this.logger.log('Parsed from state:', {
          redirectLink,
          redirectSection,
        });
      } catch (err) {
        this.logger.error('Error parsing state param:', err);
      }
    }

    // Provide sensible defaults if state is missing or empty
    if (!redirectLink) redirectLink = '';
    if (!redirectSection) redirectSection = '';

    // Set cookies with proper options for cross-site and browser visibility
    res.cookie('auth_token', token, {
      httpOnly: false, // Set to true if you do not need JS access
      secure: false, // Set to true only in production with HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax', // Use 'none' if cross-site and secure is true
      path: '/',
      // domain: process.env.CLIENT_DOMAIN || undefined, // Uncomment and set if needed
    });
    res.cookie(
      'user',
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        type: user.type,
      }),
      {
        httpOnly: false, // Allow JS access if needed
        secure: false, // Set to true only in production with HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        path: '/',
        // domain: process.env.CLIENT_DOMAIN || undefined, // Uncomment and set if needed
      }
    );

    // // Sanitize and encode user data for URL
    // const encodedUser = encodeURIComponent(
    //   JSON.stringify({
    //     id: user.id,
    //     name: user.name,
    //     email: user.email,
    //     type: user.type,
    //   })
    // );
    // Build redirect URL safely
    const baseUrl = process.env.CLIENT_BASE_URL || 'http://localhost:3000';
    let redirectUrl = baseUrl;
    if (redirectLink) {
      redirectUrl += `/${redirectLink}`;
    }
    // redirectUrl += `?user=${encodedUser}`;
    if (redirectSection) {
      redirectUrl += `?section=${encodeURIComponent(redirectSection)}`;
    }

    this.logger.log(`Redirecting to: ${redirectUrl}`);
    return res.redirect(redirectUrl);
    // res.status(HttpStatus.OK).json({
    //   message: 'Successfully authenticated with Google',
    //   user: {
    //     id: user.id,
    //     name: user.name,
    //     email: user.email,
    //     type: user.type,
    //   },
    //   // token: token
    // });
  }

  @Get('logout')
  logout(@Res() res: Response) {
    // Clear the auth cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    this.logger.log('User logged out');
    return res
      .status(HttpStatus.OK)
      .json({ message: 'Logged out successfully' });
  }
}
