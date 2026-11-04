import { type AccountResponseDto, heyApiSdk } from '@flama/api-client';
import { MapApiError } from '@flama/frontend-core';
import type {
  CreateAccountInput,
  RecordUsageInput,
  UpdateAccountInput,
} from '@flama/shared/schemas/accounts';
import { injectable } from 'inversify';
import { AccountEntity, type UsageSummary } from './accounts.entity';
import { AccountsErrors } from './accounts.errors';

function toAccount(data: AccountResponseDto): AccountEntity {
  return new AccountEntity(
    data.id,
    data.provider,
    data.externalId,
    data.displayName,
    data.label,
    data.email,
    data.organization,
    data.location,
    data.reportedPlan,
    data.planId,
    data.planName,
    data.planOverridden,
    data.monthlyPriceCents,
    data.priceOverridden,
    data.renewalDay,
    data.isActive,
    data.lastSyncedAt ? new Date(data.lastSyncedAt) : null,
    new Date(data.createdAt),
    data.latest
      ? {
          capturedAt: new Date(data.latest.capturedAt),
          source: data.latest.source,
          status: data.latest.status,
          message: data.latest.message,
          windows: data.latest.windows,
          extraUsage: data.latest.extraUsage,
        }
      : null,
    data.weeklyPeaks.map((peak) => ({
      resetsAt: new Date(peak.resetsAt),
      peakUtilization: peak.peakUtilization,
    })),
  );
}

@injectable()
export class AccountsRepository {
  @MapApiError(AccountsErrors.FETCH_FAILED)
  async list(): Promise<AccountEntity[]> {
    const { data } = await heyApiSdk.listAccounts({ throwOnError: true });
    return data.map(toAccount);
  }

  @MapApiError(AccountsErrors.CREATE_FAILED)
  async create(input: CreateAccountInput): Promise<AccountEntity> {
    const { data } = await heyApiSdk.createAccount({ body: input, throwOnError: true });
    return toAccount(data);
  }

  @MapApiError(AccountsErrors.RECORD_USAGE_FAILED)
  async recordUsage(id: string, input: RecordUsageInput): Promise<AccountEntity> {
    const { data } = await heyApiSdk.recordAccountUsage({
      path: { id },
      body: input,
      throwOnError: true,
    });
    return toAccount(data);
  }

  @MapApiError(AccountsErrors.UPDATE_FAILED)
  async update(id: string, input: UpdateAccountInput): Promise<AccountEntity> {
    const { data } = await heyApiSdk.updateAccount({
      path: { id },
      body: input,
      throwOnError: true,
    });
    return toAccount(data);
  }

  @MapApiError(AccountsErrors.ACTIVATE_FAILED)
  async activate(id: string): Promise<AccountEntity[]> {
    const { data } = await heyApiSdk.activateAccount({ path: { id }, throwOnError: true });
    return data.map(toAccount);
  }

  @MapApiError(AccountsErrors.ARCHIVE_FAILED)
  async archive(id: string): Promise<void> {
    await heyApiSdk.archiveAccount({ path: { id }, throwOnError: true });
  }

  @MapApiError(AccountsErrors.USAGE_FAILED)
  async usage(days: number): Promise<UsageSummary> {
    const { data } = await heyApiSdk.getUsageSummary({ query: { days }, throwOnError: true });
    return data;
  }
}
