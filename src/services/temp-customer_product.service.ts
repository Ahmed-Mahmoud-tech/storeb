import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerProduct } from '../model/customer_products.model';
import {
  CreateCustomerProductDto,
  UpdateCustomerProductDto,
} from '../dto/customer_product.dto';
import { ProductService } from './product.service';
import { Product } from '../model/product.model';

// Define a type that includes the productDetails
type CustomerProductWithDetails = CustomerProduct & { productDetails?: Product[] };

@Injectable()
export class CustomerProductService {
  constructor(
    @InjectRepository(CustomerProduct)
    private customerProductRepository: Repository<CustomerProduct>,
    private productService: ProductService
  ) {}

  async create(createDto: CreateCustomerProductDto): Promise<CustomerProduct> {
    // employee field is now required
    const entity = this.customerProductRepository.create({
      phone: createDto.phone,
      product_code: createDto.product_code,
      employee: createDto.employee,
      branch_id: createDto.branch_id,
    });
    return this.customerProductRepository.save(entity);
  }

  async findAll(
    search?: string,
    searchType?: 'product' | 'phone' | 'employee',
    storeName?: string
  ): Promise<CustomerProductWithDetails[]> {
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
          // Search by product_code as it's stored in customer_products
          // Use array containment operator with ANY to search within array values
          queryBuilder.andWhere(
            `EXISTS (
            SELECT 1 FROM unnest(customerProduct.product_code) AS p 
            WHERE p LIKE :searchPattern
          )`,
            {
              searchPattern: `%${search}%`,
            }
          );
          break;
        case 'phone':
          queryBuilder.andWhere('customerProduct.phone LIKE :search', {
            search: `%${search}%`,
          });
          break;
        case 'employee':
          queryBuilder.andWhere('employee.name LIKE :search', {
            search: `%${search}%`,
          });
          break;
      }
    }
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
      const productDetails = cp.product_code?.map(
        (code) => productMap.get(code) || { product_code: code } as Product
      );
      return {
        ...cp,
        productDetails,
      };
    });

    return enhancedCustomerProducts;
  }

  async findOne(id: string): Promise<CustomerProductWithDetails> {
    const entity = await this.customerProductRepository.findOne({
      where: { id },
      relations: ['employeeUser', 'branch', 'branch.store'],
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

  async findByPhone(phone: string): Promise<CustomerProductWithDetails> {
    const entity = await this.customerProductRepository.findOne({
      where: { phone },
      relations: ['employeeUser', 'branch', 'branch.store'],
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
    // employee field is now optional
    const entity = await this.findOne(id);
    // Remove productDetails property before saving as it's not part of the entity
    const { productDetails, ...entityData } = entity;
    Object.assign(entityData, updateDto);
    return this.customerProductRepository.save(entityData);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    const { productDetails, ...entityData } = entity; // Remove productDetails before removing
    await this.customerProductRepository.remove(entityData);
  }
}
