import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { Client } from 'discord.js';

@ApplyOptions<ListenerOptions>({
    event: Events.ClientReady,
    once: true
})
export class ReadyListener extends Listener<typeof Events.ClientReady> {
    public override run(client: Client<true>) {
        const { username, id } = client.user;
        const messageService = this.container.client.messageService;
        
        this.container.logger.info(messageService.getMessage('general.bot_ready'));
        this.container.logger.info(`Logged in as ${username} (${id})`);
    }
}
