import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ActionType } from '../model/user-actions.model';

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
}
