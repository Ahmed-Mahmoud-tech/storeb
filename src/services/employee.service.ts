import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../model/employees.model';
import { EmployeeBranch } from '../model/employee_branches.model';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../dto/employee.dto';
import { User } from '../model/users.model';
import { Branch } from '../model/branches.model';
import { Store } from '../model/store.model';

@Injectable()
export class EmployeeService {
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
    // Check if phone exists but to_user_id doesn't - check if user exists
    let user: User | undefined;
    if (createEmployeeDto.phone && !createEmployeeDto.to_user_id) {
      // Try to find an existing user with this phone number
      const existingUser = await this.userRepository.findOne({
        where: { phone: createEmployeeDto.phone },
      });

      if (existingUser) {
        // Use existing user if found
        createEmployeeDto.to_user_id = existingUser.id;
        user = existingUser;
      } else {
        // No user found with this phone number, return an error
        throw new NotFoundException(
          `No user found with phone number ${createEmployeeDto.phone}`
        );
      }
    } else if (createEmployeeDto.to_user_id) {
      // If to_user_id is provided, fetch the user for phone/role
      user = await this.userRepository.findOne({
        where: { id: createEmployeeDto.to_user_id },
      });
    }

    // If user found and role is provided in DTO, update user type with DTO role
    if (user && createEmployeeDto.role) {
      user.type = createEmployeeDto.role;
      await this.userRepository.save(user);
    }

    // Extract branches array from DTO before creating employee
    const { branches, ...employeeData } = createEmployeeDto;

    // Create and save employee record
    const employee = this.employeeRepository.create(employeeData);
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
      const employeeBranch = new EmployeeBranch();
      employeeBranch.employee_id = employeeId;
      employeeBranch.branch_id = branchId;
      await this.employeeBranchRepository.save(employeeBranch);
    }
  }

  /**
   * Find all employees
   */
  async findAllEmployees(): Promise<Employee[]> {
    return await this.employeeRepository.find();
  }

  /**
   * Find an employee by ID
   * @param id - Employee ID
   */
  async findEmployeeById(id: string): Promise<Employee> {
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
  }): Promise<{
    data: (Employee & {
      branches: { id: string; name: string }[];
      phone?: string;
      role?: string;
      name?: string;
    })[];
    total: number;
    fromUser?: User | null;
    toUser?: User | null;
    store?: Store | null;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 10;

    // Handle the case where "+" in URL query is converted to space
    const rawSearch = options?.search;
    let search;

    if (rawSearch) {
      // If search starts with a space (which could be a "+" from URL)
      // and is followed by a number, assume it was "+number"
      if (rawSearch.startsWith(' ') && /^\s+\d/.test(rawSearch)) {
        search = '+' + rawSearch.trim();
      } else {
        search = decodeURIComponent(rawSearch);
      }
    }

    console.log(search, 'search');

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
    if (search) {
      qb.leftJoin('user', 'user', 'employee.to_user_id = user.id');
      qb.andWhere('(user.name ILIKE :search OR user.phone ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    // Get total count before pagination
    const total = await qb.getCount();
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
}
