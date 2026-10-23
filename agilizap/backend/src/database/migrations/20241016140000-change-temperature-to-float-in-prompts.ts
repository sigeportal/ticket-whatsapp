import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async transaction => {
      // Sequelize 5 sets the default before changing the type; 0.7 is invalid on INTEGER.
      await queryInterface.sequelize.query('ALTER TABLE "Prompts" ALTER COLUMN "temperature" TYPE DOUBLE PRECISION USING "temperature"::double precision', { transaction });
      await queryInterface.changeColumn("Prompts", "temperature", {
        type: DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0.7
      }, { transaction });
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.changeColumn("Prompts", "temperature", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    });
  }
};
