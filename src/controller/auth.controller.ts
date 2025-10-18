import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  HttpStatus,
  HttpException,
  Res,
  Logger,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { UserService } from '../services/user.service';
import { StoreService } from '../services/store.service';
import { Store } from '../model/store.model';
import { Branch } from '../model/branches.model';
import { Response, Request as ExpressRequest } from 'express';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GoogleAuthGuard } from '../auth/google-auth.guard';
import {
  RegisterWithEmailDto,
  LoginWithEmailDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../dto/user.dto';

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
    private readonly jwtService: JwtService,
    private readonly storeService: StoreService
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

    if (!email) {
      throw new HttpException(
        'Email not provided by Google',
        HttpStatus.BAD_REQUEST
      );
    }

    // Parse redirect info from OAuth state param ONLY
    let redirectLink = '';
    let redirectSection = '';
    let userTypeFromState = '';

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
        if (params.get('userType')) {
          userTypeFromState = params.get('userType')!;
        }
        this.logger.log('Parsed from state:', {
          redirectLink,
          redirectSection,
          userTypeFromState,
        });
      } catch (err) {
        this.logger.error('Error parsing state param:', err);
      }
    }

    // Check if user exists in our database
    let user = await this.userService.findUserByEmail(email);

    // If user doesn't exist and this is a login attempt, redirect with error
    if (!user && redirectSection === 'login') {
      const baseUrl = process.env.CLIENT_BASE_URL || 'http://localhost:3000';
      const errorRedirectUrl = `${baseUrl}?error=account_not_found`;
      this.logger.log(`Login attempt for non-existent user: ${email}`);
      return res.redirect(errorRedirectUrl);
    }

    // If user doesn't exist and this is registration, create a new one
    if (!user) {
      try {
        user = await this.userService.createUser({
          name,
          email,
          type: (userTypeFromState || 'client') as
            | 'owner'
            | 'client'
            | 'employee'
            | 'manager'
            | 'sales', // Use userType from state, default to 'client'
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
        sub: user.id,
        email: user.email,
        type: user.type,
      },
      {
        expiresIn: '30d', // Token expires in 30 days
      }
    );

    // Debug the cookie headers
    this.logger.log(`Cookie headers: ${req.headers.cookie}`);

    // Provide sensible defaults if state is missing or empty
    if (!redirectLink) redirectLink = '';
    if (!redirectSection) redirectSection = '';

    // Update user type based on the section parameter if provided
    let userType = user.type; // Default to existing type
    if (
      redirectSection &&
      ['owner', 'employee', 'manager', 'sales', 'client'].includes(
        redirectSection
      )
    ) {
      userType = redirectSection;

      // Update the user type in the database
      try {
        await this.userService.updateUser(user.id, {
          type: redirectSection as
            | 'owner'
            | 'client'
            | 'employee'
            | 'manager'
            | 'sales',
        });
        this.logger.log(`Updated user ${user.id} type to: ${redirectSection}`);
      } catch (error) {
        this.logger.error(
          `Failed to update user type: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    // Instead of setting cookies, redirect with token and user info in the URL
    const encodedUser = encodeURIComponent(
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        type: userType, // Use the updated type
        phone: user.phone, // Include phone field for validation
      })
    );
    const baseUrl = process.env.CLIENT_BASE_URL || 'http://localhost:3000';
    let redirectUrl = baseUrl;
    if (redirectLink) {
      redirectUrl += `/${redirectLink}`;
    }
    const params = new URLSearchParams();
    params.set('token', token);
    params.set('user', encodedUser);
    if (redirectSection) {
      params.set('section', redirectSection);
    }
    redirectUrl += `?${params.toString()}`;

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

  // Email/Password Authentication Endpoints

  @Post('register')
  async registerWithEmail(@Body() registerDto: RegisterWithEmailDto) {
    try {
      const user = await this.userService.registerWithEmail(registerDto);
      this.logger.log(`User registered successfully: ${user.email}`);

      return {
        message:
          'User registered successfully. Please check your email for verification.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          type: user.type,
          email_verified: user.email_verified,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Registration failed:', errorMessage);
      throw error;
    }
  }

  @Post('login')
  async loginWithEmail(@Body() loginDto: LoginWithEmailDto) {
    try {
      const user = await this.userService.loginWithEmail(loginDto);

      // Check if user is an owner and whether they have a store
      let hasStore = false;
      let storeData: (Store & { branches?: Branch[] }) | null = null;
      if (user.type === 'owner') {
        try {
          hasStore = await this.storeService.checkOwnerHasStore(user.id);
          this.logger.log(`Owner ${user.email} hasStore: ${hasStore}`);

          // If owner has a store, get the store data
          if (hasStore) {
            try {
              storeData = await this.storeService.findStoreByOwnerId(user.id);
              this.logger.log(
                `Store data for owner ${user.email}:`,
                storeData?.name || 'unknown'
              );
            } catch (error) {
              this.logger.error('Error fetching store data:', error);
              hasStore = false;
              storeData = null;
            }
          }
        } catch (error) {
          this.logger.error(
            `Error checking store for owner ${user.email}:`,
            error
          );
          hasStore = false;
          storeData = null;
        }
      }

      // Generate JWT token
      const token = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          type: user.type,
        },
        {
          expiresIn: '7d', // Token expires in 7 days
        }
      );

      this.logger.log(`User logged in successfully: ${user.email}`);

      const responseData = {
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          type: user.type,
          phone: user.phone,
          email_verified: user.email_verified,
          hasStore: user.type === 'owner' ? hasStore : undefined,
          store:
            user.type === 'owner' && storeData
              ? {
                  id: storeData.id,
                  name: storeData.name,
                  // Format store name for URL (replace spaces with underscores)
                  urlName: storeData.name?.split(' ').join('_'),
                }
              : undefined,
        },
      };

      this.logger.log(
        `Login response for ${user.email}:`,
        JSON.stringify(responseData.user)
      );

      return responseData;
    } catch (error) {
      this.logger.error('Login failed:', error);
      throw error;
    }
  }

  @Post('verify-email')
  async verifyEmail(@Body() verifyDto: VerifyEmailDto) {
    try {
      const result = await this.userService.verifyEmail(verifyDto.token);
      this.logger.log(`Email verified for user: ${result.user.email}`);

      return {
        message: result.message,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          type: result.user.type,
          email_verified: result.user.email_verified,
        },
      };
    } catch (error) {
      this.logger.error('Email verification failed:', error);
      throw error;
    }
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotDto: ForgotPasswordDto) {
    try {
      const result = await this.userService.forgotPassword(forgotDto.email);
      this.logger.log(
        `Forgot password request processed for: ${forgotDto.email}`
      );
      return result;
    } catch (error) {
      this.logger.error('Forgot password failed:', error);
      throw error;
    }
  }

  @Post('reset-password')
  async resetPassword(@Body() resetDto: ResetPasswordDto) {
    try {
      const result = await this.userService.resetPassword(
        resetDto.token,
        resetDto.newPassword
      );
      this.logger.log('Password reset successfully');
      return result;
    } catch (error) {
      this.logger.error('Password reset failed:', error);
      throw error;
    }
  }

  @Post('resend-verification')
  async resendVerificationEmail(@Body() body: { email: string }) {
    try {
      const result = await this.userService.resendVerificationEmail(body.email);
      this.logger.log(`Verification email resent to: ${body.email}`);
      return result;
    } catch (error) {
      this.logger.error('Resend verification failed:', error);
      throw error;
    }
  }
}
