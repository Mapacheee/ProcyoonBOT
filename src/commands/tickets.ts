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
    description: 'Administra el sistema de tickets del servidor'
})
export class TicketsCommand extends Command {
    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            new SlashCommandBuilder()
                .setName('tickets')
                .setDescription('Administra el sistema de tickets del servidor')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('setup')
                        .setDescription('Configura el mensaje de tickets en el canal actual')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('stats')
                        .setDescription('Muestra estadísticas del sistema de tickets')
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
            {
                guildIds: process.env.GUILD_ID ? [process.env.GUILD_ID] : undefined
            }
        );
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
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
            if (!process.env.TICKET_CATEGORY_ID) {
                await interaction.reply({
                    content: '❌ La categoría de tickets no está configurada. Agrega `TICKET_CATEGORY_ID` a las variables de entorno.',
                    ephemeral: true
                });
                return;
            }

            const ticketEmbed = new EmbedBuilder()
                .setColor(Colors.Blue)
                .setTitle(messageService.getMessage('tickets.setup.title'))
                .setDescription(messageService.getMessage('tickets.setup.description'))
                .setThumbnail(interaction.guild?.iconURL() || null)
                .setFooter({
                    text: 'Sistema de Tickets - ProcyoonBOT',
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            const createTicketButton = new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel(messageService.getMessage('tickets.setup.button_label'))
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫');

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(createTicketButton);

            if (interaction.channel && 'send' in interaction.channel) {
                await interaction.channel.send({
                    embeds: [ticketEmbed],
                    components: [row]
                });
            } else {
                await interaction.reply({
                    content: '❌ No se puede configurar el sistema de tickets en este tipo de canal.',
                    ephemeral: true
                });
                return;
            }

            await interaction.reply({
                content: '✅ Sistema de tickets configurado exitosamente en este canal.',
                ephemeral: true
            });

        } catch (error) {
            this.container.logger.error('Error setting up tickets:', error);
            await interaction.reply({
                content: messageService.getMessage('general.error_occurred'),
                ephemeral: true
            });
        }
    }

    private async handleStats(interaction: ChatInputCommandInteraction) {
        const { TicketService } = await import('../services/TicketService');
        const ticketService = TicketService.getInstance();
        const stats = ticketService.getTicketStats();

        const statsEmbed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('📊 Estadísticas de Tickets')
            .addFields([
                {
                    name: '🎫 Tickets Activos',
                    value: stats.activeTickets.toString(),
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
