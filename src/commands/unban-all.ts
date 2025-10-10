import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { 
    type ChatInputCommandInteraction, 
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ButtonInteraction,
    ComponentType
} from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Desbanea a TODOS los usuarios baneados del servidor (Solo Administradores)'
})
export class UnbanAllCommand extends Command {
    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            new SlashCommandBuilder()
                .setName('unban-all')
                .setDescription('Desbanea a TODOS los usuarios baneados del servidor (Solo Administradores)')
                .addStringOption(option =>
                    option
                        .setName('razon')
                        .setDescription('Razón del desbaneo masivo')
                        .setRequired(false)
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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

            // Verificar permisos de administrador
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({
                    content: messageService.getMessage('unban_all.errors.admin_only'),
                    ephemeral: true
                });
                return;
            }

            const reason = interaction.options.getString('razon') || 'Desbaneo masivo realizado por administrador';

            // Obtener lista de usuarios baneados
            let banList;
            try {
                banList = await interaction.guild.bans.fetch();
            } catch (error) {
                await interaction.reply({
                    content: messageService.getMessage('unban_all.errors.fetch_failed'),
                    ephemeral: true
                });
                return;
            }

            // Si no hay usuarios baneados
            if (banList.size === 0) {
                await interaction.reply({
                    content: messageService.getMessage('unban_all.no_banned_users'),
                    ephemeral: true
                });
                return;
            }

            // Crear embed de confirmación
            const confirmEmbed = new EmbedBuilder()
                .setColor('#FF4F00')
                .setTitle(messageService.getMessage('unban_all.confirm.title'))
                .setDescription(messageService.getMessage('unban_all.confirm.description', {
                    count: banList.size.toString(),
                    reason: reason
                }))
                .addFields([
                    {
                        name: messageService.getMessage('unban_all.confirm.users_field'),
                        value: banList.size > 10 
                            ? `${Array.from(banList.values()).slice(0, 10).map(ban => `• ${ban.user.tag}`).join('\n')}\n**... y ${banList.size - 10} más**`
                            : Array.from(banList.values()).map(ban => `• ${ban.user.tag}`).join('\n') || 'Ninguno',
                        inline: false
                    },
                    {
                        name: messageService.getMessage('unban_all.confirm.moderator_field'),
                        value: interaction.user.tag,
                        inline: true
                    }
                ])
                .setFooter({
                    text: messageService.getMessage('unban_all.confirm.warning'),
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            // Crear botones de confirmación
            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm_unban_all')
                .setLabel(messageService.getMessage('unban_all.buttons.confirm'))
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚠️');

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_unban_all')
                .setLabel(messageService.getMessage('unban_all.buttons.cancel'))
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌');

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(confirmButton, cancelButton);

            const response = await interaction.reply({
                embeds: [confirmEmbed],
                components: [row],
                ephemeral: true
            });

            // Esperar confirmación
            try {
                const confirmation = await response.awaitMessageComponent({ 
                    componentType: ComponentType.Button, 
                    time: 60000,
                    filter: (i) => i.user.id === interaction.user.id
                });

                if (confirmation.customId === 'cancel_unban_all') {
                    await confirmation.update({
                        content: messageService.getMessage('unban_all.cancelled'),
                        embeds: [],
                        components: []
                    });
                    return;
                }

                if (confirmation.customId === 'confirm_unban_all') {
                    await this.executeUnbanAll(confirmation, banList, reason, messageService);
                }

            } catch (error) {
                await interaction.editReply({
                    content: messageService.getMessage('unban_all.timeout'),
                    embeds: [],
                    components: []
                });
            }

        } catch (error) {
            this.container.logger.error('Error in unban-all command:', error);
            await interaction.reply({
                content: messageService.getMessage('general.error_occurred'),
                ephemeral: true
            });
        }
    }

    private async executeUnbanAll(
        interaction: ButtonInteraction, 
        banList: any, 
        reason: string, 
        messageService: any
    ) {
        await interaction.update({
            content: messageService.getMessage('unban_all.processing'),
            embeds: [],
            components: []
        });

        const unbannedUsers: string[] = [];
        const failedUsers: string[] = [];
        const totalUsers = banList.size;

        // Procesar desbaneos con límite de velocidad
        let processed = 0;
        for (const [userId, ban] of banList) {
            try {
                await interaction.guild!.members.unban(userId, `Desbaneo masivo por ${interaction.user.tag} - ${reason}`);
                unbannedUsers.push(ban.user.tag);
                processed++;

                // Actualizar progreso cada 5 usuarios
                if (processed % 5 === 0) {
                    await interaction.editReply({
                        content: messageService.getMessage('unban_all.progress', {
                            current: processed.toString(),
                            total: totalUsers.toString()
                        })
                    });
                }

                // Pequeña pausa para evitar rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                failedUsers.push(ban.user.tag);
                this.container.logger.error(`Failed to unban ${ban.user.tag}:`, error);
            }
        }

        // Crear embed de resultados
        const resultEmbed = new EmbedBuilder()
            .setColor('#FF4F00')
            .setTitle(messageService.getMessage('unban_all.results.title'))
            .setDescription(messageService.getMessage('unban_all.results.description'))
            .addFields([
                {
                    name: messageService.getMessage('unban_all.results.success_field'),
                    value: `${unbannedUsers.length}/${totalUsers}`,
                    inline: true
                },
                {
                    name: messageService.getMessage('unban_all.results.failed_field'),
                    value: failedUsers.length.toString(),
                    inline: true
                },
                {
                    name: messageService.getMessage('unban_all.results.moderator_field'),
                    value: interaction.user.tag,
                    inline: true
                }
            ]);

        if (failedUsers.length > 0 && failedUsers.length <= 10) {
            resultEmbed.addFields([{
                name: messageService.getMessage('unban_all.results.failed_users_field'),
                value: failedUsers.join('\n'),
                inline: false
            }]);
        }

        resultEmbed
            .setFooter({
                text: messageService.getMessage('unban_all.results.footer'),
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.editReply({
            content: '',
            embeds: [resultEmbed]
        });
    }
}