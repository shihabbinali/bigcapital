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
      return knex('items_entries')
        .join('items', 'items.id', 'items_entries.item_id')
        .whereNot('items.type', 'inventory')
        .whereNotNull('items.cost_price')
        .where('items.cost_price', '>', 0)
        .update({ cost_rate: knex.raw('??.??', ['items', 'cost_price']) });
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
