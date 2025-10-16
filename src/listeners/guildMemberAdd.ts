import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { type GuildMember, type TextChannel, EmbedBuilder } from 'discord.js';

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

            const welcomeEmbed = new EmbedBuilder()
                .setColor('#FF4F00')
                .setTitle(messageService.getMessage('welcome.embed.title'))
                .setDescription(messageService.getMessage('welcome.embed.description', {
                    user: member.toString()
                }))
                .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                .addFields(
                    {
                        name: messageService.getMessage('welcome.embed.member_count', {
                            count: member.guild.memberCount.toString()
                        }),
                        value: '\u200B',
                        inline: false
                    },
                    {
                        name: messageService.getMessage('welcome.embed.joined_at'),
                        value: `<t:${Math.floor(member.joinedTimestamp! / 1000)}:F>`,
                        inline: true
                    },
                    {
                        name: messageService.getMessage('welcome.embed.account_created'),
                        value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: messageService.getMessage('welcome.embed.footer'),
                    iconURL: member.guild.iconURL() ?? undefined
                })
                .setTimestamp();

            await welcomeChannel.send({
                embeds: [welcomeEmbed]
            });

            this.container.logger.info(
                `Welcome message sent for new member: ${member.user.tag} (${member.id}) in guild: ${member.guild.name}`
            );

        } catch (error) {
            this.container.logger.error('Error sending welcome message:', error);
        }
    }
}
