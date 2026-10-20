import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableInfo: any = await queryInterface.describeTable("Prompts");

    if (!tableInfo.provider) {
      await queryInterface.addColumn("Prompts", "provider", {
        type: DataTypes.TEXT,
        defaultValue: "gemini",
        allowNull: true
      });
    }

    if (!tableInfo.model) {
      await queryInterface.addColumn("Prompts", "model", {
        type: DataTypes.TEXT,
        defaultValue: "gemini-1.5-flash",
        allowNull: true
      });
    }

    if (tableInfo.apiKey && !tableInfo.apiKey.allowNull) {
      await queryInterface.changeColumn("Prompts", "apiKey", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableInfo: any = await queryInterface.describeTable("Prompts");

    if (tableInfo.provider) {
      await queryInterface.removeColumn("Prompts", "provider");
    }
    if (tableInfo.model) {
      await queryInterface.removeColumn("Prompts", "model");
    }
  }
};
