import type { ProviderId } from '@flama/shared/subscriptions';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Persistence model for a coding-agent account. Mirrors the
 * `provider_account` table created by `AddProviderAccounts`; the migration is
 * the source of truth for its constraints and indexes.
 */
@Entity('provider_account')
export class AccountOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar' })
  provider!: ProviderId;

  @Column({ type: 'varchar' })
  externalId!: string;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', nullable: true })
  organization!: string | null;

  @Column({ type: 'varchar', nullable: true })
  reportedPlan!: string | null;

  @Column({ type: 'varchar', nullable: true })
  location!: string | null;

  @Column({ type: 'varchar', nullable: true })
  label!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  person!: string | null;

  @Column({ type: 'varchar', nullable: true })
  planId!: string | null;

  @Column({ type: 'integer', nullable: true })
  monthlyPriceCents!: number | null;

  @Column({ type: 'smallint', nullable: true })
  renewalDay!: number | null;

  @Column({ type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
