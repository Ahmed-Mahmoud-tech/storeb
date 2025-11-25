import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ActionType, UserAction } from '../model/user-actions.model';

export class CreateUserActionDto {
  @IsEnum(ActionType)
  action_type!: ActionType;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  store_id?: string;

  @IsOptional()
  @IsString()
  product_id?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class GetUserActionsQueryDto {
  @IsOptional()
  @IsEnum(ActionType)
  action_type?: ActionType;

  @IsOptional()
  @IsString()
  store_id?: string;

  @IsOptional()
  @IsString()
  product_id?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  offset?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  search_type?:
    | 'product_name'
    | 'product_id'
    | 'user_email'
    | 'user_name'
    | 'user_phone';

  @IsOptional()
  @IsString()
  search_value?: string;
}

export interface AnalyticsSummaryStats {
  total_actions: number;
  product_views: number;
  favorites: number;
  contacts: number; // whatsapp_click + phone_click
}

export interface ActionBreakdown {
  store_visit: number;
  product_view: number;
  product_favorite: number;
  product_unfavorite: number;
  whatsapp_click: number;
  phone_click: number;
  map_open: number;
  search: number;
  branch_visit: number;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummaryStats;
  breakdown: ActionBreakdown;
  recentActions: UserAction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
