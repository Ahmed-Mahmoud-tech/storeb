import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  country_code?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
  })
  type!: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: false })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password?: string;

  @Column({ type: 'boolean', default: false })
  email_verified!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verification_token?: string;

  @Column({ type: 'timestamptz', nullable: true })
  verification_token_expires?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reset_password_token?: string;

  @Column({ type: 'timestamptz', nullable: true })
  reset_password_expires?: Date;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at!: Date;
}
