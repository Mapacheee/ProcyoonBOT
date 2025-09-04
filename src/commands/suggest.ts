import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { 
    type ChatInputCommandInteraction, 
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    type ModalActionRowComponentBuilder
} from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Envía una sugerencia para que la comunidad pueda votar'
})
export class SuggestCommand extends Command {
    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            new SlashCommandBuilder()
                .setName('sugerir')
                .setDescription('Envía una sugerencia para que la comunidad pueda votar'),
            {
                guildIds: process.env.GUILD_ID ? [process.env.GUILD_ID] : undefined
            }
        );
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
        
        if (!process.env.SUGGESTIONS_CHANNEL_ID) {
            await interaction.reply({
                content: messageService.getMessage('suggestions.errors.channel_not_configured'),
                ephemeral: true
            });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId('suggestion_modal')
            .setTitle(messageService.getMessage('suggestions.create.modal_title'));

        const suggestionInput = new TextInputBuilder()
            .setCustomId('suggestion_content')
            .setLabel(messageService.getMessage('suggestions.create.input_label'))
            .setPlaceholder(messageService.getMessage('suggestions.create.input_placeholder'))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000)
            .setMinLength(10);

        const firstActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>()
            .addComponents(suggestionInput);

        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    }
}
