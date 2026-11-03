import { syncAccountsSchema } from '@flama/shared/schemas/accounts';
import { createZodDto } from 'nestjs-zod';

export class SyncAccountsRequest extends createZodDto(syncAccountsSchema) {}
