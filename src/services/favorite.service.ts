import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from '../model/favorite.model';
import { CreateFavoriteDto, UpdateFavoriteDto } from '../dto/favorite.dto';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>
  ) {}

  async create(createFavoriteDto: CreateFavoriteDto): Promise<Favorite> {
    const favorite = this.favoriteRepository.create(createFavoriteDto);
    return await this.favoriteRepository.save(favorite);
  }

  async findAll(): Promise<Favorite[]> {
    return await this.favoriteRepository.find();
  }

  async findOne(id: string): Promise<Favorite> {
    const favorite = await this.favoriteRepository.findOne({ where: { id } });
    if (!favorite) throw new NotFoundException('Favorite not found');
    return favorite;
  }

  async update(
    id: string,
    updateFavoriteDto: UpdateFavoriteDto
  ): Promise<Favorite> {
    const favorite = await this.findOne(id);
    Object.assign(favorite, updateFavoriteDto);
    return await this.favoriteRepository.save(favorite);
  }

  async remove(id: string): Promise<void> {
    const favorite = await this.findOne(id);
    await this.favoriteRepository.remove(favorite);
  }

  async removeByUserAndProduct(
    user_id: string,
    product: string
  ): Promise<void> {
    const favorite = await this.favoriteRepository.findOne({
      where: { user_id, product },
    });
    if (!favorite) throw new NotFoundException('Favorite not found');
    await this.favoriteRepository.remove(favorite);
  }

  // Get user's favorites by user_id
  async findByUserId(user_id: string): Promise<Favorite[]> {
    return await this.favoriteRepository.find({
      where: { user_id },
    });
  }

  // Check if a product is favorite for a specific user
  async isFavorite(user_id: string, product: string): Promise<string | null> {
    const favorite = await this.favoriteRepository.findOne({
      where: { user_id, product },
    });
    return favorite?.id || null;
  }
}
