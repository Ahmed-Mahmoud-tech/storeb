import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeBranchAddressNullable1740163200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branches" ALTER COLUMN "address" DROP NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branches" ALTER COLUMN "address" SET NOT NULL`
    );
  }
}
