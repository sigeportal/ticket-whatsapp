import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  DataType,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";

@Table({ tableName: "Tasks" })
class Task extends Model<Task> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  title: string;

  @Column(DataType.TEXT)
  description: string | null;

  @AllowNull(false)
  @Default(false)
  @Column
  completed: boolean;

  @Column
  completedAt: Date | null;

  @AllowNull(false)
  @Default("medium")
  @Column
  priority: string;

  @Column
  dueDate: Date | null;

  @ForeignKey(() => User)
  @Column
  userId: number | null;

  @BelongsTo(() => User, "userId")
  user: User;

  @ForeignKey(() => User)
  @Column
  assignedUserId: number | null;

  @BelongsTo(() => User, "assignedUserId")
  assignedUser: User;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Task;
