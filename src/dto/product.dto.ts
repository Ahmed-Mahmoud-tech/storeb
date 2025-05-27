import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductTagsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colors?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sizes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materials?: string[];
}

export class CreateProductDto {
  @IsString()
  product_code: string;

  @IsString()
  product_name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  branchIds: string[];

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  priceBeforeSale?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  newArrival?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductTagsDto)
  tags?: ProductTagsDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsUUID('4')
  createdBy?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  product_code?: string;

  @IsOptional()
  @IsString()
  product_name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds?: string[];

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  priceBeforeSale?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  newArrival?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductTagsDto)
  tags?: ProductTagsDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsUUID('4')
  createdBy?: string;

  @IsOptional()
  @IsUUID('4')
  updatedBy?: string;
}
