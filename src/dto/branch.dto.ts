import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CoordinatesDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsString()
  address: string;
}

export class SupportNumberDto {
  @IsString()
  phone: string;

  @IsBoolean()
  whatsapp: boolean;
}

export class CreateBranchDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsUUID('4')
  store_id?: string;

  @IsString()
  name: string;

  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates: CoordinatesDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportNumberDto)
  supportNumbers: SupportNumberDto[];

  @IsOptional()
  @IsBoolean()
  is_online?: boolean;
}
