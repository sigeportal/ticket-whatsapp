import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("Tasks", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      completed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      priority: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "medium"
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: true
      },
      userId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      assignedUserId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("Tasks", ["companyId", "completed"]);
    await queryInterface.addIndex("Tasks", ["companyId", "userId"]);
    await queryInterface.addIndex("Tasks", ["companyId", "assignedUserId"]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("Tasks");
  }
};
