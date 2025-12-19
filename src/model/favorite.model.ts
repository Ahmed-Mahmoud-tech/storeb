import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './users.model';
import { Product } from './product.model';

@Entity('favorite')
export class Favorite {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuid_generate_v4()' })
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  product!: string; // product_code

  @Column({ type: 'uuid' })
  user_id!: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Product, { eager: false })
  @JoinColumn({ name: 'product', referencedColumnName: 'product_code' })
  productEntity?: Product;
}
