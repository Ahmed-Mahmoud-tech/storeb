import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './users.model';
import { Store } from './store.model';

export enum SubscriptionRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum SubscriptionRequestType {
  UPGRADE = 'upgrade',
  DOWNGRADE = 'downgrade',
  RENEWAL = 'renewal',
  NEW = 'new',
}

@Entity('subscription_requests')
export class SubscriptionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column('uuid')
  store_id: string;

  @Column({ nullable: true })
  store_name: string;

  // Current plan details (for reference)
  @Column({ type: 'int', nullable: true })
  current_product_limit: number;

  @Column({ type: 'int', nullable: true })
  current_month_count: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  current_total_price: number;

  // Requested plan details
  @Column({ type: 'int' })
  requested_product_limit: number;

  @Column({ type: 'int' })
  requested_month_count: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  requested_total_price: number;

  // Financial calculations
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_difference: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  remaining_credit_value: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  net_cost: number;

  @Column({
    type: 'enum',
    enum: SubscriptionRequestType,
    default: SubscriptionRequestType.UPGRADE,
  })
  request_type: SubscriptionRequestType;

  @Column({
    type: 'enum',
    enum: SubscriptionRequestStatus,
    default: SubscriptionRequestStatus.PENDING,
  })
  status: SubscriptionRequestStatus;

  @Column({ type: 'text', nullable: true })
  user_notes: string;

  @Column({ type: 'text', nullable: true })
  admin_notes: string;

  @Column({ type: 'uuid', nullable: true })
  processed_by: string;

  @Column({ type: 'timestamp', nullable: true })
  processed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'store_id' })
  store?: Store;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'processed_by' })
  processor?: User;
}
