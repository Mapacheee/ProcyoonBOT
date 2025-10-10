import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { 
    type ChatInputCommandInteraction, 
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    type ModalActionRowComponentBuilder,
    EmbedBuilder
} from 'discord.js';
import { SuggestionService } from '../services/SuggestionService';

@ApplyOptions<Command.Options>({
    description: 'Envía un mensaje personalizado en el canal actual'
})
export class MessageCommand extends Command {
    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            new SlashCommandBuilder()
                .setName('mensaje')
                .setDescription('Envía un mensaje personalizado en el canal actual'),
            {
                guildIds: process.env.GUILD_ID ? [process.env.GUILD_ID] : undefined
            }
        );
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
        const suggestionService = SuggestionService.getInstance();
        
        // Verificar que está en un servidor
        if (!interaction.guild) {
            await interaction.reply({
                content: messageService.getMessage('general.guild_only'),
                ephemeral: true
            });
            return;
        }

        // Verificar permisos de staff
        if (!suggestionService.hasStaffPermissions(interaction.guild, interaction.user.id)) {
            await interaction.reply({
                content: messageService.getMessage('messages.send.no_permissions'),
                ephemeral: true
            });
            return;
        }
        
        // Crear el modal
        const modal = new ModalBuilder()
            .setCustomId('message_modal')
            .setTitle(messageService.getMessage('messages.send.modal_title'));

        // Crear el input de texto
        const messageInput = new TextInputBuilder()
            .setCustomId('message_content')
            .setLabel(messageService.getMessage('messages.send.input_label'))
            .setPlaceholder(messageService.getMessage('messages.send.input_placeholder'))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(2000);

        // Crear la fila de acción
        const firstActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>()
            .addComponents(messageInput);

        // Añadir la fila al modal
        modal.addComponents(firstActionRow);

        // Mostrar el modal
        await interaction.showModal(modal);
    }
}
