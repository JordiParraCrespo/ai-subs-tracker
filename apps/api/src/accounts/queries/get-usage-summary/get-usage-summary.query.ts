import { QueryBase } from '@flama/backend-ddd';

export class GetUsageSummaryQuery extends QueryBase {
  readonly userId: string;
  readonly days: number;

  constructor(userId: string, days: number) {
    super();
    this.userId = userId;
    this.days = days;
  }
}
