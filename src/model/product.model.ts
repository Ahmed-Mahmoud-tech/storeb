import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Rating } from './rating.model';
import { User } from '../model/users.model';

@Entity('product')
export class Product {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  product_code!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  product_name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  price!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price_before_sale?: number;

  @Column('text', { array: true, nullable: true })
  images?: string[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: string;

  @Column('text', { array: true, nullable: true })
  tags?: string[];

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  status?: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at!: Date;

  @Column({ type: 'uuid', nullable: true })
  created_by?: string;
  @Column({ type: 'uuid', nullable: true })
  updated_by?: string;

  // Add relation to User for created_by
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User;

  @OneToMany(() => Rating, (rating) => rating.product)
  ratings: Rating[];
}
