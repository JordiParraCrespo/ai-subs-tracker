import { ApiProperty } from '@nestjs/swagger';

export class TokenTotalsResponseDto {
  @ApiProperty()
  input!: number;

  @ApiProperty()
  output!: number;

  @ApiProperty()
  cacheWrite!: number;

  @ApiProperty()
  cacheRead!: number;

  @ApiProperty()
  messages!: number;

  @ApiProperty({ description: 'What these tokens would cost at API prices, US cents' })
  apiCostCents!: number;
}

export class ModelUsageResponseDto extends TokenTotalsResponseDto {
  @ApiProperty()
  model!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Readable name when the model is priced',
  })
  label!: string | null;
}

export class AccountUsageResponseDto extends TokenTotalsResponseDto {
  @ApiProperty()
  accountId!: string;
}

export class DailyUsageResponseDto extends TokenTotalsResponseDto {
  @ApiProperty({ example: '2026-11-02' })
  day!: string;
}

export class UsageSummaryResponseDto {
  @ApiProperty()
  days!: number;

  @ApiProperty({ example: '2026-10-04' })
  since!: string;

  @ApiProperty({ type: TokenTotalsResponseDto })
  totals!: TokenTotalsResponseDto;

  @ApiProperty({ type: [ModelUsageResponseDto] })
  byModel!: ModelUsageResponseDto[];

  @ApiProperty({ type: [AccountUsageResponseDto] })
  byAccount!: AccountUsageResponseDto[];

  @ApiProperty({ type: [DailyUsageResponseDto] })
  daily!: DailyUsageResponseDto[];
}
