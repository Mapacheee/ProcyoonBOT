import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { 
    type ButtonInteraction, 
    EmbedBuilder, 
    Colors,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type GuildMember,
    type TextChannel
} from 'discord.js';
import { TicketService } from '../services/TicketService';
import { SuggestionService } from '../services/SuggestionService';
import { VoiceChannelService } from '../services/VoiceChannelService';

@ApplyOptions<ListenerOptions>({
    event: Events.InteractionCreate
})
export class ButtonInteractionListener extends Listener<typeof Events.InteractionCreate> {
    public override async run(interaction: any) {
        if (!interaction.isButton()) return;

        const messageService = this.container.client.messageService;
        const ticketService = TicketService.getInstance();
        const suggestionService = SuggestionService.getInstance();
        
        if (interaction.customId.startsWith('vote_up_') || interaction.customId.startsWith('vote_down_')) {
            await this.handleSuggestionVote(interaction, suggestionService);
            return;
        }

        switch (interaction.customId) {
            case 'create_ticket':
                await this.handleCreateTicket(interaction, ticketService);
                break;
            case 'close_ticket':
                await this.handleCloseTicket(interaction, ticketService);
                break;
            case 'confirm_close_ticket':
                await this.handleConfirmCloseTicket(interaction, ticketService);
                break;
            case 'cancel_close_ticket':
                await this.handleCancelCloseTicket(interaction);
                break;
            case 'create_voice_channel':
                await this.handleCreateVoiceChannel(interaction);
                break;
            case 'cancel_close_ticket':
                await this.handleCancelCloseTicket(interaction);
                break;
        }
    }

    private async handleCreateTicket(interaction: ButtonInteraction, ticketService: TicketService) {
        const messageService = this.container.client.messageService;

        try {
            if (!interaction.guild) {
                await interaction.reply({
                    content: '❌ Los tickets solo pueden crearse en servidores.',
                    ephemeral: true
                });
                return;
            }

            if (ticketService.hasActiveTicket(interaction.user.id)) {
                const existingChannelId = ticketService.getUserTicketChannel(interaction.user.id);
                await interaction.reply({
                    content: messageService.getMessage('tickets.errors.already_exists') + 
                           (existingChannelId ? ` <#${existingChannelId}>` : ''),
                    ephemeral: true
                });
                return;
            }

            const ticketChannel = await ticketService.createTicket(interaction.guild, interaction.user);

            if (!ticketChannel) {
                await interaction.reply({
                    content: messageService.getMessage('tickets.errors.creation_failed'),
                    ephemeral: true
                });
                return;
            }

            await interaction.reply({
                content: messageService.getMessage('tickets.create.success_description', {
                    channel: ticketChannel.toString()
                }),
                ephemeral: true
            });

        } catch (error) {
            this.container.logger.error('Error creating ticket:', error);
            await interaction.reply({
                content: messageService.getMessage('tickets.errors.creation_failed'),
                ephemeral: true
            });
        }
    }

    private async handleCloseTicket(interaction: ButtonInteraction, ticketService: TicketService) {
        const messageService = this.container.client.messageService;

        try {
            if (!ticketService.isTicketChannel(interaction.channelId)) {
                await interaction.reply({
                    content: messageService.getMessage('tickets.errors.not_ticket_channel'),
                    ephemeral: true
                });
                return;
            }

            const confirmEmbed = new EmbedBuilder()
                .setColor(Colors.Orange)
                .setTitle(messageService.getMessage('tickets.close.confirm_title'))
                .setDescription(messageService.getMessage('tickets.close.confirm_description'));

            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm_close_ticket')
                .setLabel(messageService.getMessage('tickets.close.confirm_button'))
                .setStyle(ButtonStyle.Danger)
                .setEmoji('✅');

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_close_ticket')
                .setLabel(messageService.getMessage('tickets.close.cancel_button'))
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌');

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(confirmButton, cancelButton);

            await interaction.reply({
                embeds: [confirmEmbed],
                components: [row],
                ephemeral: true
            });

        } catch (error) {
            this.container.logger.error('Error handling close ticket:', error);
            await interaction.reply({
                content: messageService.getMessage('tickets.errors.close_failed'),
                ephemeral: true
            });
        }
    }

    private async handleConfirmCloseTicket(interaction: ButtonInteraction, ticketService: TicketService) {
        const messageService = this.container.client.messageService;

        try {
            if (!interaction.channel || !('delete' in interaction.channel)) {
                await interaction.reply({
                    content: messageService.getMessage('tickets.errors.close_failed'),
                    ephemeral: true
                });
                return;
            }

            const member = interaction.member as GuildMember;
            const channel = interaction.channel as TextChannel;
            const success = await ticketService.closeTicket(channel, member);

            if (success) {
                await interaction.update({
                    content: messageService.getMessage('tickets.close.success'),
                    embeds: [],
                    components: []
                });
            } else {
                await interaction.reply({
                    content: messageService.getMessage('tickets.errors.no_permissions'),
                    ephemeral: true
                });
            }

        } catch (error) {
            this.container.logger.error('Error confirming close ticket:', error);
            await interaction.reply({
                content: messageService.getMessage('tickets.errors.close_failed'),
                ephemeral: true
            });
        }
    }

    private async handleCancelCloseTicket(interaction: ButtonInteraction) {
        await interaction.update({
            content: '❌ Cierre de ticket cancelado.',
            embeds: [],
            components: []
        });
    }

    private async handleSuggestionVote(interaction: ButtonInteraction, suggestionService: SuggestionService) {
        try {
            if (!interaction.guild) {
                await interaction.reply({
                    content: '❌ Los votos solo pueden realizarse en servidores.',
                    ephemeral: true
                });
                return;
            }

            const [action, direction, suggestionId] = interaction.customId.split('_');
            const voteType = direction as 'up' | 'down';

            if (!suggestionService.hasSuggestion(suggestionId)) {
                await interaction.reply({
                    content: '❌ Esta sugerencia ya no está disponible para votar.',
                    ephemeral: true
                });
                return;
            }

            const success = await suggestionService.handleVote(
                suggestionId, 
                interaction.user.id, 
                voteType, 
                interaction.guild
            );

            if (success) {
                const emoji = voteType === 'up' ? '👍' : '👎';
                await interaction.reply({
                    content: `${emoji} Tu voto ha sido registrado exitosamente.`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ No se pudo registrar tu voto. Intenta de nuevo.',
                    ephemeral: true
                });
            }

        } catch (error) {
            this.container.logger.error('Error handling suggestion vote:', error);
            await interaction.reply({
                content: '❌ Error al procesar tu voto. Intenta de nuevo.',
                ephemeral: true
            });
        }
    }

    private async handleCreateVoiceChannel(interaction: ButtonInteraction) {
        const messageService = this.container.client.messageService;

        try {
            // Verificar que estamos en un servidor
            if (!interaction.guild) {
                await interaction.reply({
                    content: '❌ Los canales de voz solo pueden crearse en servidores.',
                    ephemeral: true
                });
                return;
            }

            // Verificar que la categoría esté configurada
            if (!process.env.VOICE_CATEGORY_ID) {
                await interaction.reply({
                    content: messageService.getMessage('voice_channels.errors.category_not_found'),
                    ephemeral: true
                });
                return;
            }

            // Crear modal para pedir el límite de usuarios
            const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
            
            const modal = new ModalBuilder()
                .setCustomId('voice_channel_modal')
                .setTitle(messageService.getMessage('voice_channels.create.modal_title'));

            const limitInput = new TextInputBuilder()
                .setCustomId('voice_user_limit')
                .setLabel(messageService.getMessage('voice_channels.create.limit_input_label'))
                .setPlaceholder(messageService.getMessage('voice_channels.create.limit_input_placeholder'))
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(2)
                .setMinLength(1);

            const row = new ActionRowBuilder<any>().addComponents(limitInput);
            modal.addComponents(row);

            await interaction.showModal(modal);

        } catch (error) {
            this.container.logger.error('Error showing voice channel modal:', error);
            await interaction.reply({
                content: messageService.getMessage('voice_channels.errors.creation_failed'),
                ephemeral: true
            });
        }
    }
}
