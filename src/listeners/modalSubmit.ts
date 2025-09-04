import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { type ModalSubmitInteraction, EmbedBuilder, Colors } from 'discord.js';
import { SuggestionService } from '../services/SuggestionService';

@ApplyOptions<ListenerOptions>({
    event: Events.InteractionCreate
})
export class ModalSubmitListener extends Listener<typeof Events.InteractionCreate> {
    public override async run(interaction: any) {
        if (!interaction.isModalSubmit()) return;

        const messageService = this.container.client.messageService;

        switch (interaction.customId) {
            case 'message_modal':
                await this.handleMessageModal(interaction);
                break;
            case 'suggestion_modal':
                await this.handleSuggestionModal(interaction);
                break;
        }
    }

    private async handleMessageModal(interaction: ModalSubmitInteraction) {
        const messageService = this.container.client.messageService;
        
        try {
            const messageContent = interaction.fields.getTextInputValue('message_content');

            const messageEmbed = new EmbedBuilder()
                .setDescription(messageContent)
                .setColor(Colors.Blue)
                .setFooter({ 
                    text: `Enviado por ${interaction.user.tag}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTimestamp();

            if (interaction.channel && 'send' in interaction.channel) {
                await interaction.channel.send({ embeds: [messageEmbed] });
            } else {
                throw new Error('Cannot send message to this channel type');
            }

            await interaction.reply({
                content: messageService.getMessage('messages.send.success'),
                ephemeral: true
            });

        } catch (error) {
            this.container.logger.error('Error sending message:', error);
            
            await interaction.reply({
                content: messageService.getMessage('messages.send.error'),
                ephemeral: true
            });
        }
    }

    private async handleSuggestionModal(interaction: ModalSubmitInteraction) {
        const messageService = this.container.client.messageService;
        const suggestionService = SuggestionService.getInstance();
        
        try {
            if (!interaction.guild) {
                await interaction.reply({
                    content: '❌ Las sugerencias solo pueden enviarse desde servidores.',
                    ephemeral: true
                });
                return;
            }

            const suggestionContent = interaction.fields.getTextInputValue('suggestion_content');

            const suggestionId = await suggestionService.createSuggestion(
                interaction.guild, 
                interaction.user, 
                suggestionContent
            );

            if (!suggestionId) {
                await interaction.reply({
                    content: messageService.getMessage('suggestions.errors.processing_error'),
                    ephemeral: true
                });
                return;
            }

            await interaction.reply({
                content: messageService.getMessage('suggestions.create.success_description'),
                ephemeral: true
            });

        } catch (error) {
            this.container.logger.error('Error creating suggestion:', error);
            
            await interaction.reply({
                content: messageService.getMessage('suggestions.errors.processing_error'),
                ephemeral: true
            });
        }
    }
}
