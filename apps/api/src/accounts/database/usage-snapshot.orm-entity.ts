import type {
  ExtraUsage,
  LimitWindow,
  SnapshotSource,
  SnapshotStatus,
} from '@flama/shared/schemas/accounts';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One reading of an account's limit windows. Append-only: written by the
 * sync, read as "the latest per account" and as weekly peaks. Retention is
 * applied by the sync itself (`UsageRepository.recordSnapshot`).
 */
@Entity('usage_snapshot')
export class UsageSnapshotOrmEntity {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'uuid' })
  accountId!: string;

  @Column({ type: 'timestamptz' })
  capturedAt!: Date;

  @Column({ type: 'varchar' })
  source!: SnapshotSource;

  @Column({ type: 'varchar' })
  status!: SnapshotStatus;

  @Column({ type: 'varchar', nullable: true })
  message!: string | null;

  @Column({ type: 'jsonb' })
  windows!: LimitWindow[];

  @Column({ type: 'jsonb', nullable: true })
  extraUsage!: ExtraUsage | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
