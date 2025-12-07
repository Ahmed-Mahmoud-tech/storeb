import { Store } from '../model/store.model';
import { Employee } from '../model/employees.model';
import { Branch } from '../model/branches.model';
import { EmployeeBranch } from '../model/employee_branches.model';
import { UnauthorizedException } from '@nestjs/common/exceptions/unauthorized.exception';
import { ForbiddenException } from '@nestjs/common/exceptions/forbidden.exception';

/**
 * Check if user has the required role
 * @param userRole - The user's role (owner, employee, manager, client)
 * @param allowedRoles - Array of allowed roles
 * @returns true if user role is in allowed roles
 */
export function checkUserRole(
  userRole: string,
  allowedRoles: string[]
): boolean {
  if (!userRole || !allowedRoles || allowedRoles.length === 0) {
    return false;
  }
  return allowedRoles.includes(userRole.toLowerCase());
}

/**
 * Check if user has access to a specific store
 * @param userId - The user's ID
 * @param storeId - The store ID to check access for
 * @returns The user's role in the store (owner, manager, employee, salesman) or null if no access
 */
export async function checkUserStoreAccess(
  dataSource: DataSource,
  userId: string,
  storeId: string
): Promise<string | null> {
  if (!userId || !storeId) {
    return null;
  }

  try {
    const storeRepository = dataSource.getRepository(Store);
    const branchRepository = dataSource.getRepository(Branch);
    const employeeRepository = dataSource.getRepository(Employee);
    const employeeBranchRepository = dataSource.getRepository(EmployeeBranch);

    // Check if user is the store owner
    const store = await storeRepository.findOne({
      where: { id: storeId, owner_id: userId },
    });
    if (store) {
      return 'owner';
    }

    // Check if user is an employee/manager of this store
    const branches = await branchRepository.find({
      where: { store_id: storeId },
    });

    if (branches.length === 0) {
      return null;
    }

    const branchIds = branches.map((branch) => branch.id);

    // Check if user is in employee_branches for any branch of this store
    const employeeBranch = await employeeBranchRepository.findOne({
      where: {
        employee_id: userId,
      },
    });

    if (employeeBranch && branchIds.includes(employeeBranch.branch_id)) {
      // Get employee role status
      const employee = await employeeRepository.findOne({
        where: { to_user_id: userId, from_user_id: storeId },
      });

      if (employee) {
        const status = employee.status?.toLowerCase();
        if (['manager', 'employee', 'salesman'].includes(status)) {
          return status;
        }
      }

      return 'employee'; // Default to employee if no specific status
    }

    return null;
  } catch (error) {
    console.error('Error checking user store access:', error);
    return null;
  }
}

/**
 * Check if user is accessing their own data
 * @param userId - The user's ID
 * @param paramId - The ID parameter from the route/request (user ID being accessed)
 * @returns true if both IDs match
 */
export function checkUserDataAccess(userId: string, paramId: string): boolean {
  if (!userId || !paramId) {
    return false;
  }
  return userId === paramId;
}

import { DataSource } from 'typeorm';

export async function canActivate(
  dataSource: DataSource,
  data: {
    roles?: string[];
    user: { id: string; type: string };
    storeId?: string;
    branchId?: string;
  }
): Promise<boolean> {
  const { roles, user, storeId, branchId } = data;
  const { id, type } = user;

  if (!user) {
    throw new UnauthorizedException('User not found in request');
  }

  // Check role if specified
  if (roles && roles.length > 0) {
    const userRole = type;
    const hasRole = checkUserRole(userRole, roles);
    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${roles.join(', ')}`
      );
    }
  }

  // Check store access if specified
  if (storeId) {
    if (!storeId) {
      throw new ForbiddenException('Store ID is required for this operation');
    }

    const userStoreRole = await checkUserStoreAccess(dataSource, id, storeId);
    if (!userStoreRole) {
      throw new ForbiddenException(
        'Access denied. You do not have access to this store'
      );
    }

    // Verify user has one of the required roles in the store
    const allowedStoreRoles = roles || [
      'owner',
      'manager',
      'employee',
      'sales',
    ];
    if (!allowedStoreRoles.includes(userStoreRole)) {
      throw new ForbiddenException(
        `Access denied. Required store roles: ${allowedStoreRoles.join(', ')}`
      );
    }
  }

  if (branchId) {
    if (!branchId) {
      throw new ForbiddenException('Branch ID is required for this operation');
    }
    const employeeBranchRepository = dataSource.getRepository(EmployeeBranch);
    const branchRepository = dataSource.getRepository(Branch);
    const storeRepository = dataSource.getRepository(Store);
    if (type === 'owner') {
      const branch = await branchRepository.findOne({
        where: { id: branchId },
      });
      if (!branch) {
        throw new ForbiddenException('Access denied. Branch not found');
      } else {
        const store = await storeRepository.findOne({
          where: { id: branch.store_id, owner_id: id },
        });
        if (!store) {
          throw new ForbiddenException('Access denied. Store not found');
        }
      }
    } else {
      const branch = await employeeBranchRepository.findOne({
        where: { employee_id: user.id, branch_id: branchId },
      });
      if (!branch) {
        throw new ForbiddenException('Access denied. Branch not found');
      }
    }
  }
  return true;
}
