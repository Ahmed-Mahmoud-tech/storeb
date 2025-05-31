import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';

import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CODE_RECORDS } from '../code-records';
import { User } from '../model/users.model';

@Injectable()
export class UserService {
  constructor(
    // private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>
  ) {}

  /**
   * Registers a new user.
   * @param createUserDto - The data transfer object containing user registration details.
   * @returns A promise that resolves to a success message.
   */
  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(createUserDto);
    try {
      return await this.userRepository.save(user);
    } catch {
      throw new HttpException(
        CODE_RECORDS.ERROR.SIGNUP_FAILED.toString(),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Finds a user by phone number.
   * @param phone - The phone number to search for.
   * @returns A promise that resolves to the user or null if not found.
   */
  async findUserByPhone(phone: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { phone } });
  }

  /**
   * Fetches all users.
   * @returns A promise that resolves to an array of users.
   */
  async getAllUsers(): Promise<User[]> {
    return await this.userRepository.find();
  }

  /**
   * Fetches a user by ID.
   * @param id - The ID of the user.
   * @returns A promise that resolves to the user or throws an exception if not found.
   */
  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  /**
   * Fetches a user by email.
   * @param email - The email of the user.
   * @returns A promise that resolves to the user or null if not found.
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  /**
   * Updates a user by ID.
   * @param id - The ID of the user.
   * @param updateUserDto - The data to update.
   * @returns A promise that resolves to the updated user.
   */
  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      console.log(id, '4444444444444444', updateUserDto);

      const user = await this.getUserById(id);

      // Apply updates from updateUserDto explicitly to avoid any issues
      if (updateUserDto.name) {
        user.name = updateUserDto.name;
      }
      if (updateUserDto.phone) {
        user.phone = updateUserDto.phone;
      }
      if (updateUserDto.type) {
        user.type = updateUserDto.type;
      }
      if (updateUserDto.email) {
        user.email = updateUserDto.email;
      }
      if (updateUserDto.updated_by) {
        // Add any logic for updated_by if needed
      }

      // Save the updated user
      return await this.userRepository.save(user);
    } catch (error) {
      // Just rethrow the error if it's already a HttpException (like NOT_FOUND)
      if (error instanceof HttpException) {
        throw error;
      }

      // For other errors, wrap them in a generic HttpException
      throw new HttpException(
        'Failed to update user',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Deletes a user by ID.
   * @param id - The ID of the user.
   * @returns A promise that resolves to a success message.
   */
  async deleteUser(id: string): Promise<string> {
    const user = await this.getUserById(id);
    await this.userRepository.remove(user);
    return 'User deleted successfully';
  }
  /**
   * Creates or updates a salesman by phone number.
   * If a user with the given phone exists, updates their role to 'sales'.
   * If not, creates a new user with role 'sales'.
   * @param phone - The phone number of the salesman.
   * @returns The created or updated user.
   */
}
