import { 
    type Guild, 
    type User, 
    type TextChannel,
    type Message,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors
} from 'discord.js';
import { MessageService } from './MessageService';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface Suggestion {
    id: string;
    authorId: string;
    authorTag: string;
    content: string;
    messageId: string;
    channelId: string;
    createdAt: Date;
    status: 'pending' | 'approved' | 'rejected';
    votes: {
        up: string[];
        down: string[];
    };
    moderatedBy?: string;
    moderationReason?: string;
}

export class SuggestionService {
    private static instance: SuggestionService;
    private messageService: MessageService;
    private suggestions: Map<string, Suggestion> = new Map();
    private suggestionCounter: number = 1;
    private readonly dataFilePath: string;

    private constructor() {
        this.messageService = MessageService.getInstance();
        this.dataFilePath = join(process.cwd(), 'data', 'suggestions.json');
        this.loadSuggestions();
    }

    public static getInstance(): SuggestionService {
        if (!SuggestionService.instance) {
            SuggestionService.instance = new SuggestionService();
        }
        return SuggestionService.instance;
    }

    public async createSuggestion(guild: Guild, user: User, content: string): Promise<string | null> {
        try {
            const suggestionChannelId = process.env.SUGGESTIONS_CHANNEL_ID;
            if (!suggestionChannelId) {
                throw new Error('SUGGESTIONS_CHANNEL_ID not configured');
            }

            const channel = guild.channels.cache.get(suggestionChannelId) as TextChannel;
            if (!channel) {
                throw new Error('Suggestions channel not found');
            }

            const suggestionId = this.generateSuggestionId();

            const suggestionEmbed = new EmbedBuilder()
                .setColor('#FF4F00')
                .setAuthor({
                    name: this.messageService.getMessage('suggestions.embed.author_text'),
                    iconURL: user.displayAvatarURL()
                })
                .setTitle(this.messageService.getMessage('suggestions.embed.title', {
                    user: user.tag
                }))
                .setDescription(this.messageService.getMessage('suggestions.embed.description', {
                    suggestion: content
                }))
                .setFooter({
                    text: this.messageService.getMessage('suggestions.embed.footer', {
                        id: suggestionId
                    })
                })
                .setTimestamp();

            const upvoteButton = new ButtonBuilder()
                .setCustomId(`vote_up_${suggestionId}`)
                .setEmoji(this.messageService.getMessage('suggestions.embed.vote_up'))
                .setStyle(ButtonStyle.Success)
                .setLabel('0');

            const downvoteButton = new ButtonBuilder()
                .setCustomId(`vote_down_${suggestionId}`)
                .setEmoji(this.messageService.getMessage('suggestions.embed.vote_down'))
                .setStyle(ButtonStyle.Danger)
                .setLabel('0');

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(upvoteButton, downvoteButton);

            const message = await channel.send({
                embeds: [suggestionEmbed],
                components: [row]
            });

            const suggestion: Suggestion = {
                id: suggestionId,
                authorId: user.id,
                authorTag: user.tag,
                content: content,
                messageId: message.id,
                channelId: channel.id,
                createdAt: new Date(),
                status: 'pending',
                votes: {
                    up: [],
                    down: []
                }
            };

            this.suggestions.set(suggestionId, suggestion);
            this.saveSuggestions(); // Guardar después de crear
            return suggestionId;

        } catch (error) {
            console.error('Error creating suggestion:', error);
            return null;
        }
    }

    public async handleVote(suggestionId: string, userId: string, voteType: 'up' | 'down', guild: Guild): Promise<boolean> {
        try {
            const suggestion = this.suggestions.get(suggestionId);
            if (!suggestion || suggestion.status !== 'pending') {
                return false;
            }

            suggestion.votes.up = suggestion.votes.up.filter(id => id !== userId);
            suggestion.votes.down = suggestion.votes.down.filter(id => id !== userId);

            suggestion.votes[voteType].push(userId);

            await this.updateSuggestionMessage(suggestion, guild);
            this.saveSuggestions(); // Guardar después de votar
            return true;

        } catch (error) {
            console.error('Error handling vote:', error);
            return false;
        }
    }


    public async approveSuggestion(suggestionId: string, moderatorId: string, reason: string, guild: Guild): Promise<boolean> {
        return this.moderateSuggestion(suggestionId, moderatorId, reason, 'approved', guild);
    }

    public async rejectSuggestion(suggestionId: string, moderatorId: string, reason: string, guild: Guild): Promise<boolean> {
        return this.moderateSuggestion(suggestionId, moderatorId, reason, 'rejected', guild);
    }

    private async moderateSuggestion(
        suggestionId: string, 
        moderatorId: string, 
        reason: string, 
        status: 'approved' | 'rejected',
        guild: Guild
    ): Promise<boolean> {
        try {
            const suggestion = this.suggestions.get(suggestionId);
            if (!suggestion || suggestion.status !== 'pending') {
                return false;
            }

            suggestion.status = status;
            suggestion.moderatedBy = moderatorId;
            suggestion.moderationReason = reason;

            await this.deleteOriginalMessage(suggestion, guild);

            await this.sendSuggestionResult(suggestion, guild);

            this.saveSuggestions(); // Guardar después de moderar
            return true;

        } catch (error) {
            console.error('Error moderating suggestion:', error);
            return false;
        }
    }

    private async updateSuggestionMessage(suggestion: Suggestion, guild: Guild): Promise<void> {
        try {
            const channel = guild.channels.cache.get(suggestion.channelId) as TextChannel;
            if (!channel) return;

            const message = await channel.messages.fetch(suggestion.messageId);
            if (!message) return;

            const upvoteButton = new ButtonBuilder()
                .setCustomId(`vote_up_${suggestion.id}`)
                .setEmoji(this.messageService.getMessage('suggestions.embed.vote_up'))
                .setStyle(ButtonStyle.Success)
                .setLabel(suggestion.votes.up.length.toString());

            const downvoteButton = new ButtonBuilder()
                .setCustomId(`vote_down_${suggestion.id}`)
                .setEmoji(this.messageService.getMessage('suggestions.embed.vote_down'))
                .setStyle(ButtonStyle.Danger)
                .setLabel(suggestion.votes.down.length.toString());

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(upvoteButton, downvoteButton);

            await message.edit({ components: [row] });

        } catch (error) {
            console.error('Error updating suggestion message:', error);
        }
    }

    private async deleteOriginalMessage(suggestion: Suggestion, guild: Guild): Promise<void> {
        try {
            const channel = guild.channels.cache.get(suggestion.channelId) as TextChannel;
            if (!channel) return;

            const message = await channel.messages.fetch(suggestion.messageId);
            if (message) {
                await message.delete();
            }
        } catch (error) {
            console.error('Error deleting original message:', error);
        }
    }

    private async sendSuggestionResult(suggestion: Suggestion, guild: Guild): Promise<void> {
        try {
            const resultsChannelId = process.env.SUGGESTIONS_RESULTS_CHANNEL_ID;
            if (!resultsChannelId) return;

            const channel = guild.channels.cache.get(resultsChannelId) as TextChannel;
            if (!channel) return;

            const moderator = await guild.members.fetch(suggestion.moderatedBy!);
            const author = await guild.members.fetch(suggestion.authorId);

            const isApproved = suggestion.status === 'approved';
            const title = isApproved ? 
                this.messageService.getMessage('suggestions.results.approved_title') :
                this.messageService.getMessage('suggestions.results.rejected_title');

            const color = isApproved ? 
                parseInt(this.messageService.getMessage('suggestions.results.approved_color'), 16) :
                parseInt(this.messageService.getMessage('suggestions.results.rejected_color'), 16);

            const resultEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(this.messageService.getMessage('suggestions.results.original_suggestion', {
                    suggestion: suggestion.content
                }))
                .addFields([
                    {
                        name: this.messageService.getMessage('suggestions.results.author_field'),
                        value: author.user.tag,
                        inline: true
                    },
                    {
                        name: this.messageService.getMessage('suggestions.results.decision_by_field'),
                        value: moderator.user.tag,
                        inline: true
                    },
                    {
                        name: this.messageService.getMessage('suggestions.results.votes_field'),
                        value: `👍 ${suggestion.votes.up.length} | 👎 ${suggestion.votes.down.length}`,
                        inline: true
                    },
                    {
                        name: this.messageService.getMessage('suggestions.results.reason_field'),
                        value: suggestion.moderationReason || 'Sin motivo especificado',
                        inline: false
                    }
                ])
                .setFooter({
                    text: `ID: ${suggestion.id}`,
                    iconURL: guild.iconURL() || undefined
                })
                .setTimestamp();

            await channel.send({ embeds: [resultEmbed] });

        } catch (error) {
            console.error('Error sending suggestion result:', error);
        }
    }

    private generateSuggestionId(): string {
        const id = this.suggestionCounter.toString().padStart(4, '0');
        this.suggestionCounter++;
        return id;
    }

    public hasSuggestion(suggestionId: string): boolean {
        return this.suggestions.has(suggestionId);
    }

    public getSuggestion(suggestionId: string): Suggestion | undefined {
        return this.suggestions.get(suggestionId);
    }

    public hasStaffPermissions(guild: Guild, userId: string): boolean {
        const member = guild.members.cache.get(userId);
        if (!member) return false;

        const staffRoleIds = process.env.STAFF_ROLE_IDS?.split(',').map(id => id.trim()) || [];
        return staffRoleIds.some(roleId => member.roles.cache.has(roleId));
    }

    public getStats(): { total: number; pending: number; approved: number; rejected: number } {
        const suggestions = Array.from(this.suggestions.values());
        return {
            total: suggestions.length,
            pending: suggestions.filter(s => s.status === 'pending').length,
            approved: suggestions.filter(s => s.status === 'approved').length,
            rejected: suggestions.filter(s => s.status === 'rejected').length
        };
    }

    private loadSuggestions(): void {
        try {
            const dataDir = join(process.cwd(), 'data');
            if (!existsSync(dataDir)) {
                const { mkdirSync } = require('fs');
                mkdirSync(dataDir, { recursive: true });
            }

            if (existsSync(this.dataFilePath)) {
                const fileContent = readFileSync(this.dataFilePath, 'utf-8');
                const data = JSON.parse(fileContent);
                
                if (data.suggestions) {
                    for (const [id, suggestion] of Object.entries(data.suggestions)) {
                        this.suggestions.set(id, suggestion as Suggestion);
                    }
                }
                
                if (data.counter) {
                    this.suggestionCounter = data.counter;
                }
                
                console.log(`Loaded ${this.suggestions.size} suggestions from file`);
            } else {
                console.log('No suggestions file found, starting fresh');
            }
        } catch (error) {
            console.error('Error loading suggestions:', error);
            console.log('Starting with empty suggestions');
        }
    }

    private saveSuggestions(): void {
        try {
            const data = {
                suggestions: Object.fromEntries(this.suggestions),
                counter: this.suggestionCounter,
                lastUpdated: new Date().toISOString()
            };

            writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving suggestions:', error);
        }
    }

    public async restoreActiveSuggestions(guild: Guild): Promise<void> {
        try {
            const pendingSuggestions = Array.from(this.suggestions.values())
                .filter(s => s.status === 'pending');

            console.log(`Restoring ${pendingSuggestions.length} active suggestions`);

            for (const suggestion of pendingSuggestions) {
                try {
                    const channel = guild.channels.cache.get(suggestion.channelId) as TextChannel;
                    if (!channel) continue;

                    const message = await channel.messages.fetch(suggestion.messageId).catch(() => null);
                    if (!message) {
                        this.suggestions.delete(suggestion.id);
                        continue;
                    }

                    await this.updateSuggestionMessage(suggestion, guild);
                } catch (error) {
                    console.error(`Error restoring suggestion ${suggestion.id}:`, error);
                }
            }

            this.saveSuggestions();
        } catch (error) {
            console.error('Error restoring active suggestions:', error);
        }
    }
}
