import { Entity, PrimaryColumn } from 'typeorm';

@Entity('store_branches')
export class StoreBranch {
  @PrimaryColumn({ type: 'uuid' })
  store_id!: string;

  @PrimaryColumn({ type: 'uuid' })
  branch_id!: string;
}
