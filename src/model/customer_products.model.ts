import { Entity, PrimaryColumn } from 'typeorm';

@Entity('customer_products')
export class CustomerProduct {
  @PrimaryColumn({ type: 'uuid' })
  customer_id!: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  product_code!: string;
}
