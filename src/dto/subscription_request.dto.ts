import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsISO8601,
} from 'class-validator';
import { SubscriptionRequestStatus } from '../model/subscription_request.model';

export class CreateSubscriptionRequestDto {
  @IsNotEmpty()
  @IsString()
  store_id: string;

  @IsNotEmpty()
  @IsString()
  store_name: string;

  @IsInt()
  @Min(1)
  new_product_limit: number;

  @IsNotEmpty()
  @IsISO8601()
  expiry_date: string; // ISO 8601 format date (plan expires on this date)

  @IsOptional()
  @IsString()
  user_notes?: string;
}

export class ProcessSubscriptionRequestDto {
  @IsEnum(SubscriptionRequestStatus)
  status: SubscriptionRequestStatus;

  @IsOptional()
  @IsString()
  admin_notes?: string;
}

export class SubscriptionRequestListQueryDto {
  @IsOptional()
  @IsEnum(SubscriptionRequestStatus)
  status?: SubscriptionRequestStatus;

  @IsOptional()
  @IsString()
  store_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
