import type { MessageService } from '../services/MessageService';

declare module '@sapphire/framework' {
    interface SapphireClient {
        messageService: MessageService;
    }
}
