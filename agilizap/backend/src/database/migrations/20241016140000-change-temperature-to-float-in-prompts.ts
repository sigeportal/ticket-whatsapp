import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.changeColumn("Prompts", "temperature", {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0.7
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
