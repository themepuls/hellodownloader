import { validateEnv } from '@hellodownloader/config';

export const env = validateEnv(process.env);
