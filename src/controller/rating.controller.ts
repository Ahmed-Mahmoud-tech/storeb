import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { RatingService } from '../services/rating.service';
import { CreateRatingDto, UpdateRatingDto } from '../dto/rating.dto';

@Controller('ratings')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Post()
  create(@Body() createRatingDto: CreateRatingDto) {
    return this.ratingService.create(createRatingDto);
  }
  @Get()
  findAll() {
    return this.ratingService.findAll();
  }
  @Get('product/:productCode')
  findByProduct(@Param('productCode') productCode: string) {
    return this.ratingService.findByProduct(productCode);
  }

  @Get('store/:storeId')
  findByStore(@Param('storeId') storeId: string) {
    return this.ratingService.findByStore(storeId);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.ratingService.findByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ratingService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRatingDto: UpdateRatingDto) {
    return this.ratingService.update(id, updateRatingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ratingService.remove(id);
  }
}
