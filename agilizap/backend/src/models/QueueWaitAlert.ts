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
  Default,
  Index
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import Ticket from "./Ticket";
import Queue from "./Queue";

@Table({
  tableName: "QueueWaitAlerts"
})
class QueueWaitAlert extends Model<QueueWaitAlert> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Index
  @AllowNull(false)
  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @Index
  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Index
  @AllowNull(false)
  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @AllowNull(false)
  @Column
  episodeId: string;

  @AllowNull(false)
  @Column
  waitingSince: Date;

  @AllowNull(false)
  @Column
  alertedAt: Date;

  @AllowNull(false)
  @Column
  businessMinutesWaiting: number;

  @AllowNull(false)
  @Column(DataType.JSONB)
  recipientUserIds: number[];

  @AllowNull(false)
  @Default("pending_response")
  @Column
  status: string;

  @Column
  resolvedAt: Date;

  @ForeignKey(() => User)
  @Column
  resolvedByUserId: number;

  @BelongsTo(() => User)
  resolvedByUser: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default QueueWaitAlert;
