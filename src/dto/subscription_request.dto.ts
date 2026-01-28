import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
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

  @IsInt()
  @Min(1)
  @Max(12)
  new_month_count: number;

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
