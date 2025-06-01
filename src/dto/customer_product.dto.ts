import {
  IsString,
  IsArray,
  IsUUID,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class CreateCustomerProductDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsArray()
  @IsString({ each: true })
  product_code!: string[];

  @IsUUID()
  @IsNotEmpty()
  employee!: string; // user id of the employee

  @IsOptional()
  @IsUUID()
  branch_id?: string; // branch id reference
}

export class UpdateCustomerProductDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  product_code?: string[];

  @IsOptional()
  @IsUUID()
  employee?: string; // user id of the employee

  @IsOptional()
  @IsUUID()
  branch_id?: string; // branch id reference
}
