import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { FavoriteService } from '../services/favorite.service';
import { CreateFavoriteDto, UpdateFavoriteDto } from '../dto/favorite.dto';
import { Favorite } from '../model/favorite.model';

@Controller('favorites')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Post()
  async create(
    @Body() createFavoriteDto: CreateFavoriteDto
  ): Promise<Favorite> {
    return await this.favoriteService.create(createFavoriteDto);
  }

  @Get()
  async findAll(): Promise<Favorite[]> {
    return await this.favoriteService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Favorite> {
    return await this.favoriteService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateFavoriteDto: UpdateFavoriteDto
  ): Promise<Favorite> {
    return await this.favoriteService.update(id, updateFavoriteDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return await this.favoriteService.remove(id);
  }

  @Delete('by-user-product')
  async removeByUserAndProduct(
    @Body('user_id') user_id: string,
    @Body('product') product: string
  ): Promise<void> {
    return await this.favoriteService.removeByUserAndProduct(user_id, product);
  }
}
