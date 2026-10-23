import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (qi: QueryInterface) => qi.sequelize.transaction(async transaction => {
    // 1. AuditLogs table
    await qi.createTable("AuditLogs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      userEmail: {
        type: DataTypes.STRING,
        allowNull: true
      },
      userRole: {
        type: DataTypes.STRING,
        allowNull: true
      },
      resource: {
        type: DataTypes.STRING,
        allowNull: false
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false
      },
      result: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "success"
      },
      targetId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      details: {
        type: DataTypes.JSON,
        allowNull: true
      },
      ip: {
        type: DataTypes.STRING(45),
        allowNull: true
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

    await qi.addIndex("AuditLogs", ["companyId", "createdAt"], {
      name: "audit_logs_company_created_at_idx",
      transaction
    });
    await qi.addIndex("AuditLogs", ["companyId", "resource", "action"], {
      name: "audit_logs_company_resource_action_idx",
      transaction
    });

    // 2. Tickets columns for lifecycle, closing and legal hold
    await qi.addColumn("Tickets", "closedAt", {
      type: DataTypes.DATE,
      allowNull: true
    }, { transaction });

    await qi.addColumn("Tickets", "legalHold", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }, { transaction });

    await qi.addColumn("Tickets", "legalHoldReason", {
      type: DataTypes.TEXT,
      allowNull: true
    }, { transaction });

    await qi.addColumn("Tickets", "legalHoldAt", {
      type: DataTypes.DATE,
      allowNull: true
    }, { transaction });

    await qi.addIndex("Tickets", ["companyId", "status", "closedAt"], {
      name: "tickets_company_status_closed_at_idx",
      transaction
    });

    // 3. Campaign opt-out columns
    await qi.addColumn("Contacts", "optOutCampaign", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }, { transaction });

    await qi.addColumn("ContactListItems", "optOutCampaign", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }, { transaction });

    // 4. Safe constraint check in PostgreSQL catalog to avoid aborted transaction
    const [constraints]: any = await qi.sequelize.query(
      "SELECT conname FROM pg_constraint WHERE conname = 'contactid_companyid_unique'",
      { transaction }
    );
    if (constraints && constraints.length > 0) {
      await qi.removeConstraint("Tickets", "contactid_companyid_unique", { transaction });
    }

    await qi.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "tickets_active_contact_company_whatsapp_unique" ON "Tickets" ("contactId", "companyId", "whatsappId") WHERE status IN (\'open\', \'pending\')',
      { transaction }
    );
  }),

  down: async (qi: QueryInterface) => qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query('DROP INDEX IF EXISTS "tickets_active_contact_company_whatsapp_unique"', { transaction });

    const [cols]: any = await qi.sequelize.query(
      "SELECT column_name, table_name FROM information_schema.columns WHERE table_name IN ('Tickets', 'Contacts', 'ContactListItems')",
      { transaction }
    );
    const existing = new Set((cols || []).map((c: any) => `${c.table_name}.${c.column_name}`));

    if (existing.has("ContactListItems.optOutCampaign")) {
      await qi.removeColumn("ContactListItems", "optOutCampaign", { transaction });
    }

    if (existing.has("Contacts.optOutCampaign")) {
      await qi.removeColumn("Contacts", "optOutCampaign", { transaction });
    }

    const [indices]: any = await qi.sequelize.query(
      "SELECT indexname FROM pg_indexes WHERE indexname = 'tickets_company_status_closed_at_idx'",
      { transaction }
    );
    if (indices && indices.length > 0) {
      await qi.removeIndex("Tickets", "tickets_company_status_closed_at_idx", { transaction });
    }

    for (const col of ["closedAt", "legalHold", "legalHoldReason", "legalHoldAt"]) {
      if (existing.has(`Tickets.${col}`)) {
        await qi.removeColumn("Tickets", col, { transaction });
      }
    }

    await qi.sequelize.query('DROP TABLE IF EXISTS "AuditLogs" CASCADE', { transaction });
  })
};
