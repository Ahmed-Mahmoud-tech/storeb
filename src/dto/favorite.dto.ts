import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateFavoriteDto {
  @IsString()
  product!: string; // product_code

  @IsUUID()
  user_id!: string;
}

export class UpdateFavoriteDto {
  @IsOptional()
  @IsString()
  product?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;
}
