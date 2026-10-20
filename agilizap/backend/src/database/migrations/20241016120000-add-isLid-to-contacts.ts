import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableInfo: any = await queryInterface.describeTable("Contacts");

    if (!tableInfo.isLid) {
      await queryInterface.addColumn("Contacts", "isLid", {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
    }

    // Marca contatos existentes que possuam IDs típicos de LID
    await queryInterface.sequelize.query(`
      UPDATE "Contacts"
      SET "isLid" = true
      WHERE (LENGTH(number) >= 15 AND number NOT LIKE '55%')
         OR number IN ('151500844196015', '183365189816458');
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    const tableInfo: any = await queryInterface.describeTable("Contacts");

    if (tableInfo.isLid) {
      await queryInterface.removeColumn("Contacts", "isLid");
    }
  }
};
