import { Entity, PrimaryColumn } from 'typeorm';

@Entity('product_branches')
export class ProductBranch {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  product_code!: string;

  @PrimaryColumn({ type: 'uuid' })
  branch_id!: string;
}
