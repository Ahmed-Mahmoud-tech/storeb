import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuid_generate_v4()' })
  id!: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  phone!: string;

  @Column({ type: 'uuid', nullable: true })
  branch_id?: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  rate?: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ type: 'uuid', nullable: true })
  created_by?: string;

  @Column({ type: 'uuid', nullable: true })
  updated_by?: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at!: Date;
}
