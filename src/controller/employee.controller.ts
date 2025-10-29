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
import { EmployeeService } from '../services/employee.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../dto/employee.dto';
import { Employee } from '../model/employees.model';

@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  /**
   * Create a new employee relationship
   *
   * POST /employees
   */
  @Post()
  async createEmployee(
    @Body() createEmployeeDto: CreateEmployeeDto
  ): Promise<Employee> {
    return await this.employeeService.createEmployee(createEmployeeDto);
  }

  /**
   * Get all employee relationships
   *
   * GET /employees
   */
  @Get()
  async getAllEmployees(): Promise<Employee[]> {
    return await this.employeeService.findAllEmployees();
  }

  /**
   * Get an employee relationship by ID
   *
   * GET /employees/:id
   */ @Get(':id')
  async getEmployeeById(@Param('id') id: string): Promise<Employee> {
    return await this.employeeService.findEmployeeById(id);
  }

  /**
   * Get an employee with their branch assignments
   *
   * GET /employees/:id/with-branches
   */
  @Get(':id/with-branches')
  async getEmployeeWithBranches(
    @Param('id') id: string
  ): Promise<Employee & { branchIds: string[] }> {
    return await this.employeeService.findEmployeeWithBranches(id);
  }

  /**
   * Get branches assigned to a user (by to_user_id)
   *
   * GET /employees/user/:userId/branches
   */
  @Get('user/:userId/branches')
  async getUserBranches(
    @Param('userId') userId: string
  ): Promise<{ branchIds: string[] }> {
    const branchIds = await this.employeeService.findBranchesByUserId(userId);
    return { branchIds };
  }

  /**
   * Get employee relationships by employer (from_user_id)
   *
   * GET /employees/employer/with-branch-names-and-user
   */
  @Get('employer/with-branch-names-and-user')
  async getEmployeesWithBranchNamesAndUserByEmployer(
    @Query('fromUserId') fromUserId?: string,
    @Query('toUserId') toUserId?: string,
    @Query('status') status?: string | string[],
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string
  ): Promise<{
    data: (Employee & {
      branches: { id: string; name: string }[];
      phone?: string;
      role?: string;
      name?: string;
    })[];
    total: number;
  }> {
    try {
      return await this.employeeService.findEmployeesWithBranchNamesAndUserInfoByFromUserId(
        {
          fromUserId: fromUserId,
          toUserId: toUserId,
          status: status,
          page: Number(page),
          limit: Number(limit),
          search: search,
        }
      );
    } catch (error) {
      console.error(
        'Error in getEmployeesWithBranchNamesAndUserByEmployer:',
        error
      );
      throw error;
    }
  }

  /**
   * Get employee relationships by employer (from_user_id)
   *
   * GET /employees/employer/:fromUserId
   */
  @Get('employer/:fromUserId')
  async getEmployeesByEmployer(
    @Param('fromUserId') fromUserId: string
  ): Promise<Employee[]> {
    return await this.employeeService.findEmployeesByFromUserId(fromUserId);
  }

  /**
   * Get employee relationships by employee (to_user_id)
   *
   * GET /employees/employee/:toUserId
   */
  @Get('employee/:toUserId')
  async getEmployeesByEmployee(
    @Param('toUserId') toUserId: string
  ): Promise<Employee[]> {
    return await this.employeeService.findEmployeesByToUserId(toUserId);
  }

  /**
   * Get all employees by employer (from_user_id) with their branch assignments
   *
   * GET /employees/employer/:fromUserId/with-branches
   */
  @Get('employer/:fromUserId/with-branches')
  async getEmployeesWithBranchesByEmployer(
    @Param('fromUserId') fromUserId: string
  ): Promise<(Employee & { branchIds: string[] })[]> {
    return await this.employeeService.findEmployeesWithBranchesByFromUserId(
      fromUserId
    );
  }

  /**
   * Update an employee relationship
   *
   * PUT /employees/:id
   */
  @Put(':id')
  async updateEmployee(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto
  ): Promise<Employee> {
    return await this.employeeService.updateEmployee(id, updateEmployeeDto);
  }

  /**
   * Delete an employee relationship
   *
   * DELETE /employees/:id
   */
  @Delete(':id')
  async deleteEmployee(@Param('id') id: string): Promise<{ message: string }> {
    await this.employeeService.deleteEmployee(id);
    return {
      message: `Employee relationship with ID ${id} deleted successfully`,
    };
  }
}
