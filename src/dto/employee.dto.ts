import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsArray,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(['manager', 'sales'])
  role?: string;

  @IsNotEmpty()
  @IsString()
  status: string;

  @IsArray()
  @IsUUID('4', { each: true })
  branches: string[];

  @IsNotEmpty()
  @IsUUID()
  from_user_id: string;

  @IsOptional()
  @IsUUID()
  to_user_id?: string;

  @IsOptional()
  @IsUUID()
  created_by?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(['manager', 'sales'])
  role?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  branches?: string[];

  @IsOptional()
  @IsUUID()
  updated_by?: string;
}
