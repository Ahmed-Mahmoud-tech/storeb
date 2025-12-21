import { Logger, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../model/employees.model';
import { EmployeeBranch } from '../model/employee_branches.model';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../dto/employee.dto';
import { User } from '../model/users.model';
import { Branch } from '../model/branches.model';
import { Store } from '../model/store.model';
import { v4 as uuid } from 'uuid';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(EmployeeBranch)
    private employeeBranchRepository: Repository<EmployeeBranch>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>
  ) {}

  /**
   * Create a new employee relationship
   * @param createEmployeeDto - Data for creating a new employee relationship
   */ async createEmployee(
    createEmployeeDto: CreateEmployeeDto
  ): Promise<Employee> {
    this.logger.log(
      `Creating employee for user: ${
        createEmployeeDto.to_user_id || createEmployeeDto.phone
      }`
    );
    this.logger.log(`Payload received: ${JSON.stringify(createEmployeeDto)}`);

    // Check if phone exists but to_user_id doesn't - check if user exists
    let user: User | undefined;
    if (createEmployeeDto.phone && !createEmployeeDto.to_user_id) {
      this.logger.log(
        `Looking for user with phone: ${createEmployeeDto.phone}, country_code: ${createEmployeeDto.country_code}`
      );
      // Try to find an existing user with this phone number and country code
      const existingUser = await this.userRepository.findOne({
        where: {
          phone: createEmployeeDto.phone,
          country_code: createEmployeeDto.country_code,
        },
      });

      if (existingUser) {
        this.logger.log(
          `Found employee user: ID=${existingUser.id}, phone=${existingUser.phone}, country_code=${existingUser.country_code}, name=${existingUser.name}, current type=${existingUser.type}`
        );
        this.logger.log(
          `Owner (from_user_id) is: ${createEmployeeDto.from_user_id}`
        );
        // Use existing user if found
        createEmployeeDto.to_user_id = existingUser.id;
        user = existingUser;
      } else {
        // No user found with this phone number and country code, return an error
        throw new NotFoundException(
          `No user found with phone number ${createEmployeeDto.country_code}${createEmployeeDto.phone}`
        );
      }
    } else if (createEmployeeDto.to_user_id) {
      // If to_user_id is provided, fetch the user for phone/role
      user = await this.userRepository.findOne({
        where: { id: createEmployeeDto.to_user_id },
      });
      if (user) {
        this.logger.log(
          `Found user by to_user_id: ID=${user.id}, phone=${user.phone}, name=${user.name}, current type=${user.type}`
        );
      }
    }

    // If user found and role is provided in DTO, update user type with DTO role
    if (user && createEmployeeDto.role) {
      this.logger.log(
        `UPDATING USER TYPE: User ID=${user.id}, phone=${user.phone}, name=${user.name}`
      );
      this.logger.log(
        `Changing type from "${user.type}" to "${createEmployeeDto.role}"`
      );
      this.logger.log(
        `This should be the EMPLOYEE (phone owner), NOT the owner (from_user_id: ${createEmployeeDto.from_user_id})`
      );

      user.type = createEmployeeDto.role;
      await this.userRepository.save(user);

      this.logger.log(
        `Successfully updated user type to "${user.type}" for user ID: ${user.id}`
      );
    }

    // Extract branches array from DTO before creating employee
    const { branches, ...employeeData } = createEmployeeDto;

    // Create and save employee record
    const employee = this.employeeRepository.create({
      id: uuid(),
      ...employeeData,
    });
    const savedEmployee = await this.employeeRepository.save(employee);

    // Create employee-branch relationships if branches are provided
    if (branches && branches.length > 0) {
      await this.createEmployeeBranchRelations(savedEmployee.id, branches);
    }

    return savedEmployee;
  }

  /**
   * Create employee-branch relationships
   * @param employeeId - Employee ID
   * @param branchIds - Array of branch IDs
   */
  async createEmployeeBranchRelations(
    employeeId: string,
    branchIds: string[]
  ): Promise<void> {
    // Create employee-branch relations
    for (const branchId of branchIds) {
      try {
        const employeeBranch = new EmployeeBranch();
        employeeBranch.employee_id = employeeId;
        employeeBranch.branch_id = branchId;
        this.logger.log(
          `Attempting to save employeeBranch: ${JSON.stringify(employeeBranch)}`
        );

        const saveResult =
          await this.employeeBranchRepository.save(employeeBranch);
        this.logger.log(
          `Saved employeeBranch result: ${JSON.stringify(saveResult)}`
        );
        if (!saveResult) {
          this.logger.error(
            `Save did not return a valid result for employeeBranch: ${JSON.stringify(employeeBranch)}`
          );
        }
      } catch (error) {
        this.logger.error(
          `Error creating employee-branch relation for employee ID ${employeeId} and branch ID ${branchId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
          error instanceof Error ? error.stack : undefined
        );
      }
    }
  }

  /**
   * Find all employees
   */
  async findAllEmployees(): Promise<Employee[]> {
    this.logger.log('Fetching all employees');
    return await this.employeeRepository.find();
  }

  /**
   * Find an employee by ID
   * @param id - Employee ID
   */
  async findEmployeeById(id: string): Promise<Employee> {
    this.logger.log(`Fetching employee by id: ${id}`);
    const employee = await this.employeeRepository.findOne({ where: { id } });
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    return employee;
  }

  /**
   * Find employees by from_user_id (employers)
   * @param fromUserId - User ID who is the employer
   */
  async findEmployeesByFromUserId(fromUserId: string): Promise<Employee[]> {
    return await this.employeeRepository.find({
      where: { from_user_id: fromUserId },
    });
  }

  /**
   * Find employees by to_user_id (employees)
   * @param toUserId - User ID who is the employee
   */
  async findEmployeesByToUserId(toUserId: string): Promise<Employee[]> {
    return await this.employeeRepository.find({
      where: { to_user_id: toUserId },
    });
  }

  /**
   * Find employees by status
   * @param status - Status to filter by
   */ async findEmployeesByStatus(status: string): Promise<Employee[]> {
    return await this.employeeRepository.find({
      where: { status },
    });
  }

  /**
   * Update an employee relationship
   * @param id - Employee ID
   * @param updateEmployeeDto - Data to update
   */
  async updateEmployee(
    id: string,
    updateEmployeeDto: UpdateEmployeeDto
  ): Promise<Employee> {
    this.logger.log(`Updating employee with id: ${id}`);
    const employee = await this.findEmployeeById(id);

    // Extract branches from DTO
    const { branches, ...employeeData } = updateEmployeeDto;

    // Update the employee with the new data
    Object.assign(employee, employeeData);

    // Save updated employee data
    const updatedEmployee = await this.employeeRepository.save(employee);

    // Update branch associations if provided
    if (branches && branches.length > 0) {
      // Remove existing branch associations
      await this.employeeBranchRepository.delete({ employee_id: id });

      // Create new branch associations
      await this.createEmployeeBranchRelations(id, branches);
    }

    return updatedEmployee;
  }

  /**
   * Find employee branches
   * @param employeeId - Employee ID
   */
  async findEmployeeBranches(employeeId: string): Promise<string[]> {
    const employeeBranches = await this.employeeBranchRepository.find({
      where: { employee_id: employeeId },
    });

    return employeeBranches.map((eb) => eb.branch_id);
  }

  /**
   * Find branches assigned to a user by their user ID (to_user_id)
   * @param userId - User ID (to_user_id)
   */
  async findBranchesByUserId(userId: string): Promise<string[]> {
    // First find the employee records where this user is the employee (to_user_id)
    const employees = await this.employeeRepository.find({
      where: { to_user_id: userId },
    });

    // If no employee records found, return empty array
    if (!employees || employees.length === 0) {
      return [];
    }

    // Get all branch IDs for all employee records of this user
    const allBranchIds: string[] = [];
    for (const employee of employees) {
      const branchIds = await this.findEmployeeBranches(employee.id);
      allBranchIds.push(...branchIds);
    }

    // Return unique branch IDs
    return [...new Set(allBranchIds)];
  }

  /**
   * Find an employee by ID, including their branch assignments
   * @param id - Employee ID
   */
  async findEmployeeWithBranches(
    id: string
  ): Promise<Employee & { branchIds: string[] }> {
    const employee = await this.findEmployeeById(id);
    const branchIds = await this.findEmployeeBranches(id);

    return {
      ...employee,
      branchIds,
    };
  }

  /**
   * Find employees by from_user_id (employers) and include their branch assignments
   * @param fromUserId - User ID who is the employer
   */
  async findEmployeesWithBranchesByFromUserId(
    fromUserId: string
  ): Promise<(Employee & { branchIds: string[] })[]> {
    const employees = await this.employeeRepository.find({
      where: { from_user_id: fromUserId },
    });
    const result = await Promise.all(
      employees.map(async (employee) => {
        const branchIds = await this.findEmployeeBranches(employee.id);
        return { ...employee, branchIds };
      })
    );
    return result;
  }

  /**
   * Find employees by from_user_id (employers) and include their branch names
   * @param fromUserId - User ID who is the employer
   */
  async findEmployeesWithBranchNamesByFromUserId(
    fromUserId: string
  ): Promise<(Employee & { branches: { id: string; name: string }[] })[]> {
    const employees = await this.employeeRepository.find({
      where: { from_user_id: fromUserId },
    });
    return Promise.all(
      employees.map(async (employee) => {
        const employeeBranches = await this.employeeBranchRepository.find({
          where: { employee_id: employee.id },
        });
        const branchIds = employeeBranches.map((eb) => eb.branch_id);
        let branches: { id: string; name: string }[] = [];
        if (branchIds.length > 0) {
          const foundBranches =
            await this.branchRepository.findByIds(branchIds);
          branches = foundBranches.map((b) => ({ id: b.id, name: b.name }));
        }
        return { ...employee, branches };
      })
    );
  }

  /**
   * Find employees by from_user_id (employers) and include their branch names and user info
   * @param fromUserId - User ID who is the employer
   * @param options - Pagination and search options
   */
  async findEmployeesWithBranchNamesAndUserInfoByFromUserId(options: {
    fromUserId?: string;
    toUserId?: string;
    status?: string | string[];
    page?: number;
    limit?: number;
    search?: string;
    phone?: string;
    countryCode?: string;
  }): Promise<{
    data: (Employee & {
      branches: { id: string; name: string }[];
      phone?: string;
      role?: string;
      name?: string;
      country_code?: string;
      fromUser?: User | null;
      toUser?: User | null;
      store?: Store | null;
    })[];
    total: number;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 10;

    // Get phone and country code from options
    const phone =
      options?.phone && options.phone.trim() !== ''
        ? options.phone.trim()
        : undefined;
    const countryCode =
      options?.countryCode && options.countryCode.trim() !== ''
        ? options.countryCode.trim()
        : undefined;

    // For backwards compatibility, also support the old search parameter
    const rawSearch = options?.search;
    let search: string | undefined;

    if (rawSearch) {
      // If search starts with a space (which could be a "+" from URL)
      // and is followed by a number, assume it was "+number"
      if (rawSearch.startsWith(' ') && /^\s+\d/.test(rawSearch)) {
        search = '+' + rawSearch.trim();
      } else {
        search = decodeURIComponent(rawSearch);
      }
    }

    // Log search parameters
    if (phone || countryCode) {
      this.logger.log(
        `Searching with phone: "${phone}", countryCode: "${countryCode}"`
      );
    } else if (search) {
      this.logger.log(`Searching with term: ${search}`);
    }

    const fromUserId = options?.fromUserId;
    const toUserId = options?.toUserId;
    const status = options?.status;

    // Build query with optional search and pagination
    const qb = this.employeeRepository.createQueryBuilder('employee');
    if (fromUserId) {
      qb.andWhere('employee.from_user_id = :fromUserId', { fromUserId });
    }
    if (toUserId) {
      qb.andWhere('employee.to_user_id = :to_user_id', {
        to_user_id: toUserId,
      });
    }
    if (status) {
      if (Array.isArray(status)) {
        qb.andWhere('employee.status IN (:...status)', { status });
      } else {
        qb.andWhere('employee.status = :status', { status });
      }
    }

    // Add search conditions based on phone and countryCode
    if (phone || countryCode) {
      this.logger.log(
        `Adding user join with phone: "${phone}", countryCode: "${countryCode}"`
      );
      // Use INNER JOIN instead of LEFT JOIN to ensure we only get employees with valid user references
      qb.innerJoin('user', 'toUser', 'employee.to_user_id = toUser.id');

      if (phone && countryCode) {
        // If both provided, match both (AND)
        this.logger.log(
          `Filtering by phone AND countryCode - phone pattern: %${phone}%`
        );
        // Ensure we're not filtering out NULL phones
        const phoneCondition =
          'toUser.phone IS NOT NULL AND toUser.phone ILIKE :phone';
        qb.andWhere(`(${phoneCondition})`, { phone: `%${phone}%` });
        qb.andWhere('toUser.country_code = :countryCode', {
          countryCode: countryCode,
        });
      } else if (phone) {
        // If only phone provided, search by phone number
        this.logger.log(`Filtering by phone only - pattern: %${phone}%`);
        // Ensure we're not filtering out NULL phones
        const phoneCondition =
          'toUser.phone IS NOT NULL AND toUser.phone ILIKE :phone';
        qb.andWhere(`(${phoneCondition})`, { phone: `%${phone}%` });
      } else if (countryCode) {
        // If only country code provided, search by country code
        this.logger.log(`Filtering by countryCode only: ${countryCode}`);
        qb.andWhere('toUser.country_code = :countryCode', {
          countryCode: countryCode,
        });
      }
    } else if (search) {
      // Old search parameter support (backwards compatibility)
      qb.leftJoin('user', 'toUser', 'employee.to_user_id = toUser.id');

      // Build search conditions for phone, country_code, and name
      qb.andWhere(
        '(toUser.name ILIKE :search OR toUser.phone ILIKE :search OR toUser.country_code ILIKE :search)',
        {
          search: `%${search}%`,
        }
      );
    }

    // Get total count before pagination
    const total = await qb.getCount();
    this.logger.log(`Query count result: ${total}`);
    qb.skip((page - 1) * limit).take(limit);
    const employees = await qb.getMany();

    const data = await Promise.all(
      employees.map(async (employee) => {
        const employeeBranches = await this.employeeBranchRepository.find({
          where: { employee_id: employee.id },
        });
        const branchIds = employeeBranches.map((eb) => eb.branch_id);
        let branches: { id: string; name: string }[] = [];
        if (branchIds.length > 0) {
          const foundBranches =
            await this.branchRepository.findByIds(branchIds);
          branches = foundBranches.map((b) => ({ id: b.id, name: b.name }));
        }
        let phone: string | undefined = undefined;
        let role: string | undefined = undefined;
        let name: string | undefined = undefined;
        let countryCode: string | undefined = undefined;
        let fromUser: User | null = null;
        let toUser: User | null = null;
        let store: Store | null = null;
        if (employee.from_user_id) {
          fromUser = await this.userRepository.findOne({
            where: { id: employee.from_user_id },
          });
        }
        if (employee.to_user_id) {
          toUser = await this.userRepository.findOne({
            where: { id: employee.to_user_id },
          });
          const user = toUser;
          if (user) {
            phone = user.phone;
            role = user.type;
            name = user.name;
            countryCode = user.country_code;
          }
        }
        if (branches.length > 0) {
          // Get the first branch's store_id and fetch the store
          const firstBranchId = branches[0].id;
          const branch = await this.branchRepository.findOne({
            where: { id: firstBranchId },
          });
          if (branch && branch.store_id) {
            store = await this.employeeRepository.manager
              .getRepository(Store)
              .findOne({ where: { id: branch.store_id } });
          }
        }
        return {
          ...employee,
          branches,
          phone,
          role,
          name,
          country_code: countryCode,
          fromUser,
          toUser,
          store,
        };
      })
    );

    return { data, total };
  }

  /**
   * Delete an employee relationship
   * @param id - Employee ID
   */
  async deleteEmployee(id: string): Promise<void> {
    // First check if employee exists
    await this.findEmployeeById(id);

    // Delete all branch associations first
    await this.employeeBranchRepository.delete({ employee_id: id });

    // Then delete the employee record
    const result = await this.employeeRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
  }

  /**
   * Check if a user is staff (manager, sales person) of a specific store
   * @param userId - The user ID to check
   * @param storeId - The store ID to check against
   * @returns true if user is staff of the store, false otherwise
   */
  async isUserStaffOfStore(userId: string, storeId: string): Promise<boolean> {
    if (!userId || !storeId) {
      return false;
    }

    try {
      // Check if user has an employee record
      const employee = await this.employeeRepository.findOne({
        where: { to_user_id: userId },
      });

      if (!employee) {
        return false;
      }

      // Check if this employee has access to any branch of this store
      // by querying employee_branches and checking if any belong to this store
      const branchesInStore = await this.branchRepository
        .createQueryBuilder('branch')
        .innerJoin('employee_branches', 'eb', 'eb.branch_id = branch.id')
        .where('branch.store_id = :storeId', { storeId })
        .andWhere('eb.employee_id = :employeeId', { employeeId: employee.id })
        .getCount();

      return branchesInStore > 0;
    } catch (error) {
      this.logger.warn(
        `Error checking if user ${userId} is staff of store ${storeId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
      return false;
    }
  }
}
