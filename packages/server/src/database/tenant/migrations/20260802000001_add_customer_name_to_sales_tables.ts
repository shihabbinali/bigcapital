/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('sales_invoices', (table) => {
    table.string('customer_name', 255).nullable().after('customer_id');
  }).alterTable('sales_receipts', (table) => {
    table.string('customer_name', 255).nullable().after('customer_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('sales_invoices', (table) => {
    table.dropColumn('customer_name');
  }).alterTable('sales_receipts', (table) => {
    table.dropColumn('customer_name');
  });
};
