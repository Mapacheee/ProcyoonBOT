import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { Client } from 'discord.js';
import { TicketService } from '../services/TicketService';
import { SuggestionService } from '../services/SuggestionService';
import { VoiceChannelService } from '../services/VoiceChannelService';

@ApplyOptions<ListenerOptions>({
    event: Events.ClientReady,
    once: true
})
export class ReadyListener extends Listener<typeof Events.ClientReady> {
    public override async run(client: Client<true>) {
        const { username, id } = client.user;
        const messageService = this.container.client.messageService;
        
        TicketService.getInstance();
        const suggestionService = SuggestionService.getInstance();
        VoiceChannelService.getInstance();
        
        this.container.logger.info(messageService.getMessage('general.bot_ready'));
        this.container.logger.info(`Logged in as ${username} (${id})`);
        this.container.logger.info(`Ready to serve ${client.guilds.cache.size} guild(s)`);
        
        for (const guild of client.guilds.cache.values()) {
            await suggestionService.restoreActiveSuggestions(guild);
        }
        
        this.container.logger.info('Active suggestions restored');
    }
}
