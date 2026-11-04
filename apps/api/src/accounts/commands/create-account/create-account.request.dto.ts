import { createAccountSchema } from '@flama/shared/schemas/accounts';
import { createZodDto } from 'nestjs-zod';

export class CreateAccountRequest extends createZodDto(createAccountSchema) {}
