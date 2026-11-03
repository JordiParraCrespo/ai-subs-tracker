import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Tokens one machine's logs recorded for one account, model and local day.
 * The device is part of the key because each machine only sees its own
 * transcripts: the sync replaces that machine's totals, and readers sum
 * across devices.
 */
@Entity('token_usage_daily')
export class TokenUsageDailyOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  accountId!: string;

  @PrimaryColumn({ type: 'varchar' })
  device!: string;

  @PrimaryColumn({ type: 'date' })
  day!: string;

  @PrimaryColumn({ type: 'varchar' })
  model!: string;

  @Column({ type: 'bigint' })
  input!: string;

  @Column({ type: 'bigint' })
  output!: string;

  @Column({ type: 'bigint' })
  cacheWrite!: string;

  @Column({ type: 'bigint' })
  cacheRead!: string;

  @Column({ type: 'integer' })
  messages!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
