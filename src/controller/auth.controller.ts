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
import { Response, Request as ExpressRequest } from 'express';
import { parse } from 'cookie';
// Extended request interface to include user from Passport and cookies
interface RequestWithUser extends ExpressRequest {
  user: { email: string; name: string; accessToken: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly userService: UserService) {}

  @Get('google')
  @UseGuards(PassportAuthGuard('google'))
  async googleLogin(): Promise<void> {
    // Initiates Google OAuth login
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
    } // You could add JWT token generation here
    // const token = this.jwtService.sign({ sub: user.user_id, email: user.email });    // For now, just return the user info or redirect to a frontend URL with the token

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

    return res.redirect(
      `http://localhost:3000/${redirectLink}?user=${JSON.stringify(user)}&section=${redirectSection}`
    );
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
}
