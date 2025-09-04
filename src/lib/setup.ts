import { ApplicationCommandRegistries, RegisterBehavior } from '@sapphire/framework';
import '@sapphire/plugin-logger/register';
import * as colorette from 'colorette';
import { config } from 'dotenv';
import './types';

process.env.NODE_ENV ??= 'development';
ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);

config({ path: '.env' });
colorette.createColors({ useColor: true });
