import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import {
  CreateUserDto,
  UpdateUserDto,
  RegisterWithEmailDto,
  LoginWithEmailDto,
} from '../dto/user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CODE_RECORDS } from '../code-records';
import { User } from '../model/users.model';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { EmailService } from './email.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService
  ) {}

  /**
   * Parse phone number into country code and phone number
   * @param phoneNumber Full phone number (with or without country code)
   * @returns Object with countryCode and phone properties
   */
  private parsePhoneNumber(phoneNumber: string): {
    countryCode: string;
    phone: string;
  } {
    if (!phoneNumber) {
      return { countryCode: '+20', phone: '' };
    }

    // If it doesn't start with +, assume it's just the phone number
    if (!phoneNumber.startsWith('+')) {
      return { countryCode: '+20', phone: phoneNumber };
    }

    // Common country code lengths (most are 1-3 digits)
    const countryCodePatterns = [
      { pattern: /^\+1(?!\d{11})/, code: '+1' },
      { pattern: /^\+44/, code: '+44' },
      { pattern: /^\+212/, code: '+212' },
      { pattern: /^\+213/, code: '+213' },
      { pattern: /^\+216/, code: '+216' },
      { pattern: /^\+218/, code: '+218' },
      { pattern: /^\+20/, code: '+20' },
      { pattern: /^\+961/, code: '+961' },
      { pattern: /^\+962/, code: '+962' },
      { pattern: /^\+963/, code: '+963' },
      { pattern: /^\+964/, code: '+964' },
      { pattern: /^\+965/, code: '+965' },
      { pattern: /^\+966/, code: '+966' },
      { pattern: /^\+968/, code: '+968' },
      { pattern: /^\+970/, code: '+970' },
      { pattern: /^\+971/, code: '+971' },
      { pattern: /^\+973/, code: '+973' },
      { pattern: /^\+974/, code: '+974' },
    ];

    // Try to match against known patterns
    for (const { pattern, code } of countryCodePatterns) {
      if (pattern.test(phoneNumber)) {
        return {
          countryCode: code,
          phone: phoneNumber.substring(code.length),
        };
      }
    }

    // Fallback: assume 2-3 digit country code
    const match = phoneNumber.match(/^\+(\d{1,3})(.+)$/);
    if (match) {
      return {
        countryCode: '+' + match[1],
        phone: match[2],
      };
    }

    // Default fallback
    return { countryCode: '+20', phone: phoneNumber.substring(1) };
  }

  /**
   * Registers a new user.
   * @param createUserDto - The data transfer object containing user registration details.
   * @returns A promise that resolves to a success message.
   */
  async createUser(createUserDto: CreateUserDto): Promise<User> {
    this.logger.log(`Creating user with email: ${createUserDto.email}`);

    // Handle phone splitting if needed
    const userData = { ...createUserDto };

    if (userData.phone) {
      // If country_code is also provided, use phone as-is (they're separated)
      if (!userData.country_code) {
        // If only phone is provided, parse it to extract country code
        const { countryCode, phone } = this.parsePhoneNumber(userData.phone);
        userData.phone = phone;
        userData.country_code = countryCode;
      }
    }

    const user = this.userRepository.create(userData);
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
    this.logger.log(`Finding user by phone: ${phone}`);
    return await this.userRepository.findOne({ where: { phone } });
  }

  /**
   * Fetches all users.
   * @returns A promise that resolves to an array of users.
   */
  async getAllUsers(): Promise<User[]> {
    this.logger.log('Fetching all users');
    return await this.userRepository.find();
  }

  /**
   * Fetches a user by ID.
   * @param id - The ID of the user.
   * @returns A promise that resolves to the user or throws an exception if not found.
   */
  async getUserById(id: string): Promise<User> {
    this.logger.log(`Fetching user by id: ${id}`);

    // Validate UUID format
    if (!id || id === 'undefined' || id === 'null') {
      throw new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST);
    }

    // Validate UUID format using regex
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new HttpException('Invalid user ID format', HttpStatus.BAD_REQUEST);
    }

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
    this.logger.log(`Finding user by email: ${email}`);
    return await this.userRepository.findOne({ where: { email } });
  }

  /**
   * Updates a user by ID.
   * @param id - The ID of the user.
   * @param updateUserDto - The data to update.
   * @returns A promise that resolves to the updated user.
   */
  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    this.logger.log(`Updating user with id: ${id}`);
    try {
      console.log(id, '4444444444444444', updateUserDto);

      const user = await this.getUserById(id);

      // Apply updates from updateUserDto explicitly to avoid any issues
      if (updateUserDto.name) {
        user.name = updateUserDto.name;
      }

      // Handle phone update
      if (updateUserDto.phone) {
        // If country_code is also provided, use phone as-is (they're separated)
        if (updateUserDto.country_code) {
          user.phone = updateUserDto.phone;
        } else {
          // If only phone is provided, parse it to extract country code
          const { countryCode, phone } = this.parsePhoneNumber(
            updateUserDto.phone
          );
          user.phone = phone;
          user.country_code = countryCode;
        }
      }

      // Handle country_code update - this overrides any parsed country_code above
      if (updateUserDto.country_code) {
        user.country_code = updateUserDto.country_code;
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
    this.logger.log(`Deleting user with id: ${id}`);
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

  /**
   * Registers a new user with email and password
   * @param registerDto - Registration data
   * @returns Promise that resolves to the created user
   */
  async registerWithEmail(registerDto: RegisterWithEmailDto): Promise<User> {
    this.logger.log(`Registering user with email: ${registerDto.email}`);

    // Check if user already exists
    const existingUser = await this.findUserByEmail(registerDto.email);
    if (existingUser) {
      throw new HttpException(
        'User with this email already exists',
        HttpStatus.CONFLICT
      );
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    // Generate verification token
    const verificationToken = uuidv4();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hours

    // Handle phone splitting if provided
    let phoneData = {
      phone: registerDto.phone,
      country_code: registerDto.country_code,
    };

    if (registerDto.phone && !registerDto.country_code) {
      // Parse phone to extract country code if not provided
      const { countryCode, phone } = this.parsePhoneNumber(registerDto.phone);
      phoneData = { phone, country_code: countryCode };
    }

    // Create user
    const user = this.userRepository.create({
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
      type: registerDto.type,
      phone: phoneData.phone,
      country_code: phoneData.country_code,
      email_verified: false,
      verification_token: verificationToken,
      verification_token_expires: verificationExpires,
    });

    try {
      const savedUser = await this.userRepository.save(user);

      // Send verification email using mock service
      try {
        await this.emailService.sendVerificationEmail(
          savedUser.email,
          verificationToken
        );
        this.logger.log(`Verification email sent to: ${savedUser.email}`);
      } catch (emailError) {
        this.logger.error(
          `Failed to send verification email to ${savedUser.email}:`,
          emailError
        );
        // Don't fail registration if email sending fails
      }

      this.logger.log(`User registered successfully: ${savedUser.email}`);
      return savedUser;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to register user:', errorMessage);
      throw new HttpException(
        'Failed to register user',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Authenticates user with email and password
   * @param loginDto - Login credentials
   * @returns Promise that resolves to the authenticated user
   */
  async loginWithEmail(loginDto: LoginWithEmailDto): Promise<User> {
    this.logger.log(`Login attempt for email: ${loginDto.email}`);

    // Find user by email
    const user = await this.findUserByEmail(loginDto.email);
    if (!user) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    // Check if user has a password (might be Google OAuth user)
    if (!user.password) {
      throw new HttpException(
        'Please use Google login for this account',
        HttpStatus.BAD_REQUEST
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password
    );
    if (!isPasswordValid) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    // Check if email is verified
    // Temporarily disabled for testing
    // if (!user.email_verified) {
    //   throw new HttpException(
    //     'Please verify your email before logging in',
    //     HttpStatus.FORBIDDEN
    //   );
    // }

    this.logger.log(`User logged in successfully: ${user.email}`);
    return user;
  }

  /**
   * Verifies user email with token
   * @param token - Verification token
   * @returns Promise that resolves to success message
   */
  async verifyEmail(token: string): Promise<{ message: string; user: User }> {
    this.logger.log(`Verifying email with token: ${token}`);

    const user = await this.userRepository.findOne({
      where: { verification_token: token },
    });

    if (!user) {
      throw new HttpException(
        'Invalid verification token',
        HttpStatus.BAD_REQUEST
      );
    }

    // Check if token is expired
    if (
      user.verification_token_expires &&
      new Date() > user.verification_token_expires
    ) {
      throw new HttpException(
        'Verification token has expired',
        HttpStatus.BAD_REQUEST
      );
    }

    // Mark email as verified and clear verification token
    user.email_verified = true;
    user.verification_token = null;
    user.verification_token_expires = null;

    await this.userRepository.save(user);

    this.logger.log(`Email verified successfully for user: ${user.email}`);
    return { message: 'Email verified successfully', user };
  }

  /**
   * Initiates forgot password process
   * @param email - User email
   * @returns Promise that resolves to success message
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    this.logger.log(`Forgot password request for email: ${email}`);

    const user = await this.findUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Don't allow password reset for Google OAuth users
    if (!user.password) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour

    user.reset_password_token = resetToken;
    user.reset_password_expires = resetExpires;

    await this.userRepository.save(user);

    // Send reset email
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    this.logger.log(`Password reset email sent to: ${email}`);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  /**
   * Resets user password
   * @param token - Reset token
   * @param newPassword - New password
   * @returns Promise that resolves to success message
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    this.logger.log(`Password reset attempt with token: ${token}`);

    const user = await this.userRepository.findOne({
      where: { reset_password_token: token },
    });

    if (!user) {
      throw new HttpException('Invalid reset token', HttpStatus.BAD_REQUEST);
    }

    // Check if token is expired
    if (
      user.reset_password_expires &&
      new Date() > user.reset_password_expires
    ) {
      throw new HttpException(
        'Reset token has expired',
        HttpStatus.BAD_REQUEST
      );
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.reset_password_token = null;
    user.reset_password_expires = null;

    await this.userRepository.save(user);

    this.logger.log(`Password reset successfully for user: ${user.email}`);
    return { message: 'Password reset successfully' };
  }

  /**
   * Resends verification email
   * @param email - User email
   * @returns Promise that resolves to success message
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    this.logger.log(`Resending verification email to: ${email}`);

    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (user.email_verified) {
      throw new HttpException(
        'Email is already verified',
        HttpStatus.BAD_REQUEST
      );
    }

    // Generate new verification token
    const verificationToken = uuidv4();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hours

    user.verification_token = verificationToken;
    user.verification_token_expires = verificationExpires;

    await this.userRepository.save(user);

    // Send verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken
    );

    this.logger.log(`Verification email resent to: ${email}`);
    return { message: 'Verification email sent successfully' };
  }
}
