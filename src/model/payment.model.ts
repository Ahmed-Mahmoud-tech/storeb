import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './users.model';
import { Store } from './store.model';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @Column({ type: 'uuid', nullable: false })
  store_id!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  store_name!: string;

  @Column({ type: 'int', default: 50 })
  product_limit!: number; // e.g., PRODUCT_UNIT, PRODUCT_UNIT*2, etc.

  @Column({ type: 'int', default: 1 })
  month_count!: number; // Duration in months

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price!: number; // Total price = (product_limit / PRODUCT_UNIT) * BASE_PRICE * month_count

  @Column({ type: 'boolean', default: false })
  is_paid!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  payment_date?: Date;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  start_date!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiry_date?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at!: Date;

  // Relations
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Store, { eager: false })
  @JoinColumn({ name: 'store_id' })
  store?: Store;
}
