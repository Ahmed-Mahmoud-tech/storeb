import { IsString, IsOptional, IsEmail, IsEnum, IsUUID } from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsUUID()
  user_id?: string; // UUID, optional if generated on backend

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(['owner', 'employee', 'manager', 'client', 'sales'])
  type!: 'owner' | 'employee' | 'manager' | 'client' | 'sales';

  @IsEmail()
  email!: string;

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
  phone?: string;

  @IsOptional()
  @IsEnum(['owner', 'employee', 'manager', 'client', 'sales'])
  type?: 'owner' | 'employee' | 'manager' | 'client' | 'sales';

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID()
  updated_by?: string; // UUID of the user updating this record
}
