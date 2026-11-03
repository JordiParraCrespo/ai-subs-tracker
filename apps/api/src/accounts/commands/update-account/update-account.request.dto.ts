import { updateAccountSchema } from '@flama/shared/schemas/accounts';
import { createZodDto } from 'nestjs-zod';

export class UpdateAccountRequest extends createZodDto(updateAccountSchema) {}
