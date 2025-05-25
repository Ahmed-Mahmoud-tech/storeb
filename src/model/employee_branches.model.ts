import { Entity, PrimaryColumn } from 'typeorm';

@Entity('employee_branches')
export class EmployeeBranch {
  @PrimaryColumn({ type: 'uuid' })
  employee_id!: string;

  @PrimaryColumn({ type: 'uuid' })
  branch_id!: string;
}
