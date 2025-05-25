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
    const user = await this.getUserById(id);
    Object.assign(user, updateUserDto);
    return await this.userRepository.save(user);
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
  async createOrUpdateSalesmanByPhone(phone: string): Promise<User> {
    let user = await this.userRepository.findOne({ where: { phone } });
    if (user) {
      user.type = 'sales';
      return await this.userRepository.save(user);
    } else {
      // Create a new user with only phone and type sales
      user = this.userRepository.create({
        phone,
        type: 'sales',
        name: phone,
        email: `${phone}@sales.local`,
      });
      return await this.userRepository.save(user);
    }
  }
}
