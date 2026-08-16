/**
 * Backfills `TaxRate` permissions (`View`/`Create`/`Edit`/`Delete`) for all
 * non-admin roles.
 *
 * The `TaxRate` subject is used by the Tax Rates module and by the invoice /
 * bill forms (they fetch `GET /api/tax-rates` while composing item entries),
 * but it was never registered in the roles `AbilitySchema`, so it could not be
 * granted to any role. Existing non-admin roles therefore lack the permission
 * and their users get `You do not have permission to View TaxRate` when
 * creating a sale invoice.
 *
 * This migration grants all four abilities to every non-admin role that does
 * not already have a matching `role_permissions` row, so existing roles pick up
 * the permission without requiring a manual edit.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const roleIds = (
    await knex('roles')
      .where(function () {
        this.whereNot('slug', 'admin').orWhereNull('slug');
      })
      .select('id')
  ).map((row: any) => row.id);

  if (roleIds.length === 0) {
    return;
  }
  const abilities = ['View', 'Create', 'Edit', 'Delete'];

  for (const roleId of roleIds) {
    for (const ability of abilities) {
      const exists = await knex('role_permissions')
        .where({ role_id: roleId, subject: 'TaxRate', ability })
        .first();

      if (!exists) {
        await knex('role_permissions').insert({
          role_id: roleId,
          subject: 'TaxRate',
          ability,
          value: true,
        });
      }
    }
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex('role_permissions')
    .where({ subject: 'TaxRate' })
    .whereIn(
      'role_id',
      knex('roles')
        .where(function () {
          this.whereNot('slug', 'admin').orWhereNull('slug');
        })
        .select('id'),
    )
    .del();
};
