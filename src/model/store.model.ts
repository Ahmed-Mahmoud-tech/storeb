import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('store')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column('text', { array: true, nullable: true, default: [] })
  type!: string[];

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logo?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  banner?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  theme_color?: string;

  @Column({ type: 'boolean', default: false })
  delivery?: boolean;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at!: Date;

  @Column({ type: 'uuid', nullable: false })
  owner_id!: string;
}
