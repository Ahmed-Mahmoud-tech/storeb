import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from '../model/favorite.model';
import { CreateFavoriteDto, UpdateFavoriteDto } from '../dto/favorite.dto';
import { ProductService } from './product.service';

@Injectable()
export class FavoriteService {
  private readonly logger = new Logger(FavoriteService.name);

  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
    @Inject(forwardRef(() => ProductService))
    private productService: ProductService // Inject ProductService with forwardRef
  ) {}

  async create(createFavoriteDto: CreateFavoriteDto): Promise<Favorite> {
    this.logger.log(`Creating favorite: ${JSON.stringify(createFavoriteDto)}`);
    const favorite = this.favoriteRepository.create(createFavoriteDto);
    return await this.favoriteRepository.save(favorite);
  }

  async findAll(): Promise<Favorite[]> {
    this.logger.log('Fetching all favorites');
    return await this.favoriteRepository.find();
  }

  async findOne(id: string): Promise<Favorite> {
    this.logger.log(`Fetching favorite with id: ${id}`);
    const favorite = await this.favoriteRepository.findOne({ where: { id } });
    if (!favorite) throw new NotFoundException('Favorite not found');
    return favorite;
  }

  async update(
    id: string,
    updateFavoriteDto: UpdateFavoriteDto
  ): Promise<Favorite> {
    this.logger.log(`Updating favorite with id: ${id}`);
    const favorite = await this.findOne(id);
    Object.assign(favorite, updateFavoriteDto);
    return await this.favoriteRepository.save(favorite);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing favorite with id: ${id}`);
    const favorite = await this.findOne(id);
    await this.favoriteRepository.remove(favorite);
  }

  async removeByUserAndProduct(
    user_id: string,
    product: string
  ): Promise<void> {
    this.logger.log(
      `Removing favorite for user ${user_id} and product ${product}`
    );
    const favorite = await this.favoriteRepository.findOne({
      where: { user_id, product },
    });
    if (!favorite) throw new NotFoundException('Favorite not found');
    await this.favoriteRepository.remove(favorite);
  }

  // Get user's favorites by user_id
  async findByUserId(user_id: string): Promise<Favorite[]> {
    this.logger.log(`Fetching favorites for user_id: ${user_id}`);
    return await this.favoriteRepository.find({
      where: { user_id },
    });
  }

  // Check if a product is favorite for a specific user
  async isFavorite(user_id: string, product: string): Promise<string | null> {
    this.logger.log(
      `Checking if product ${product} is favorite for user ${user_id}`
    );
    const favorite = await this.favoriteRepository.findOne({
      where: { user_id, product },
    });
    return favorite?.id || null;
  }

  // Get products favorited by user with pagination
  async findProductsByUserId(
    user_id: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ products: any[]; total: number; page: number; limit: number }> {
    this.logger.log(
      `Fetching products for user_id: ${user_id}, page: ${page}, limit: ${limit}`
    );
    const skip = (page - 1) * limit;

    // Find all favorites for the user
    const favorites = await this.favoriteRepository.find({
      where: { user_id },
      skip,
      take: limit,
    });

    // Get total count of favorites for pagination
    const total = await this.favoriteRepository.count({
      where: { user_id },
    });

    // Fetch full product details for each favorited product with favorite ID
    const products = await Promise.all(
      favorites.map(async (favorite) => {
        const product = await this.productService.findOne(favorite.product);
        // Add the favorite ID to the product data
        return {
          ...product,
          isFavorite: favorite.id,
        };
      })
    );

    return {
      products,
      total,
      page,
      limit,
    };
  }
}
