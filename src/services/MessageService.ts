import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { join } from 'path';

export class MessageService {
    private static instance: MessageService;
    private messages: any;

    private constructor() {
        this.loadMessages();
    }

    public static getInstance(): MessageService {
        if (!MessageService.instance) {
            MessageService.instance = new MessageService();
        }
        return MessageService.instance;
    }

    private loadMessages(): void {
        try {
            const messagesPath = join(process.cwd(), 'config', 'messages.yml');
            const fileContent = readFileSync(messagesPath, 'utf8');
            this.messages = load(fileContent);
        } catch (error) {
            console.error('Error loading messages.yml:', error);
            throw new Error('Failed to load messages configuration');
        }
    }

    public getMessage(path: string, variables?: Record<string, string>): string {
        const keys = path.split('.');
        let message = this.messages;

        for (const key of keys) {
            if (message && typeof message === 'object' && key in message) {
                message = message[key];
            } else {
                console.warn(`Message path not found: ${path}`);
                return `[Missing message: ${path}]`;
            }
        }

        if (typeof message !== 'string') {
            console.warn(`Message at path ${path} is not a string`);
            return `[Invalid message type: ${path}]`;
        }

        return this.replaceVariables(message, variables);
    }

    private replaceVariables(message: string, variables?: Record<string, string>): string {
        if (!variables) return message;

        let result = message;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
        return result;
    }

    public getMessageCategory(categoryPath: string): Record<string, any> {
        const keys = categoryPath.split('.');
        let category = this.messages;

        for (const key of keys) {
            if (category && typeof category === 'object' && key in category) {
                category = category[key];
            } else {
                console.warn(`Category path not found: ${categoryPath}`);
                return {};
            }
        }

        return category || {};
    }

    public reloadMessages(): void {
        this.loadMessages();
    }

    public hasMessage(path: string): boolean {
        const keys = path.split('.');
        let message = this.messages;

        for (const key of keys) {
            if (message && typeof message === 'object' && key in message) {
                message = message[key];
            } else {
                return false;
            }
        }

        return typeof message === 'string';
    }
}
