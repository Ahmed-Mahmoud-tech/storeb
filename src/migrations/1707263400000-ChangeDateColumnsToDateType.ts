import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeDateColumnsToDateType1707263400000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "start_date"`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "start_date" date NOT NULL DEFAULT CURRENT_DATE`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "expiry_date"`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "expiry_date" date`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "expiry_date"`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "expiry_date" timestamptz`);
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "start_date"`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "start_date" timestamptz NOT NULL DEFAULT now()`);
    }
}
