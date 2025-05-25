import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import {
  Strategy as GoogleStrategyType,
  VerifyCallback,
} from 'passport-google-oauth20';

interface GoogleUser {
  email: string | null;
  name: string;
  accessToken: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  GoogleStrategyType,
  'google'
) {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: {
      name?: { givenName?: string; familyName?: string };
      emails?: { value: string }[];
    },
    done: VerifyCallback
  ): GoogleUser {
    const { name, emails } = profile;
    const user: GoogleUser = {
      email: emails?.[0]?.value || null,
      name: (name?.givenName || '') + ' ' + (name?.familyName || ''),
      accessToken,
    };
    done(null, user);
    return user; // Explicitly return the user object
  }
}
