import { IsString, IsInt, IsOptional, IsUUID } from 'class-validator';

export class CreateRatingDto {
  @IsUUID()
  store_id: string;

  @IsUUID()
  user_id: string;

  @IsInt()
  rate?: number;
  @IsOptional()
  @IsString()
  comment?: string;

  @IsString()
  product_code: string;
}

export class UpdateRatingDto {
  @IsOptional()
  @IsUUID()
  store_id?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsInt()
  rate?: number;
  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  product_code?: string;
}
