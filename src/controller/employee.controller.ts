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
import { EmployeeNotificationsGateway } from '../gateway/employee-notifications.gateway';

@Controller('employees')
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly employeeNotificationsGateway: EmployeeNotificationsGateway
  ) {}

  /**
   * Create a new employee relationship
   *
   * POST /employees
   */
  @Post()
  async createEmployee(
    @Body() createEmployeeDto: CreateEmployeeDto
  ): Promise<Employee> {
    const employee =
      await this.employeeService.createEmployee(createEmployeeDto);
    const options = {
      fromUserId: createEmployeeDto.from_user_id,
      toUserId: employee.to_user_id,
      page: 1,
      limit: 1,
    };
    const fullEmployeeData =
      await this.employeeService.findEmployeesWithBranchNamesAndUserInfoByFromUserId(
        options
      );
    const completeEmployee = fullEmployeeData.data[0] || employee;

    this.employeeNotificationsGateway.notifyEmployeeCreated(
      createEmployeeDto.from_user_id,
      completeEmployee
    );

    if (employee.to_user_id) {
      this.employeeNotificationsGateway.notifyEmployeeOfNewRequest(
        employee.to_user_id,
        completeEmployee
      );
    }

    return employee;
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
      // Filter out undefined search parameter
      const searchParam = search && search.trim() !== '' ? search : undefined;

      return await this.employeeService.findEmployeesWithBranchNamesAndUserInfoByFromUserId(
        {
          fromUserId: fromUserId,
          toUserId: toUserId,
          status: status,
          page: Number(page),
          limit: Number(limit),
          search: searchParam,
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
    const employee = await this.employeeService.updateEmployee(
      id,
      updateEmployeeDto
    );

    // Get the updated employee to find owner and employee user IDs
    const fullEmployee = await this.employeeService.findEmployeeById(id);

    // Fetch complete employee data with branches and user info for socket emission
    // Try fetching with the owner's ID first
    let employeeWithAllData = employee;
    if (fullEmployee.from_user_id) {
      const completeEmployeeData =
        await this.employeeService.findEmployeesWithBranchNamesAndUserInfoByFromUserId(
          {
            fromUserId: fullEmployee.from_user_id,
            toUserId: fullEmployee.to_user_id,
            page: 1,
            limit: 1,
          }
        );
      if (completeEmployeeData.data && completeEmployeeData.data.length > 0) {
        employeeWithAllData = completeEmployeeData.data[0];
      } else {
        // If not found, construct the complete object from available data
        employeeWithAllData = {
          ...fullEmployee,
          branches: [],
        } as any;
      }
    }

    // Emit socket events with complete data
    if (fullEmployee.from_user_id) {
      this.employeeNotificationsGateway.notifyEmployeeStatusChanged(
        id,
        fullEmployee.from_user_id,
        employeeWithAllData
      );
    }

    if (fullEmployee.to_user_id) {
      this.employeeNotificationsGateway.notifyEmployeeOfStatusChange(
        fullEmployee.to_user_id,
        employeeWithAllData
      );
    }

    return employee;
  }

  /**
   * Delete an employee relationship
   *
   * DELETE /employees/:id
   */
  @Delete(':id')
  async deleteEmployee(@Param('id') id: string): Promise<{ message: string }> {
    // Get the employee before deleting to find owner
    const employee = await this.employeeService.findEmployeeById(id);

    await this.employeeService.deleteEmployee(id);

    // Emit socket event to owner and employee
    if (employee.from_user_id) {
      this.employeeNotificationsGateway.notifyEmployeeRemoved(
        employee.from_user_id,
        id,
        employee.to_user_id
      );
    }

    return {
      message: `Employee relationship with ID ${id} deleted successfully`,
    };
  }
}
