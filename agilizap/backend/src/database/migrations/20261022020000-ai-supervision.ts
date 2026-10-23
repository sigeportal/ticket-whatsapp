import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (qi: QueryInterface) => qi.sequelize.transaction(async transaction => {
    // 1. Create QueueWaitAlerts table
    await qi.createTable("QueueWaitAlerts", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      queueId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Queues", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      episodeId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      waitingSince: {
        type: DataTypes.DATE,
        allowNull: false
      },
      alertedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      businessMinutesWaiting: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      recipientUserIds: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending_response"
      },
      resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      resolvedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    }, { transaction });

    await qi.addIndex("QueueWaitAlerts", ["ticketId", "episodeId"], {
      name: "queue_wait_alerts_ticket_episode_unique",
      unique: true,
      transaction
    });

    await qi.addIndex("QueueWaitAlerts", ["companyId", "queueId", "status"], {
      name: "queue_wait_alerts_company_queue_status_idx",
      transaction
    });

    // 2. Add columns to Tickets for wait tracking and episode identification
    await qi.addColumn("Tickets", "lastClientMessageAt", {
      type: DataTypes.DATE,
      allowNull: true
    }, { transaction });

    await qi.addColumn("Tickets", "lastHumanResponseAt", {
      type: DataTypes.DATE,
      allowNull: true
    }, { transaction });

    await qi.addColumn("Tickets", "currentWaitEpisodeId", {
      type: DataTypes.STRING,
      allowNull: true
    }, { transaction });

    await qi.addIndex("Tickets", ["companyId", "queueId", "status", "lastClientMessageAt"], {
      name: "tickets_wait_queue_idx",
      transaction
    });

    // 3. Add columns to Companies for AI budget and quota governance
    await qi.addColumn("Companies", "aiMonthlyBudgetLimit", {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 50.00
    }, { transaction });

    await qi.addColumn("Companies", "aiMonthlySpent", {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      defaultValue: 0
    }, { transaction });

    await qi.addColumn("Companies", "aiBudgetPeriod", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "2026-10"
    }, { transaction });

    await qi.addColumn("Companies", "aiRequestsCount", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }, { transaction });
  }),

  down: async (qi: QueryInterface) => qi.sequelize.transaction(async transaction => {
    // Drop table QueueWaitAlerts
    const [tables]: any = await qi.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'QueueWaitAlerts'",
      { transaction }
    );
    if (tables && tables.length > 0) {
      await qi.dropTable("QueueWaitAlerts", { transaction });
    }

    // Drop indexes and columns from Tickets
    const [ticketCols]: any = await qi.sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'Tickets'",
      { transaction }
    );
    const existingTicketCols = new Set((ticketCols || []).map((c: any) => c.column_name));

    const [ticketIndices]: any = await qi.sequelize.query(
      "SELECT indexname FROM pg_indexes WHERE indexname = 'tickets_wait_queue_idx'",
      { transaction }
    );
    if (ticketIndices && ticketIndices.length > 0) {
      await qi.removeIndex("Tickets", "tickets_wait_queue_idx", { transaction });
    }

    for (const col of ["lastClientMessageAt", "lastHumanResponseAt", "currentWaitEpisodeId"]) {
      if (existingTicketCols.has(col)) {
        await qi.removeColumn("Tickets", col, { transaction });
      }
    }

    // Drop columns from Companies
    const [companyCols]: any = await qi.sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'Companies'",
      { transaction }
    );
    const existingCompanyCols = new Set((companyCols || []).map((c: any) => c.column_name));

    for (const col of ["aiMonthlyBudgetLimit", "aiMonthlySpent", "aiBudgetPeriod", "aiRequestsCount"]) {
      if (existingCompanyCols.has(col)) {
        await qi.removeColumn("Companies", col, { transaction });
      }
    }
  })
};
