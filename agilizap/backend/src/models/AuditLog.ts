import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  DataType,
  Index
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";

@Table({
  tableName: "AuditLogs"
})
class AuditLog extends Model<AuditLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Index
  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column
  userEmail: string;

  @Column
  userRole: string;

  @Index
  @AllowNull(false)
  @Column
  resource: string;

  @Index
  @AllowNull(false)
  @Column
  action: string;

  @AllowNull(false)
  @Column({ defaultValue: "success" })
  result: string;

  @Column
  targetId: string;

  @Column(DataType.JSON)
  details: any;

  @Column
  ip: string;

  @Index
  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AuditLog;
