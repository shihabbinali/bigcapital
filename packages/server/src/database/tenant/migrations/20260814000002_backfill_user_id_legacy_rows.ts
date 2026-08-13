/**
 * Backfills legacy rows that have a NULL `user_id` with the tenant owner's
 * `SystemUser.id` (the admin user who built the organization).
 *
 * Without this, pre-scoping records would be invisible to every non-admin
 * user after per-user row-level scoping is enforced. Assigning them to the
 * tenant owner (admin) keeps them visible to admins and owned by the tenant.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const tables = [
    'items',
    'sale_invoices',
    'bills',
    'manual_journals',
    'inventory_adjustments',
    'sales_receipts',
    'sales_estimates',
    'payment_receives',
    'bills_payments',
    'credit_notes',
    'vendor_credits',
    'expenses',
    'cashflow_transactions',
    'items_categories',
    'accounts_transactions',
  ];

  // The tenant owner is the admin user (role slug 'admin') that built the
  // organization. Fall back to the earliest admin if multiple exist.
  const ownerUser = await knex('users')
    .join('roles', 'users.role_id', 'roles.id')
    .where('roles.slug', 'admin')
    .orderBy('users.id', 'asc')
    .first();

  if (!ownerUser || !ownerUser.system_user_id) {
    // No admin user yet - nothing to backfill to; leave rows untouched.
    return;
  }
  const ownerSystemUserId = ownerUser.system_user_id;

  for (const table of tables) {
    await knex(table).whereNull('user_id').update({
      user_id: ownerSystemUserId,
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function () {
  // Irreversible - the original NULL values are unknown after the update.
};
