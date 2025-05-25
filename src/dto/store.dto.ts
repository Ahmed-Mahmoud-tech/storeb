import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  IsHexColor,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBranchDto } from './branch.dto';

export enum StoreType {
  MEN = 'men',
  WOMEN = 'women',
  CHILDREN = 'children',
  SHOES = 'shoes',
}

export class CreateStoreDto {
  @IsUUID('4')
  @IsOptional()
  userId?: string;

  @IsString()
  storeName: string;

  @IsUUID('4')
  ownerId: string = '3a9fda4b-9068-4a7f-99bc-a7b927981c67';
  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  banner?: string;

  @IsOptional()
  @IsHexColor()
  themeColor?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  hasDelivery?: boolean;
  @IsArray()
  @IsString({ each: true })
  storeTypes!: string[];

  @IsOptional()
  @IsArray()
  @Type(() => CreateBranchDto)
  branches?: CreateBranchDto[];
}
