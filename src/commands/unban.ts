import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { 
    type ChatInputCommandInteraction, 
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Desbanea a un usuario del servidor'
})
export class UnbanCommand extends Command {
    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            new SlashCommandBuilder()
                .setName('unban')
                .setDescription('Desbanea a un usuario del servidor')
                .addStringOption(option =>
                    option
                        .setName('userid')
                        .setDescription('ID del usuario a desbanear')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('razon')
                        .setDescription('Razón del desbaneo')
                        .setRequired(false)
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
            {
                guildIds: process.env.GUILD_ID ? [process.env.GUILD_ID] : undefined
            }
        );
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;

        try {
            if (!interaction.guild) {
                await interaction.reply({
                    content: messageService.getMessage('general.guild_only'),
                    ephemeral: true
                });
                return;
            }

            if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
                await interaction.reply({
                    content: messageService.getMessage('general.no_permission'),
                    ephemeral: true
                });
                return;
            }

            const userId = interaction.options.getString('userid', true);
            const reason = interaction.options.getString('razon') || 'No se especificó razón';

            if (!/^\d{17,19}$/.test(userId)) {
                await interaction.reply({
                    content: messageService.getMessage('unban.errors.invalid_id'),
                    ephemeral: true
                });
                return;
            }

            try {
                const banList = await interaction.guild.bans.fetch();
                const bannedUser = banList.get(userId);

                if (!bannedUser) {
                    await interaction.reply({
                        content: messageService.getMessage('unban.errors.user_not_banned'),
                        ephemeral: true
                    });
                    return;
                }

                await interaction.guild.members.unban(userId, `Desbaneado por ${interaction.user.tag} - ${reason}`);

                const unbanEmbed = new EmbedBuilder()
                    .setColor('#FF4F00')
                    .setTitle(messageService.getMessage('unban.success.title'))
                    .setDescription(messageService.getMessage('unban.success.description'))
                    .addFields([
                        {
                            name: messageService.getMessage('unban.fields.user'),
                            value: `${bannedUser.user.tag} (${bannedUser.user.id})`,
                            inline: true
                        },
                        {
                            name: messageService.getMessage('unban.fields.moderator'),
                            value: interaction.user.tag,
                            inline: true
                        },
                        {
                            name: messageService.getMessage('unban.fields.reason'),
                            value: reason,
                            inline: false
                        }
                    ])
                    .setThumbnail(bannedUser.user.displayAvatarURL())
                    .setFooter({
                        text: messageService.getMessage('unban.footer'),
                        iconURL: interaction.client.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await interaction.reply({
                    embeds: [unbanEmbed]
                });

            } catch (error) {
                console.error('Error fetching bans or unbanning:', error);
                await interaction.reply({
                    content: messageService.getMessage('unban.errors.fetch_failed'),
                    ephemeral: true
                });
            }

        } catch (error) {
            this.container.logger.error('Error in unban command:', error);
            await interaction.reply({
                content: messageService.getMessage('general.error_occurred'),
                ephemeral: true
            });
        }
    }
}