/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .alterTable('items_entries', (table) => {
      table.decimal('cost_rate', 15, 5).notNullable().defaultTo(0).after('rate');
    })
    .then(() => {
      // Backfill cost_rate from the linked item's cost price for service/non-inventory items.
      return knex.raw(
        `UPDATE items_entries
         INNER JOIN items ON items.id = items_entries.item_id
         SET items_entries.cost_rate = items.cost_price
         WHERE items.type != 'inventory'
           AND items.cost_price IS NOT NULL
           AND items.cost_price > 0`,
      );
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('items_entries', (table) => {
    table.dropColumn('cost_rate');
  });
};
