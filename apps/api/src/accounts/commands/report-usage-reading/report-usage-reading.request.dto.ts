import { reportUsageReadingSchema } from '@flama/shared/schemas/accounts';
import { createZodDto } from 'nestjs-zod';

export class ReportUsageReadingRequest extends createZodDto(reportUsageReadingSchema) {}
