import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@flama/backend-ddd';
import {
  findPlan,
  isManualProvider,
  type ManualProviderId,
  type PlanDefinition,
  type ProviderId,
  resolvePlan,
  unofficialUsageReader,
} from '@flama/shared/subscriptions';

export interface AccountProps {
  userId: string;
  provider: ProviderId;
  /** The login's id at the provider; with the user and provider, what makes it this account. */
  externalId: string;
  email: string | null;
  organization: string | null;
  /** The plan as the provider last named it. */
  reportedPlan: string | null;
  /** Where the login lives on the machine that last reported it. */
  location: string | null;
  /** The person's own name for it; null shows the email. */
  label: string | null;
  /** A plan the person chose over the reported one. */
  planId: string | null;
  /** What the person actually pays, over the plan's list price. */
  monthlyPriceCents: number | null;
  /** The day of the month the plan bills, as the person told us; it wins over a reported one. */
  renewalDay: number | null;
  /**
   * The day the provider's login says the plan bills (Codex's token carries
   * the end of the paid period); null when it says nothing.
   */
  reportedRenewalDay: number | null;
  /** When the provider last confirmed the subscription behind that day. */
  renewalCheckedAt: Date | null;
  isActive: boolean;
  activatedAt: Date | null;
  lastSyncedAt: Date | null;
  archivedAt: Date | null;
}

export interface Sighting {
  email: string | null;
  organization: string | null;
  reportedPlan: string | null;
  location: string | null;
  /** The billing day the login reports; null keeps the last one known. */
  reportedRenewal: { day: number; checkedAt: Date | null } | null;
  at: Date;
}

/** What a person gives to add a subscription by hand. */
export interface ManualAccountInput {
  userId: string;
  provider: ManualProviderId;
  label: string;
  email: string | null;
  planId: string;
  monthlyPriceCents: number | null;
  renewalDay: number | null;
}

export interface AccountEdit {
  label?: string | null;
  planId?: string | null;
  monthlyPriceCents?: number | null;
  renewalDay?: number | null;
}

/**
 * One login to one coding-agent provider, owned by one person. Identity comes
 * from the desktop collector (`recordSighting`); the label, plan and price are
 * the person's (`edit`). Which login a terminal uses is `activate`, and only
 * one per provider is active — that rule spans aggregates and lives in the
 * activate handler, which deactivates the others.
 */
export class AccountEntity extends AggregateRoot<AccountProps> {
  static register(
    id: string,
    input: { userId: string; provider: ProviderId; externalId: string } & Sighting,
  ): AccountEntity {
    const account = new AccountEntity({
      id,
      props: {
        userId: input.userId,
        provider: input.provider,
        externalId: input.externalId,
        email: input.email,
        organization: input.organization,
        reportedPlan: input.reportedPlan,
        location: input.location,
        label: null,
        planId: null,
        monthlyPriceCents: null,
        renewalDay: null,
        reportedRenewalDay: input.reportedRenewal?.day ?? null,
        renewalCheckedAt: input.reportedRenewal?.checkedAt ?? null,
        isActive: false,
        activatedAt: null,
        lastSyncedAt: input.at,
        archivedAt: null,
      },
    });
    account.validate();
    return account;
  }

  /**
   * A subscription the person adds by hand, for a provider no machine reports
   * (Z.AI). Its externalId is `manual:<id>`, which no login can collide with;
   * the plan is the person's choice, so it is stored as chosen. Never seen by
   * a collector, so `lastSyncedAt` stays null.
   */
  static addManual(id: string, input: ManualAccountInput): AccountEntity {
    const plan = findPlan(input.planId);
    if (plan?.provider !== input.provider) {
      throw new ArgumentInvalidException(`Plan ${input.planId} is not a ${input.provider} plan`);
    }
    const account = new AccountEntity({
      id,
      props: {
        userId: input.userId,
        provider: input.provider,
        externalId: `manual:${id}`,
        email: input.email,
        organization: null,
        reportedPlan: null,
        location: null,
        label: input.label,
        planId: input.planId,
        monthlyPriceCents: input.monthlyPriceCents,
        renewalDay: input.renewalDay,
        reportedRenewalDay: null,
        renewalCheckedAt: null,
        isActive: false,
        activatedAt: null,
        lastSyncedAt: null,
        archivedAt: null,
      },
    });
    account.validate();
    return account;
  }

  static create(create: CreateEntityProps<AccountProps>): AccountEntity {
    return new AccountEntity(create);
  }

  get userId() {
    return this.props.userId;
  }
  get provider() {
    return this.props.provider;
  }
  get externalId() {
    return this.props.externalId;
  }
  get email() {
    return this.props.email;
  }
  get organization() {
    return this.props.organization;
  }
  get reportedPlan() {
    return this.props.reportedPlan;
  }
  get location() {
    return this.props.location;
  }
  get label() {
    return this.props.label;
  }
  get planId() {
    return this.props.planId;
  }
  get monthlyPriceCents() {
    return this.props.monthlyPriceCents;
  }

  /** The day the person set, else the one the provider reports, else none. */
  get renewalDay(): number | null {
    return this.props.renewalDay ?? this.props.reportedRenewalDay;
  }
  /** True when the person set the billing day rather than taking the reported one. */
  get renewalDayOverridden(): boolean {
    return this.props.renewalDay !== null;
  }
  get reportedRenewalDay() {
    return this.props.reportedRenewalDay;
  }
  get renewalCheckedAt() {
    return this.props.renewalCheckedAt;
  }
  get isActive() {
    return this.props.isActive;
  }
  get activatedAt() {
    return this.props.activatedAt;
  }
  get lastSyncedAt() {
    return this.props.lastSyncedAt;
  }
  get archivedAt() {
    return this.props.archivedAt;
  }
  get isArchived() {
    return this.props.archivedAt !== null;
  }
  /** Added and tracked by hand: no collector reads it and no terminal switches to it. */
  get isManual(): boolean {
    return isManualProvider(this.props.provider);
  }

  /**
   * Hand-tracked, but the desktop app can read its usage, opt-in, from an
   * endpoint the vendor does not document (`UNOFFICIAL_USAGE_READERS`).
   */
  get hasUnofficialReader(): boolean {
    return unofficialUsageReader(this.props.provider) !== undefined;
  }

  /** The person's chosen plan, else the one the provider reports, else unknown. */
  get plan(): PlanDefinition | undefined {
    return findPlan(this.props.planId) ?? resolvePlan(this.props.provider, this.props.reportedPlan);
  }

  get effectivePriceCents(): number {
    return this.props.monthlyPriceCents ?? this.plan?.monthlyPriceCents ?? 0;
  }

  get displayName(): string {
    return this.props.label ?? this.props.email ?? this.props.externalId;
  }

  /** The collector saw this login again; identity follows what the provider says now. */
  recordSighting(sighting: Sighting): void {
    this.props.email = sighting.email ?? this.props.email;
    this.props.organization = sighting.organization ?? this.props.organization;
    this.props.reportedPlan = sighting.reportedPlan ?? this.props.reportedPlan;
    this.props.location = sighting.location ?? this.props.location;
    if (sighting.reportedRenewal) {
      this.props.reportedRenewalDay = sighting.reportedRenewal.day;
      this.props.renewalCheckedAt =
        sighting.reportedRenewal.checkedAt ?? this.props.renewalCheckedAt;
    }
    this.props.lastSyncedAt = sighting.at;
    this.setUpdatedAt(sighting.at);
  }

  edit(change: AccountEdit): void {
    if (change.planId !== undefined && change.planId !== null) {
      if (findPlan(change.planId)?.provider !== this.props.provider) {
        throw new ArgumentInvalidException(
          `Plan ${change.planId} is not a ${this.props.provider} plan`,
        );
      }
    }
    if (change.label !== undefined) this.props.label = change.label;
    if (change.planId !== undefined) this.props.planId = change.planId;
    if (change.monthlyPriceCents !== undefined)
      this.props.monthlyPriceCents = change.monthlyPriceCents;
    if (change.renewalDay !== undefined) this.props.renewalDay = change.renewalDay;
    this.setUpdatedAt();
    this.validate();
  }

  activate(at: Date): void {
    this.props.isActive = true;
    this.props.activatedAt = at;
    this.setUpdatedAt(at);
  }

  deactivate(): void {
    if (!this.props.isActive) return;
    this.props.isActive = false;
    this.setUpdatedAt();
  }

  /**
   * Stop tracking it. Archived rather than deleted so the next sync from a
   * machine that still has the login does not bring it straight back.
   */
  archive(at: Date): void {
    this.props.isActive = false;
    this.props.archivedAt = at;
    this.setUpdatedAt(at);
  }

  /** Tracking it again after an archive. */
  restore(): void {
    this.props.archivedAt = null;
    this.setUpdatedAt();
  }

  public validate(): void {
    if (!this.props.userId) throw new ArgumentNotProvidedException('Account userId is required');
    if (!this.props.externalId) {
      throw new ArgumentNotProvidedException('Account externalId is required');
    }
    if (this.props.monthlyPriceCents !== null && this.props.monthlyPriceCents < 0) {
      throw new ArgumentInvalidException('Account price cannot be negative');
    }
    if (this.isManual) {
      // Nothing reports a hand-tracked plan, so the person's choice is all there is.
      const plan = findPlan(this.props.planId);
      if (!plan) throw new ArgumentNotProvidedException('A hand-tracked account needs a plan');
      if (plan.monthlyPriceCents === null && this.props.monthlyPriceCents === null) {
        throw new ArgumentInvalidException(
          `Plan ${plan.id} has no published price; the account needs the one paid`,
        );
      }
    }
    for (const day of [this.props.renewalDay, this.props.reportedRenewalDay]) {
      if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) {
        throw new ArgumentInvalidException('Renewal day must be a day of the month, 1 to 31');
      }
    }
  }
}
