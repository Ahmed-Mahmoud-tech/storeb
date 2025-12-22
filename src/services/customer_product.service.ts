import { Logger, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerProduct } from '../model/customer_products.model';
import {
  CreateCustomerProductDto,
  UpdateCustomerProductDto,
} from '../dto/customer_product.dto';
import { ProductService } from './product.service';
import { Product } from '../model/product.model';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CustomerProductService {
  private readonly logger = new Logger(CustomerProductService.name);

  constructor(
    @InjectRepository(CustomerProduct)
    private customerProductRepository: Repository<CustomerProduct>,
    private productService: ProductService
  ) {}
  async create(createDto: CreateCustomerProductDto): Promise<CustomerProduct> {
    this.logger.log('Creating customer product');
    // employee field is now required
    const entity = this.customerProductRepository.create({
      id: uuid(),
      phone: createDto.phone,
      countryCode: createDto.countryCode,
      product_code: createDto.product_code,
      employee: createDto.employee,
      branch_id: createDto.branch_id,
    });
    return this.customerProductRepository.save(entity);
  }
  async findAll(
    search?: string,
    searchType?: 'product' | 'phone' | 'employee',
    storeName?: string,
    page: number = 1,
    limit: number = 10,
    countryCode?: string
  ): Promise<{
    data: (CustomerProduct & { productDetails?: Product[] })[];
    total: number;
    page: number;
    limit: number;
  }> {
    this.logger.log('Finding all customer products');
    const queryBuilder = this.customerProductRepository
      .createQueryBuilder('customerProduct')
      .leftJoinAndSelect('customerProduct.employeeUser', 'employee')
      .leftJoinAndSelect('customerProduct.branch', 'branch')
      .leftJoinAndSelect('branch.store', 'store'); // Join with the store table through branch

    // Filter by store name if provided
    if (storeName) {
      queryBuilder.andWhere('store.name LIKE :storeName', {
        storeName: `%${storeName}%`,
      });
    }

    if (search && searchType) {
      switch (searchType) {
        case 'product':
          // Search by both product_code and product_name
          // First, get all products matching the search term (name or code)
          const matchingProducts = await this.productService.findByProductNameOrCode(search);
          const matchingProductCodes = matchingProducts.map((p) => p.product_code);
          
          // Combine with direct product_code search
          const searchPattern = `%${search}%`;
          if (matchingProductCodes.length > 0) {
            queryBuilder.andWhere(
              `(EXISTS (
                SELECT 1 FROM unnest(customerProduct.product_code) AS p 
                WHERE p LIKE :searchPattern
              ) OR EXISTS (
                SELECT 1 FROM unnest(customerProduct.product_code) AS p 
                WHERE p IN (:...productCodes)
              ))`,
              {
                searchPattern,
                productCodes: matchingProductCodes,
              }
            );
          } else {
            // If no matching products by name, just search by code
            queryBuilder.andWhere(
              `EXISTS (
              SELECT 1 FROM unnest(customerProduct.product_code) AS p 
              WHERE p LIKE :searchPattern
            )`,
              {
                searchPattern,
              }
            );
          }
          break;
        case 'phone':
          // Search by phone and optionally filter by country code
          if (countryCode) {
            // If country code is provided, match both country code and phone number
            queryBuilder.andWhere(
              'customerProduct.countryCode = :countryCode',
              {
                countryCode,
              }
            );
            queryBuilder.andWhere('customerProduct.phone LIKE :search', {
              search: `%${search}%`,
            });
          } else {
            // If no country code provided, search by phone number only
            queryBuilder.andWhere('customerProduct.phone LIKE :search', {
              search: `%${search}%`,
            });
          }
          break;
        case 'employee':
          queryBuilder.andWhere('employee.name LIKE :search', {
            search: `%${search}%`,
          });
          break;
      }
    }

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const customerProducts = await queryBuilder.getMany();

    // Collect all product codes from all customer products
    const allProductCodes = customerProducts.reduce((codes, cp) => {
      if (cp.product_code && cp.product_code.length > 0) {
        cp.product_code.forEach((code) => codes.add(code));
      }
      return codes;
    }, new Set<string>());

    // Fetch all product details in a single query
    const productDetails = await this.productService.findByProductCodes([
      ...allProductCodes,
    ]);

    // Create a map of product code to product details for quick lookup
    const productMap = new Map<string, Product>();
    productDetails.forEach((product) => {
      productMap.set(product.product_code, product);
    });

    // Enhance each customer product with detailed product information
    const enhancedCustomerProducts = customerProducts.map((cp) => {
      const productDetailsArr = cp.product_code
        ?.map((code) => productMap.get(code))
        .filter((product): product is Product => !!product); // Only include valid Product objects
      return {
        ...cp,
        productDetails: productDetailsArr,
      };
    });

    return {
      data: enhancedCustomerProducts,
      total,
      page,
      limit,
    };
  }
  async findOne(
    id: string
  ): Promise<CustomerProduct & { productDetails?: Product[] }> {
    this.logger.log(`Finding customer product with id ${id}`);
    const entity = await this.customerProductRepository.findOne({
      where: { id },
      relations: ['employeeUser', 'branch'],
    });

    if (!entity) throw new NotFoundException('CustomerProduct not found');

    // Fetch product details if there are product codes
    if (entity.product_code && entity.product_code.length > 0) {
      const productDetails = await this.productService.findByProductCodes(
        entity.product_code
      );
      return {
        ...entity,
        productDetails,
      };
    }

    return entity;
  }
  async findByPhone(
    phone: string
  ): Promise<CustomerProduct & { productDetails?: Product[] }> {
    this.logger.log(`Finding customer product with phone ${phone}`);
    const entity = await this.customerProductRepository.findOne({
      where: { phone },
      relations: ['employeeUser', 'branch'],
    });
    if (!entity) throw new NotFoundException('CustomerProduct not found');

    // Fetch product details if there are product codes
    if (entity.product_code && entity.product_code.length > 0) {
      const productDetails = await this.productService.findByProductCodes(
        entity.product_code
      );
      return {
        ...entity,
        productDetails,
      };
    }

    return entity;
  }
  async update(
    id: string,
    updateDto: UpdateCustomerProductDto
  ): Promise<CustomerProduct> {
    this.logger.log(`Updating customer product with id ${id}`);
    // employee field is now optional
    const entity = await this.findOne(id);
    // Remove productDetails property before saving as it's not part of the entity
    const { ...entityData } = entity;
    // const { productDetails, ...entityData } = entity;
    Object.assign(entityData, updateDto);
    return this.customerProductRepository.save(entityData);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing customer product with id ${id}`);
    const entity = await this.findOne(id);
    await this.customerProductRepository.remove(entity);
  }
}
