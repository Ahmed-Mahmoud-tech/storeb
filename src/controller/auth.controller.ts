import {
  Controller,
  Get,
  Req,
  UseGuards,
  HttpStatus,
  HttpException,
  Res,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { UserService } from '../services/user.service';
import { Response, Request as ExpressRequest, CookieOptions } from 'express';
import { parse } from 'cookie';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService
  ) {}

  @Get('google')
  @UseGuards(PassportAuthGuard('google'))
  async googleLogin(): Promise<void> {
    // Initiates Google OAuth login
  }
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: JwtRequestUser) {
    // The user is automatically added to the request by the JwtAuthGuard
    const userId = req.user?.id;
    if (!userId) {
      throw new HttpException('User ID not found', HttpStatus.BAD_REQUEST);
    }
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
      } catch {
        throw new HttpException(
          'Failed to create user from Google OAuth',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
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
    console.log(req.headers.cookie, 'cookie0000');

    // Safely parse cookies only if they exist
    let redirectLink = '';
    let redirectSection = '';

    try {
      if (req.headers.cookie) {
        const cookies = parse(req.headers.cookie);
        if (typeof cookies === 'object' && cookies !== null) {
          redirectLink = cookies.redirectLink || '';
          redirectSection = cookies.section || '';
        }
        // Log cookie values for debugging
        console.log('Cookies:', cookies);
        console.log('redirectLink:', redirectLink);
        console.log('redirectSection:', redirectSection);
      } else {
        console.log('No cookies found in request');
      }
    } catch (error) {
      console.error('Error parsing cookies:', error);
    }

    // Provide sensible defaults if cookies are missing or empty
    if (!redirectLink) redirectLink = '';
    if (!redirectSection) redirectSection = '';

    // Set JWT token as an HTTP-only cookie
    const cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      sameSite: 'lax',
      path: '/',
    };

    res.cookie('auth_token', token, cookieOptions);

    // Sanitize and encode user data for URL
    const encodedUser = encodeURIComponent(
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        type: user.type,
      })
    );
    // Build redirect URL safely
    const baseUrl = 'http://localhost:3000';
    let redirectUrl = baseUrl;
    if (redirectLink) {
      redirectUrl += `/${redirectLink}`;
    }
    redirectUrl += `?user=${encodedUser}`;
    if (redirectSection) {
      redirectUrl += `&section=${encodeURIComponent(redirectSection)}`;
    }

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

    return res
      .status(HttpStatus.OK)
      .json({ message: 'Logged out successfully' });
  }
}
