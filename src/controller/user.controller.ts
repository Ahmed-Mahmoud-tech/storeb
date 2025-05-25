import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { CreateUserDto, UpdateUserDto } from 'src/dto/user.dto';
import { User } from 'src/model/users.model';
import { UserService } from 'src/services/user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto): Promise<User> {
    return await this.userService.createUser(createUserDto);
  }

  @Get()
  async getAllUsers(): Promise<User[]> {
    return await this.userService.getAllUsers();
  }

  @Get(':id')
  async getUserById(@Param('id') id: string): Promise<User> {
    return await this.userService.getUserById(id);
  }

  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<User> {
    return await this.userService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string): Promise<string> {
    return await this.userService.deleteUser(id);
  }

  /**
   * Endpoint to create or update a salesman by phone number.
   * Payload: { phone: string }
   * If a user with the given phone exists, updates their role to 'sales'.
   * If not, creates a new user with role 'sales'.
   */
  @Post('salesman')
  async createOrUpdateSalesman(@Body('phone') phone: string): Promise<User> {
    return await this.userService.createOrUpdateSalesmanByPhone(phone);
  }
}
