import { 
    type Guild, 
    type User, 
    type GuildMember,
    type TextChannel,
    type CategoryChannel,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    Colors,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { MessageService } from './MessageService';

export class TicketService {
    private static instance: TicketService;
    private messageService: MessageService;
    private activeTickets: Map<string, string> = new Map(); // userId -> channelId

    private constructor() {
        this.messageService = MessageService.getInstance();
    }

    public static getInstance(): TicketService {
        if (!TicketService.instance) {
            TicketService.instance = new TicketService();
        }
        return TicketService.instance;
    }

    public hasActiveTicket(userId: string): boolean {
        return this.activeTickets.has(userId);
    }

    public getUserTicketChannel(userId: string): string | undefined {
        return this.activeTickets.get(userId);
    }

    public async createTicket(guild: Guild, user: User): Promise<TextChannel | null> {
        try {
            if (this.hasActiveTicket(user.id)) {
                return null;
            }

            const categoryId = process.env.TICKET_CATEGORY_ID;
            if (!categoryId) {
                throw new Error('TICKET_CATEGORY_ID not configured');
            }

            const category = guild.channels.cache.get(categoryId) as CategoryChannel;
            if (!category || category.type !== ChannelType.GuildCategory) {
                throw new Error('Ticket category not found or invalid');
            }

            const channelName = this.messageService.getMessage('tickets.create.channel_name', {
                username: user.username.toLowerCase().replace(/[^a-z0-9]/g, '')
            });

            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    },
                    ...this.getStaffPermissionOverwrites(guild)
                ]
            });

            this.activeTickets.set(user.id, ticketChannel.id);

            await this.sendWelcomeMessage(ticketChannel, user);

            return ticketChannel;

        } catch (error) {
            console.error('Error creating ticket:', error);
            return null;
        }
    }

    private async sendWelcomeMessage(channel: TextChannel, user: User): Promise<void> {
        const welcomeEmbed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('🎫 Ticket de Soporte')
            .setDescription(this.messageService.getMessage('tickets.create.welcome_message', {
                user: user.toString()
            }))
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp()
            .setFooter({
                text: `Ticket creado por ${user.tag}`,
                iconURL: user.displayAvatarURL()
            });

        const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel(this.messageService.getMessage('tickets.close.button_label'))
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(closeButton);

        await channel.send({
            content: user.toString(),
            embeds: [welcomeEmbed],
            components: [row]
        });
    }

    public async closeTicket(channel: TextChannel, closedBy: GuildMember): Promise<boolean> {
        try {
            const ticketOwnerId = Array.from(this.activeTickets.entries())
                .find(([, channelId]) => channelId === channel.id)?.[0];

            if (!ticketOwnerId) {
                return false;
            }

            const canClose = ticketOwnerId === closedBy.id || 
                           closedBy.permissions.has(PermissionFlagsBits.ManageChannels);

            if (!canClose) {
                return false;
            }

            const closingEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('🔒 Cerrando Ticket')
                .setDescription(this.messageService.getMessage('tickets.close.closing_message'))
                .setFooter({
                    text: `Cerrado por ${closedBy.user.tag}`,
                    iconURL: closedBy.user.displayAvatarURL()
                })
                .setTimestamp();

            await channel.send({ embeds: [closingEmbed] });

            this.activeTickets.delete(ticketOwnerId);

            setTimeout(async () => {
                try {
                    await channel.delete('Ticket cerrado');
                } catch (error) {
                    console.error('Error deleting ticket channel:', error);
                }
            }, 5000);

            return true;

        } catch (error) {
            console.error('Error closing ticket:', error);
            return false;
        }
    }

    public isTicketChannel(channelId: string): boolean {
        return Array.from(this.activeTickets.values()).includes(channelId);
    }

    public async addStaffRoleToTickets(guild: Guild, roleId: string): Promise<void> {
        try {
            for (const channelId of this.activeTickets.values()) {
                const channel = guild.channels.cache.get(channelId) as TextChannel;
                if (channel) {
                    await channel.permissionOverwrites.create(roleId, {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true,
                        ManageMessages: true,
                        AttachFiles: true,
                        EmbedLinks: true
                    });
                }
            }
        } catch (error) {
            console.error('Error adding staff role to tickets:', error);
        }
    }

    private getStaffPermissionOverwrites(guild: Guild) {
        const staffRoleIds = process.env.STAFF_ROLE_IDS?.split(',').map(id => id.trim()) || [];
        
        return staffRoleIds
            .filter(roleId => guild.roles.cache.has(roleId))
            .map(roleId => ({
                id: roleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.UseExternalEmojis
                ]
            }));
    }

    public getTicketStats(): { activeTickets: number } {
        return {
            activeTickets: this.activeTickets.size
        };
    }
}
