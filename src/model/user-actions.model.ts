import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './users.model';
import { Store } from './store.model';
import { Product } from './product.model';

export enum ActionType {
  HOME_PAGE_VISIT = 'home_page_visit',
  STORE_DETAILS_OPEN = 'store_details_open',
  PRODUCT_VIEW = 'product_view',
  PRODUCT_FAVORITE = 'product_favorite',
  PRODUCT_UNFAVORITE = 'product_unfavorite',
  WHATSAPP_CLICK = 'whatsapp_click',
  PHONE_CLICK = 'phone_click',
  MAP_OPEN = 'map_open',
  SEARCH = 'search',
  BRANCH_VISIT = 'branch_visit',
}

@Entity('user_actions')
export class UserAction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'enum',
    enum: ActionType,
    nullable: false,
  })
  action_type!: ActionType;

  @Column({ type: 'uuid', nullable: true })
  store_id?: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store?: Store;

  @Column({ type: 'varchar', length: 50, nullable: true })
  product_id?: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip_address?: string;

  @Column({ type: 'text', nullable: true })
  user_agent?: string;
}
