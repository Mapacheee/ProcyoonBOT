import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { 
    type ChatInputCommandInteraction, 
    SlashCommandBuilder,
    EmbedBuilder,
    Colors,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Administra el sistema de canales de voz temporales'
})
export class VoiceCommand extends Command {
    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            new SlashCommandBuilder()
                .setName('voice')
                .setDescription('Administra el sistema de canales de voz temporales')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('setup')
                        .setDescription('Configura el panel de canales de voz en el canal actual')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('stats')
                        .setDescription('Muestra estadísticas de los canales de voz temporales')
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
            {
                guildIds: process.env.GUILD_ID ? [process.env.GUILD_ID] : undefined
            }
        );
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'setup':
                await this.handleSetup(interaction);
                break;
            case 'stats':
                await this.handleStats(interaction);
                break;
        }
    }

    private async handleSetup(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;

        try {
            if (!process.env.VOICE_CATEGORY_ID) {
                await interaction.reply({
                    content: '❌ La categoría de canales de voz no está configurada. Agrega `VOICE_CATEGORY_ID` a las variables de entorno.',
                    ephemeral: true
                });
                return;
            }

            const voiceEmbed = new EmbedBuilder()
                .setColor(Colors.Purple)
                .setTitle(messageService.getMessage('voice_channels.setup.title'))
                .setDescription(messageService.getMessage('voice_channels.setup.description'))
                .setThumbnail(interaction.guild?.iconURL() || null)
                .setFooter({
                    text: 'Sistema de Canales de Voz - ProcyoonBOT',
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            const createVoiceButton = new ButtonBuilder()
                .setCustomId('create_voice_channel')
                .setLabel(messageService.getMessage('voice_channels.setup.button_label'))
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎤');

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(createVoiceButton);

            if (interaction.channel && 'send' in interaction.channel) {
                await interaction.channel.send({
                    embeds: [voiceEmbed],
                    components: [row]
                });
            } else {
                await interaction.reply({
                    content: '❌ No se puede configurar el sistema de canales de voz en este tipo de canal.',
                    ephemeral: true
                });
                return;
            }

            await interaction.reply({
                content: '✅ Sistema de canales de voz configurado exitosamente en este canal.',
                ephemeral: true
            });

        } catch (error) {
            this.container.logger.error('Error setting up voice channels:', error);
            await interaction.reply({
                content: messageService.getMessage('general.error_occurred'),
                ephemeral: true
            });
        }
    }

    private async handleStats(interaction: ChatInputCommandInteraction) {
        const { VoiceChannelService } = await import('../services/VoiceChannelService');
        const voiceService = VoiceChannelService.getInstance();
        const stats = voiceService.getStats();

        const statsEmbed = new EmbedBuilder()
            .setColor(Colors.Purple)
            .setTitle('📊 Estadísticas de Canales de Voz')
            .addFields([
                {
                    name: '🎤 Canales Activos',
                    value: stats.activeChannels.toString(),
                    inline: true
                },
                {
                    name: '📈 Total Creados',
                    value: stats.totalCreated.toString(),
                    inline: true
                }
            ])
            .setTimestamp();

        await interaction.reply({
            embeds: [statsEmbed],
            ephemeral: true
        });
    }
}
