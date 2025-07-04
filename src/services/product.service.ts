import { Logger, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from '../model/product.model';
import { ProductBranch } from '../model/product_branches.model';
import { CreateProductDto, UpdateProductDto } from '../dto/product.dto';
import { FileUploadService } from './file-upload.service';
import { FavoriteService } from './favorite.service';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductBranch)
    private productBranchRepository: Repository<ProductBranch>,
    private fileUploadService: FileUploadService,
    private favoriteService: FavoriteService
  ) {}

  async createProduct(createProductDto: CreateProductDto): Promise<Product> {
    this.logger.log(`Creating product: ${createProductDto.product_name}`);
    const {
      product_code,
      product_name,
      category,
      price,
      priceBeforeSale,
      isActive,
      newArrival,
      isFeatured,
      tags,
      images,
      details,
      branchIds,
      createdBy,
    } = createProductDto;

    // Create product entity
    const product = new Product();
    product.product_code = product_code;
    product.product_name = product_name;
    product.category = category;
    product.price = price;
    product.price_before_sale = priceBeforeSale;
    product.details = details;
    product.created_by = createdBy;

    // Set status based on isActive
    product.status = isActive ? 'active' : 'inactive';

    // Process tags
    const processedTags: string[] = [];
    if (tags) {
      if (tags.colors?.length) {
        tags.colors.forEach((color) => processedTags.push(`color:${color}`));
      }
      if (tags.sizes?.length) {
        tags.sizes.forEach((size) => processedTags.push(`size:${size}`));
      }
      if (tags.materials?.length) {
        tags.materials.forEach((material) =>
          processedTags.push(`material:${material}`)
        );
      }
      if (newArrival) {
        processedTags.push('new');
      }
      if (isFeatured) {
        processedTags.push('featured');
      }
    }

    product.tags = processedTags.length > 0 ? processedTags : undefined;
    product.images = images || [];

    // Save product to database
    const savedProduct = await this.productRepository.save(product);

    // Create product-branch relationships
    if (branchIds && branchIds.length > 0) {
      await this.createProductBranchRelations(product_code, branchIds);
    }

    return savedProduct;
  }

  async createProductBranchRelations(
    product_code: string,
    branchIds: string[]
  ): Promise<void> {
    // Create product-branch relations
    for (const branchId of branchIds) {
      const productBranch = new ProductBranch();
      productBranch.product_code = product_code;
      productBranch.branch_id = branchId;
      await this.productBranchRepository.save(productBranch);
    }
  }
  async findAll(
    limit: number = 10,
    page: number = 1,
    status?: string | string[],
    category?: string,
    tag?: string | string[],
    branchId?: string,
    storeId?: string,
    search?: string,
    storeName?: string,
    createdBy?: boolean,
    sale?: boolean,
    userId?: string
  ): Promise<{ products: any[]; total: number; page: number; limit: number }> {
    this.logger.log('Fetching all products');
    let query = this.productRepository.createQueryBuilder('product');

    if (status) {
      if (Array.isArray(status)) {
        if (status.length > 0) {
          query = query.andWhere('product.status IN (:...statuses)', {
            statuses: status,
          });
          this.logger.log('Filtering by multiple statuses:', status);
        }
      } else {
        query = query.andWhere('product.status = :status', { status });
        this.logger.log('Filtering by single status:', status);
      }
    }

    if (category) {
      query = query.andWhere('product.category LIKE :category', {
        category: `%${category}%`,
      });
    }
    if (tag) {
      // Support multiple tags (AND logic: product must have all tags)
      let tagsToFilter: string[];

      // Convert to array if it's a string, or use as-is if already an array
      if (Array.isArray(tag)) {
        tagsToFilter = tag;
        this.logger.log('Tags received as array:', tagsToFilter);
      } else {
        tagsToFilter = [tag];
        this.logger.log(
          'Tags received as string, converted to array:',
          tagsToFilter
        );
      }

      // Apply each tag as a separate WHERE condition (AND logic)
      tagsToFilter.forEach((t, idx) => {
        this.logger.log(`Adding filter for tag${idx}:`, t);
        // Use parameter binding with explicit casting
        query = query.andWhere(`cast(:tag${idx} as text) = ANY(product.tags)`, {
          [`tag${idx}`]: t,
        });
      });
    }

    // Filter by branchId if provided
    if (branchId) {
      query = query
        .innerJoin(
          'product_branches',
          'pb',
          'pb.product_code = product.product_code'
        )
        .andWhere('pb.branch_id = :branchId', { branchId });
    }

    // Filter by storeId or storeName if provided
    if (storeId || storeName) {
      if (!branchId) {
        query = query.innerJoin(
          'product_branches',
          'pb',
          'pb.product_code = product.product_code'
        );
      }
      query = query.innerJoin('branches', 'b', 'b.id = pb.branch_id');
      if (storeId) {
        query = query.andWhere('b.store_id = :storeId', { storeId });
      }
      if (storeName) {
        query = query
          .innerJoin('store', 's', 's.id = b.store_id')
          .andWhere('s.name ILIKE :storeName', { storeName: `%${storeName}%` });
      }
    }

    // Add search by productCode or productName
    if (search) {
      query = query.andWhere(
        '(product.product_code ILIKE :search OR product.product_name ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (createdBy) {
      query = query.leftJoinAndSelect('product.createdByUser', 'createdByUser');
    }

    // Add sale filter
    if (sale) {
      query = query.andWhere('product.price_before_sale IS NOT NULL');
    }

    const total = await query.getCount(); // Calculate offset based on page number
    const offset = (page - 1) * limit;
    const products = await query
      .orderBy('product.created_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();
    this.logger.log(userId, 'userId in product service');

    // Add isFavorite flag if userId is provided
    if (userId) {
      // Process each product to check if it's a favorite for the user
      const productsWithFavoriteStatus = await Promise.all(
        products.map(async (product) => {
          const isFavorite = await this.favoriteService.isFavorite(
            userId,
            product.product_code
          );
          return { ...product, isFavorite };
        })
      );
      return { products: productsWithFavoriteStatus, total, page, limit };
    }

    return { products, total, page, limit };
  }

  async findByBranch(
    branchId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Product[]> {
    this.logger.log('Fetching products by branch');
    const productBranches = await this.productBranchRepository.find({
      where: { branch_id: branchId },
      take: limit,
      skip: offset,
    });

    const product_codes = productBranches.map((pb) => pb.product_code);

    if (product_codes.length === 0) {
      return [];
    }

    return this.productRepository.find({
      where: { product_code: In(product_codes) },
      order: { created_at: 'DESC' },
    });
  }
  async findOne(product_code: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { product_code: product_code },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with code ${product_code} not found`
      );
    }

    return product;
  }

  // New method to find multiple products by their codes
  async findByProductCodes(product_codes: string[]): Promise<Product[]> {
    if (!product_codes || product_codes.length === 0) {
      return [];
    }

    return this.productRepository.find({
      where: { product_code: In(product_codes) },
    });
  }

  async findProductBranches(product_code: string): Promise<string[]> {
    const productBranches = await this.productBranchRepository.find({
      where: { product_code: product_code },
    });

    return productBranches.map((pb) => pb.branch_id);
  }

  async update(
    product_code: string,
    updateProductDto: UpdateProductDto
  ): Promise<Product> {
    this.logger.log(`Updating product: ${product_code}`);
    const product = await this.findOne(product_code);

    // Update product properties
    if (updateProductDto.product_name) {
      product.product_name = updateProductDto.product_name;
    }

    if (updateProductDto.category) {
      product.category = updateProductDto.category;
    }

    if (updateProductDto.price !== undefined) {
      product.price = updateProductDto.price;
    }

    if (updateProductDto.priceBeforeSale !== undefined) {
      product.price_before_sale = updateProductDto.priceBeforeSale;
    }

    if (updateProductDto.details) {
      product.details = updateProductDto.details;
    }

    if (updateProductDto.isActive !== undefined) {
      product.status = updateProductDto.isActive ? 'active' : 'inactive';
    }

    // Update tags
    if (
      updateProductDto.tags ||
      updateProductDto.newArrival !== undefined ||
      updateProductDto.isFeatured !== undefined
    ) {
      // Start with existing tags that aren't related to colors, sizes, materials, new or featured
      let currentTags = product.tags || [];
      currentTags = currentTags.filter(
        (tag) =>
          !tag.startsWith('color:') &&
          !tag.startsWith('size:') &&
          !tag.startsWith('material:') &&
          tag !== 'new' &&
          tag !== 'featured'
      );

      // Add updated tags
      const tags = updateProductDto.tags;
      if (tags) {
        if (tags.colors?.length) {
          tags.colors.forEach((color) => currentTags.push(`color:${color}`));
        }
        if (tags.sizes?.length) {
          tags.sizes.forEach((size) => currentTags.push(`size:${size}`));
        }
        if (tags.materials?.length) {
          tags.materials.forEach((material) =>
            currentTags.push(`material:${material}`)
          );
        }
      }

      if (updateProductDto.newArrival) {
        currentTags.push('new');
      }

      if (updateProductDto.isFeatured) {
        currentTags.push('featured');
      }

      product.tags = currentTags;
    }

    // Update images
    if (updateProductDto.images) {
      product.images = updateProductDto.images;
    }

    // Update updated_by
    if (updateProductDto.updatedBy) {
      product.updated_by = updateProductDto.updatedBy;
    }

    // Update branches if provided
    if (updateProductDto.branchIds && updateProductDto.branchIds.length > 0) {
      // Remove existing relations first
      await this.productBranchRepository.delete({ product_code: product_code });
      // Create new relations
      await this.createProductBranchRelations(
        product_code,
        updateProductDto.branchIds
      );
    }

    // Save updated product
    return this.productRepository.save(product);
  }
  async remove(product_code: string): Promise<void> {
    const product = await this.findOne(product_code);
    this.logger.log(`Removing product: ${product_code}`, product);

    // First delete any favorites referencing this product
    try {
      // Using raw query to delete favorites by product code
      const favoriteRepo = this.productRepository.manager;
      await favoriteRepo.query('DELETE FROM favorite WHERE product = $1', [
        product_code,
      ]);
    } catch (error) {
      this.logger.error('Error deleting favorites:', error);
      // Continue with deletion even if this fails as the main delete might still work
    }

    // Then delete the product-branch relationships
    await this.productBranchRepository.delete({ product_code: product_code });

    // Finally delete the product
    await this.productRepository.remove(product);
  }

  // Helper method for checking if a product exists in DB
  async productExists(product_code: string): Promise<boolean> {
    const count = await this.productRepository.count({
      where: { product_code: product_code },
    });
    return count > 0;
  }
}
