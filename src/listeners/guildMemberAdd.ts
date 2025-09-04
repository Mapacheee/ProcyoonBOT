import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { type GuildMember, type TextChannel } from 'discord.js';

@ApplyOptions<ListenerOptions>({
    event: Events.GuildMemberAdd
})
export class GuildMemberAddListener extends Listener<typeof Events.GuildMemberAdd> {
    public override async run(member: GuildMember) {
        const messageService = this.container.client.messageService;

        try {
            const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
            if (!welcomeChannelId) {
                this.container.logger.warn('WELCOME_CHANNEL_ID not configured - skipping welcome message');
                return;
            }

            const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId) as TextChannel;
            if (!welcomeChannel) {
                this.container.logger.warn(`Welcome channel with ID ${welcomeChannelId} not found`);
                return;
            }

            if (!('send' in welcomeChannel)) {
                this.container.logger.warn(`Welcome channel ${welcomeChannelId} is not a text channel`);
                return;
            }

            const welcomeMessage = messageService.getMessage('welcome.message', {
                user: member.toString()
            });

            await welcomeChannel.send(welcomeMessage);

            this.container.logger.info(
                `Welcome message sent for new member: ${member.user.tag} (${member.id}) in guild: ${member.guild.name}`
            );

        } catch (error) {
            this.container.logger.error('Error sending welcome message:', error);
        }
    }
}
