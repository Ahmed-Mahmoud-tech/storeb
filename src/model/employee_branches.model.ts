import { Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('employee_branches')
export class EmployeeBranch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @PrimaryColumn({ type: 'uuid' })
  employee_id!: string;

  @PrimaryColumn({ type: 'uuid' })
  branch_id!: string;
}
