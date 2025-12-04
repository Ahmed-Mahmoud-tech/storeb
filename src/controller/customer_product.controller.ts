import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { CustomerProductService } from '../services/customer_product.service';
import {
  CreateCustomerProductDto,
  UpdateCustomerProductDto,
} from '../dto/customer_product.dto';
import { CustomerProduct } from '../model/customer_products.model';

@Controller('customer-products')
export class CustomerProductController {
  constructor(
    private readonly customerProductService: CustomerProductService
  ) {}

  @Post()
  async create(
    @Body() createDto: CreateCustomerProductDto
  ): Promise<CustomerProduct> {
    // Ensure employee is set (user id)
    return this.customerProductService.create(createDto);
  }

  /**
   * Get all customer products with optional search capabilities
   * GET /customer-products?search=value&searchType=product|phone|employee&storeName=value
   *
   * searchType options:
   * - product: searches in product codes
   * - phone: searches in phone numbers
   * - employee: searches in employee names
   *
   * storeName: filters products by store name (returns only products from branches of that store)
   */
  @Get()
  async findAll(
    @Query('search') rawSearch?: string,
    @Query('searchType') searchType?: 'product' | 'phone' | 'employee',
    @Query('storeName') storeName?: string,
    @Query('countryCode') countryCode?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10'
  ): Promise<{
    data: CustomerProduct[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Handle the case where "+" in URL query is converted to space
    let search = rawSearch;
    if (search) {
      // If search starts with a space (which could be a "+" from URL)
      // and is followed by a number, assume it was "+number"
      if (search.startsWith(' ') && /^\s+\d/.test(search)) {
        search = '+' + search.trim();
      } else {
        search = decodeURIComponent(search);
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    return this.customerProductService.findAll(
      search,
      searchType,
      storeName,
      pageNum,
      limitNum,
      countryCode
    );
  }
  /**
   * Get a customer product by ID
   * GET /customer-products/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<CustomerProduct> {
    return this.customerProductService.findOne(id);
  }

  /**
   * Get a customer product by phone number
   * GET /customer-products/phone/:phone
   */
  @Get('phone/:phone')
  async findByPhone(@Param('phone') phone: string): Promise<CustomerProduct> {
    return this.customerProductService.findByPhone(phone);
  }

  /**
   * Update a customer product by ID
   * PUT /customer-products/:id
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateCustomerProductDto
  ): Promise<CustomerProduct> {
    // Ensure employee is set if provided
    return this.customerProductService.update(id, updateDto);
  }

  /**
   * Delete a customer product by ID
   * DELETE /customer-products/:id
   */
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.customerProductService.remove(id);
    return {
      message: `CustomerProduct with id ${id} deleted successfully`,
    };
  }
}
