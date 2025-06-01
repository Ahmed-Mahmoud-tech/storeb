import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './users.model';
import { Branch } from './branches.model';

@Entity('customer_products')
export class CustomerProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column('varchar', { array: true })
  product_code!: string[];

  @Column({ type: 'uuid', nullable: true })
  employee?: string; // userId for created by

  @Column({ type: 'uuid', nullable: true })
  branch_id?: string; // branch id reference

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'employee' })
  employeeUser?: User;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch?: Branch;
}
