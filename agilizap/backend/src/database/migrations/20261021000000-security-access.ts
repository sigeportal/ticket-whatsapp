import { QueryInterface, DataTypes } from "sequelize";
module.exports = {
  up: async (qi: QueryInterface) => qi.sequelize.transaction(async transaction => {
    await qi.addColumn("Users", "resetTokenHash", { type: DataTypes.STRING(64), allowNull: true }, { transaction });
    await qi.addColumn("Users", "resetTokenExpiresAt", { type: DataTypes.DATE, allowNull: true }, { transaction });
    await qi.addColumn("Users", "mustChangePassword", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, { transaction });
    await qi.addColumn("Users", "blocked", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, { transaction });
    await qi.addColumn("Users", "mfaLastStep", { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 }, { transaction });
    // Invalidate plaintext legacy reset tokens and all existing sessions once on upgrade.
    await qi.sequelize.query('UPDATE "Users" SET "resetPassword" = NULL, "tokenVersion" = COALESCE("tokenVersion", 0) + 1', { transaction });
  }),
  down: async (qi: QueryInterface) => qi.sequelize.transaction(async transaction => {
    for (const column of ["resetTokenHash", "resetTokenExpiresAt", "blocked", "mfaLastStep", "mustChangePassword"]) {
      await qi.removeColumn("Users", column, { transaction });
    }
  })
};
