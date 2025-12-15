import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsUUID,
  MinLength,
  IsBoolean,
} from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsUUID()
  user_id?: string; // UUID, optional if generated on backend

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  country_code?: string; // e.g., "+20", "+966"

  @IsOptional()
  @IsString()
  phone?: string; // phone number without country code

  @IsEnum(['owner', 'employee', 'manager', 'client', 'sales'])
  type!: 'owner' | 'employee' | 'manager' | 'client' | 'sales';

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;

  @IsOptional()
  @IsBoolean()
  email_verified?: boolean;

  @IsOptional()
  @IsString()
  verification_token?: string;

  @IsOptional()
  @IsUUID()
  created_by?: string; // UUID of the user creating this record
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  country_code?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(['owner', 'employee', 'manager', 'client', 'sales'])
  type?: 'owner' | 'employee' | 'manager' | 'client' | 'sales';

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;

  @IsOptional()
  @IsBoolean()
  email_verified?: boolean;

  @IsOptional()
  @IsString()
  verification_token?: string;

  @IsOptional()
  @IsUUID()
  updated_by?: string; // UUID of the user updating this record
}

export class RegisterWithEmailDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;

  @IsEnum(['owner', 'employee', 'manager', 'client', 'sales'])
  type!: 'owner' | 'employee' | 'manager' | 'client' | 'sales';

  @IsOptional()
  @IsString()
  country_code?: string; // e.g., "+20", "+966"

  @IsOptional()
  @IsString()
  phone?: string; // phone number without country code
}

export class LoginWithEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  token!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword!: string;
}
