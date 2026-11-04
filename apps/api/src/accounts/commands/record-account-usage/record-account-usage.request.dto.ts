import { recordUsageSchema } from '@flama/shared/schemas/accounts';
import { createZodDto } from 'nestjs-zod';

export class RecordAccountUsageRequest extends createZodDto(recordUsageSchema) {}
