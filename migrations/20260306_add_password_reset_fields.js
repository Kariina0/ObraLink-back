exports.up = async function (knex) {
  const hasUsers = await knex.schema.hasTable("users");
  if (!hasUsers) return;

  const hasResetToken = await knex.schema.hasColumn("users", "resetPasswordToken");
  const hasResetExpiresAt = await knex.schema.hasColumn("users", "resetPasswordExpiresAt");
  const hasResetUsedAt = await knex.schema.hasColumn("users", "resetPasswordUsedAt");

  if (!hasResetToken || !hasResetExpiresAt || !hasResetUsedAt) {
    await knex.schema.alterTable("users", (table) => {
      if (!hasResetToken) table.string("resetPasswordToken").nullable();
      if (!hasResetExpiresAt) table.datetime("resetPasswordExpiresAt").nullable();
      if (!hasResetUsedAt) table.datetime("resetPasswordUsedAt").nullable();
    });
  }
};

exports.down = async function (knex) {
  const hasUsers = await knex.schema.hasTable("users");
  if (!hasUsers) return;

  const hasResetToken = await knex.schema.hasColumn("users", "resetPasswordToken");
  const hasResetExpiresAt = await knex.schema.hasColumn("users", "resetPasswordExpiresAt");
  const hasResetUsedAt = await knex.schema.hasColumn("users", "resetPasswordUsedAt");

  if (hasResetToken || hasResetExpiresAt || hasResetUsedAt) {
    await knex.schema.alterTable("users", (table) => {
      if (hasResetToken) table.dropColumn("resetPasswordToken");
      if (hasResetExpiresAt) table.dropColumn("resetPasswordExpiresAt");
      if (hasResetUsedAt) table.dropColumn("resetPasswordUsedAt");
    });
  }
};
