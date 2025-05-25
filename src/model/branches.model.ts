import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('branches')
export class Branch {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuid_generate_v4()' })
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  store_id!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  address!: string;

  @Column('text', { array: true, nullable: true })
  customer_support?: string[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  lat?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  lang?: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at!: Date;
}
