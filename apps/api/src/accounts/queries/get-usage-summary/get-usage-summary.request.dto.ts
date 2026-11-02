import { usageSummaryQuerySchema } from '@flama/shared/schemas/accounts';
import { createZodDto } from 'nestjs-zod';

export class GetUsageSummaryRequest extends createZodDto(usageSummaryQuerySchema) {}
