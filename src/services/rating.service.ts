import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from '../model/rating.model';
import { CreateRatingDto, UpdateRatingDto } from '../dto/rating.dto';

@Injectable()
export class RatingService {
  constructor(
    @InjectRepository(Rating)
    private ratingRepository: Repository<Rating>
  ) {}

  async create(createRatingDto: CreateRatingDto): Promise<Rating> {
    const rating = this.ratingRepository.create(createRatingDto);
    return this.ratingRepository.save(rating);
  }

  async findAll(): Promise<Rating[]> {
    return this.ratingRepository.find({
      relations: ['product'],
    });
  }
  async findByProduct(product_code: string): Promise<Rating[]> {
    return this.ratingRepository.find({
      where: { product_code },
      relations: ['product'],
    });
  }

  async findByStore(store_id: string): Promise<Rating[]> {
    return this.ratingRepository.find({
      where: { store_id },
      relations: ['product'],
    });
  }

  async findByUser(user_id: string): Promise<Rating[]> {
    return this.ratingRepository.find({
      where: { user_id },
      relations: ['product'],
    });
  }

  async findOne(id: string): Promise<Rating> {
    const rating = await this.ratingRepository.findOne({
      where: { id },
      relations: ['product'],
    });
    if (!rating) {
      throw new NotFoundException(`Rating with id ${id} not found`);
    }
    return rating;
  }

  async update(id: string, updateRatingDto: UpdateRatingDto): Promise<Rating> {
    const rating = await this.findOne(id);
    Object.assign(rating, updateRatingDto);
    return this.ratingRepository.save(rating);
  }

  async remove(id: string): Promise<void> {
    const rating = await this.findOne(id);
    await this.ratingRepository.remove(rating);
  }
}
