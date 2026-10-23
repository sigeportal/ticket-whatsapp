import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (qi: QueryInterface) => qi.sequelize.transaction(async transaction => {
    // 1. Schedules columns for interruption recovery, human review and retries
    await qi.addColumn("Schedules", "interruptionReason", {
      type: DataTypes.STRING,
      allowNull: true
    }, { transaction });

    await qi.addColumn("Schedules", "reviewedBy", {
      type: DataTypes.INTEGER,
      allowNull: true
    }, { transaction });

    await qi.addColumn("Schedules", "reviewedAt", {
      type: DataTypes.DATE,
      allowNull: true
    }, { transaction });

    await qi.addColumn("Schedules", "retries", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }, { transaction });

    await qi.addIndex("Schedules", ["companyId", "status", "sendAt"], {
      name: "schedules_company_status_send_at_idx",
      transaction
    });

    // 2. Messages columns for delivery lifecycle, idempotency and uncertain status
    await qi.addColumn("Messages", "status", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending"
    }, { transaction });

    await qi.addColumn("Messages", "operationId", {
      type: DataTypes.STRING,
      allowNull: true
    }, { transaction });

    await qi.addColumn("Messages", "uncertainReason", {
      type: DataTypes.TEXT,
      allowNull: true
    }, { transaction });

    await qi.addColumn("Messages", "retries", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }, { transaction });

    await qi.addIndex("Messages", ["companyId", "status"], {
      name: "messages_company_status_idx",
      transaction
    });

    await qi.addIndex("Messages", ["companyId", "operationId"], {
      name: "messages_company_operation_id_idx",
      transaction
    });

    // 3. Whatsapps columns for connection observability and operator guidance
    await qi.addColumn("Whatsapps", "disconnectReason", {
      type: DataTypes.STRING,
      allowNull: true
    }, { transaction });

    await qi.addColumn("Whatsapps", "actionRequired", {
      type: DataTypes.STRING,
      allowNull: true
    }, { transaction });

    await qi.addColumn("Whatsapps", "lastDisconnectedAt", {
      type: DataTypes.DATE,
      allowNull: true
    }, { transaction });
  }),

  down: async (qi: QueryInterface) => qi.sequelize.transaction(async transaction => {
    const [cols]: any = await qi.sequelize.query(
      "SELECT column_name, table_name FROM information_schema.columns WHERE table_name IN ('Schedules', 'Messages', 'Whatsapps')",
      { transaction }
    );
    const existing = new Set((cols || []).map((c: any) => `${c.table_name}.${c.column_name}`));

    // Remove indexes
    const [indices]: any = await qi.sequelize.query(
      "SELECT indexname FROM pg_indexes WHERE indexname IN ('schedules_company_status_send_at_idx', 'messages_company_status_idx', 'messages_company_operation_id_idx')",
      { transaction }
    );
    const existingIndices = new Set((indices || []).map((i: any) => i.indexname));

    if (existingIndices.has("schedules_company_status_send_at_idx")) {
      await qi.removeIndex("Schedules", "schedules_company_status_send_at_idx", { transaction });
    }
    if (existingIndices.has("messages_company_status_idx")) {
      await qi.removeIndex("Messages", "messages_company_status_idx", { transaction });
    }
    if (existingIndices.has("messages_company_operation_id_idx")) {
      await qi.removeIndex("Messages", "messages_company_operation_id_idx", { transaction });
    }

    // Remove columns
    for (const col of ["interruptionReason", "reviewedBy", "reviewedAt", "retries"]) {
      if (existing.has(`Schedules.${col}`)) {
        await qi.removeColumn("Schedules", col, { transaction });
      }
    }

    for (const col of ["status", "operationId", "uncertainReason", "retries"]) {
      if (existing.has(`Messages.${col}`)) {
        await qi.removeColumn("Messages", col, { transaction });
      }
    }

    for (const col of ["disconnectReason", "actionRequired", "lastDisconnectedAt"]) {
      if (existing.has(`Whatsapps.${col}`)) {
        await qi.removeColumn("Whatsapps", col, { transaction });
      }
    }
  })
};
