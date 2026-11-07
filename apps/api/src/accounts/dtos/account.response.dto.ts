import {
  SNAPSHOT_SOURCES,
  SNAPSHOT_STATUSES,
  type SnapshotSource,
  type SnapshotStatus,
  WINDOW_KINDS,
  type WindowKind,
} from '@flama/shared/schemas/accounts';
import { PROVIDER_IDS, type ProviderId } from '@flama/shared/subscriptions';
import { ApiProperty } from '@nestjs/swagger';

export class LimitWindowResponseDto {
  @ApiProperty({ description: "The provider's own key, e.g. five_hour" })
  key!: string;

  @ApiProperty({ enum: WINDOW_KINDS })
  kind!: WindowKind;

  @ApiProperty()
  label!: string;

  @ApiProperty({ type: Number, nullable: true, description: 'Percent used, 0–100+' })
  utilization!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resetsAt!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  windowMinutes!: number | null;
}

export class ExtraUsageResponseDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ type: Number, nullable: true })
  monthlyLimit!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  usedCredits!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  utilization!: number | null;

  @ApiProperty({ type: String, nullable: true })
  currency!: string | null;
}

export class UsageSnapshotResponseDto {
  @ApiProperty({ type: String, format: 'date-time' })
  capturedAt!: string;

  @ApiProperty({ enum: SNAPSHOT_SOURCES })
  source!: SnapshotSource;

  @ApiProperty({ enum: SNAPSHOT_STATUSES })
  status!: SnapshotStatus;

  @ApiProperty({ type: String, nullable: true })
  message!: string | null;

  @ApiProperty({ type: [LimitWindowResponseDto] })
  windows!: LimitWindowResponseDto[];

  @ApiProperty({ type: ExtraUsageResponseDto, nullable: true })
  extraUsage!: ExtraUsageResponseDto | null;
}

export class WeeklyPeakResponseDto {
  @ApiProperty({ type: String, format: 'date-time' })
  resetsAt!: string;

  @ApiProperty({ description: 'Highest percent of the weekly allowance used before it reset' })
  peakUtilization!: number;
}

export class AccountResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PROVIDER_IDS })
  provider!: ProviderId;

  @ApiProperty()
  externalId!: string;

  @ApiProperty({ description: "The person's label, else the email" })
  displayName!: string;

  @ApiProperty({ type: String, nullable: true })
  label!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Who uses the account, as the owner names them; null is the owner',
  })
  person!: string | null;

  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true })
  organization!: string | null;

  @ApiProperty({ type: String, nullable: true })
  location!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Plan as the provider names it' })
  reportedPlan!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Catalog plan id in effect' })
  planId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  planName!: string | null;

  @ApiProperty({ description: 'True when the person chose the plan' })
  planOverridden!: boolean;

  @ApiProperty({ description: 'Monthly cost in effect, US cents' })
  monthlyPriceCents!: number;

  @ApiProperty({ description: 'True when the person set the price' })
  priceOverridden!: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Day of the month the plan bills (1–31): the one the person set, else the one the provider reports',
  })
  renewalDay!: number | null;

  @ApiProperty({ description: 'True when the person set the billing day' })
  renewalDayOverridden!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the provider last confirmed the subscription behind a reported billing day',
  })
  renewalCheckedAt!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSyncedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: UsageSnapshotResponseDto, nullable: true })
  latest!: UsageSnapshotResponseDto | null;

  @ApiProperty({
    type: [WeeklyPeakResponseDto],
    description: 'Weeks that reset in the last 30 days',
  })
  weeklyPeaks!: WeeklyPeakResponseDto[];
}
