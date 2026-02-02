import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateSubscriptionDateBased1738434000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update subscription_requests table
    const table = await queryRunner.getTable('subscription_requests');

    if (table) {
      // Drop old month_count columns if they exist
      const currentMonthCountColumn = table.findColumnByName('current_month_count');
      if (currentMonthCountColumn) {
        await queryRunner.dropColumn('subscription_requests', 'current_month_count');
      }

      const requestedMonthCountColumn = table.findColumnByName('requested_month_count');
      if (requestedMonthCountColumn) {
        await queryRunner.dropColumn('subscription_requests', 'requested_month_count');
      }

      // Add new date columns for current plan
      const currentStartDateColumn = table.findColumnByName('current_start_date');
      if (!currentStartDateColumn) {
        await queryRunner.addColumn(
          'subscription_requests',
          new TableColumn({
            name: 'current_start_date',
            type: 'timestamptz',
            isNullable: true,
          })
        );
      }

      const currentEndDateColumn = table.findColumnByName('current_end_date');
      if (!currentEndDateColumn) {
        await queryRunner.addColumn(
          'subscription_requests',
          new TableColumn({
            name: 'current_end_date',
            type: 'timestamptz',
            isNullable: true,
          })
        );
      }

      // Add new date columns for requested plan
      const requestedStartDateColumn = table.findColumnByName('requested_start_date');
      if (!requestedStartDateColumn) {
        await queryRunner.addColumn(
          'subscription_requests',
          new TableColumn({
            name: 'requested_start_date',
            type: 'timestamptz',
            isNullable: false,
            default: 'NOW()',
          })
        );
      }

      const requestedEndDateColumn = table.findColumnByName('requested_end_date');
      if (!requestedEndDateColumn) {
        await queryRunner.addColumn(
          'subscription_requests',
          new TableColumn({
            name: 'requested_end_date',
            type: 'timestamptz',
            isNullable: false,
            default: "NOW() + interval '30 days'",
          })
        );
      }
    }

    // Update payments table
    const paymentsTable = await queryRunner.getTable('payments');
    if (paymentsTable) {
      // Add payment_date column if it doesn't exist
      const paymentDateColumn = paymentsTable.findColumnByName('payment_date');
      if (!paymentDateColumn) {
        await queryRunner.addColumn(
          'payments',
          new TableColumn({
            name: 'payment_date',
            type: 'timestamptz',
            isNullable: true,
          })
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert changes if needed
    const table = await queryRunner.getTable('subscription_requests');

    if (table) {
      // Drop date columns
      const currentStartDateColumn = table.findColumnByName('current_start_date');
      if (currentStartDateColumn) {
        await queryRunner.dropColumn('subscription_requests', 'current_start_date');
      }

      const currentEndDateColumn = table.findColumnByName('current_end_date');
      if (currentEndDateColumn) {
        await queryRunner.dropColumn('subscription_requests', 'current_end_date');
      }

      const requestedStartDateColumn = table.findColumnByName('requested_start_date');
      if (requestedStartDateColumn) {
        await queryRunner.dropColumn('subscription_requests', 'requested_start_date');
      }

      const requestedEndDateColumn = table.findColumnByName('requested_end_date');
      if (requestedEndDateColumn) {
        await queryRunner.dropColumn('subscription_requests', 'requested_end_date');
      }

      // Add back month_count columns
      await queryRunner.addColumn(
        'subscription_requests',
        new TableColumn({
          name: 'current_month_count',
          type: 'int',
          isNullable: true,
          default: 1,
        })
      );

      await queryRunner.addColumn(
        'subscription_requests',
        new TableColumn({
          name: 'requested_month_count',
          type: 'int',
          isNullable: false,
          default: 1,
        })
      );
    }

    // Revert payments table
    const paymentsTable = await queryRunner.getTable('payments');
    if (paymentsTable) {
      const paymentDateColumn = paymentsTable.findColumnByName('payment_date');
      if (paymentDateColumn) {
        await queryRunner.dropColumn('payments', 'payment_date');
      }
    }
  }
}
