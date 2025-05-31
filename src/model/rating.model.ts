import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.model';

@Entity('rating')
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  store_id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'int' })
  rate!: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;
  @Column({ type: 'varchar', length: 50 })
  product_code!: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at!: Date;
  @ManyToOne(() => Product, (product) => product.ratings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_code' })
  product!: Product;
}
