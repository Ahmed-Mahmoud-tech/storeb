import {
  IsUUID,
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';

// Get PRODUCT_UNIT from environment (defaults to 50)
const PRODUCT_UNIT = parseInt(process.env.PRODUCT_UNIT || '50', 10);

@ValidatorConstraint({ name: 'minProductLimit', async: false })
export class MinProductLimitConstraint implements ValidatorConstraintInterface {
  validate(value: number) {
    return typeof value === 'number' && value >= PRODUCT_UNIT;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be at least ${PRODUCT_UNIT}`;
  }
}

export class CreatePaymentDto {
  @IsUUID()
  user_id!: string;

  @IsUUID()
  store_id!: string;

  @IsString()
  store_name!: string;

  @IsInt()
  @Validate(MinProductLimitConstraint)
  product_limit!: number; // Must be multiple of PRODUCT_UNIT

  @IsInt()
  @Min(1)
  month_count!: number;

  @IsOptional()
  @IsBoolean()
  is_paid?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePaymentDto {
  @IsOptional()
  @IsInt()
  @Validate(MinProductLimitConstraint)
  product_limit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  month_count?: number;

  @IsOptional()
  @IsBoolean()
  is_paid?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpgradeDowngradePaymentDto {
  @IsInt()
  @Validate(MinProductLimitConstraint)
  new_product_limit!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  new_month_count?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PaymentResponseDto {
  id!: string;
  user_id!: string;
  store_id!: string;
  store_name!: string;
  product_limit!: number;
  month_count!: number;
  total_price!: number;
  is_paid!: boolean;
  payment_date?: Date;
  start_date!: Date;
  expiry_date?: Date;
  notes?: string;
  updated_at!: Date;
}
