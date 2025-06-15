import { Logger, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from '../model/rating.model';
import { CreateRatingDto, UpdateRatingDto } from '../dto/rating.dto';

@Injectable()
export class RatingService {
  private readonly logger = new Logger(RatingService.name);

  constructor(
    @InjectRepository(Rating)
    private ratingRepository: Repository<Rating>
  ) {}

  async create(createRatingDto: CreateRatingDto): Promise<Rating> {
    this.logger.log('Creating rating');
    const rating = this.ratingRepository.create(createRatingDto);
    return this.ratingRepository.save(rating);
  }

  async findAll(): Promise<Rating[]> {
    this.logger.log('Fetching all ratings');
    return this.ratingRepository.find({
      relations: ['product'],
    });
  }
  async findByProduct(product_code: string): Promise<Rating[]> {
    this.logger.log(`Fetching ratings for product: ${product_code}`);
    return this.ratingRepository.find({
      where: { product_code },
      relations: ['product'],
    });
  }

  async findByStore(store_id: string): Promise<Rating[]> {
    this.logger.log(`Fetching ratings for store: ${store_id}`);
    return this.ratingRepository.find({
      where: { store_id },
      relations: ['product'],
    });
  }

  async findByUser(user_id: string): Promise<Rating[]> {
    this.logger.log(`Fetching ratings for user: ${user_id}`);
    return this.ratingRepository.find({
      where: { user_id },
      relations: ['product'],
    });
  }

  async findOne(id: string): Promise<Rating> {
    this.logger.log(`Fetching rating with id: ${id}`);
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
    this.logger.log(`Updating rating with id: ${id}`);
    const rating = await this.findOne(id);
    Object.assign(rating, updateRatingDto);
    return this.ratingRepository.save(rating);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing rating with id: ${id}`);
    const rating = await this.findOne(id);
    await this.ratingRepository.remove(rating);
  }
}
