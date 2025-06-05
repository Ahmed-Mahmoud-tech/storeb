import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FavoriteService } from '../services/favorite.service';
import { CreateFavoriteDto, UpdateFavoriteDto } from '../dto/favorite.dto';
import { Favorite } from '../model/favorite.model';
import { Product } from '../model/product.model';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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

  @Get('my-favorites')
  @UseGuards(JwtAuthGuard)
  async getUserFavoriteProducts(
    @Req() req: { user: { id: string } },
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ): Promise<{
    products: Product[];
    total: number;
    page: number;
    limit: number;
  }> {
    const userId = req.user.id;
    return await this.favoriteService.findProductsByUserId(userId, page, limit);
  }

  @Get('user/:userId/products')
  async findProductsByUserId(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ): Promise<{
    products: Product[];
    total: number;
    page: number;
    limit: number;
  }> {
    return await this.favoriteService.findProductsByUserId(userId, page, limit);
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
