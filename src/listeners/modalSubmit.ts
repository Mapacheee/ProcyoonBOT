import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { type ModalSubmitInteraction, EmbedBuilder, Colors } from 'discord.js';

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
}
