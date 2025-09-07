import { 
    type Guild, 
    type User, 
    type VoiceChannel,
    type CategoryChannel,
    ChannelType,
    PermissionFlagsBits
} from 'discord.js';
import { MessageService } from './MessageService';

export interface TempVoiceChannel {
    id: string;
    ownerId: string;
    ownerTag: string;
    createdAt: Date;
    userLimit: number;
    cleanupTimer?: NodeJS.Timeout;
}

export class VoiceChannelService {
    private static instance: VoiceChannelService;
    private messageService: MessageService;
    private tempChannels: Map<string, TempVoiceChannel> = new Map();

    private constructor() {
        this.messageService = MessageService.getInstance();
    }

    public static getInstance(): VoiceChannelService {
        if (!VoiceChannelService.instance) {
            VoiceChannelService.instance = new VoiceChannelService();
        }
        return VoiceChannelService.instance;
    }

    public async createTempVoiceChannel(guild: Guild, user: User, userLimit: number): Promise<VoiceChannel | null> {
        try {
            const categoryId = process.env.VOICE_CATEGORY_ID;
            if (!categoryId) {
                throw new Error('VOICE_CATEGORY_ID not configured');
            }

            const category = guild.channels.cache.get(categoryId) as CategoryChannel;
            if (!category || category.type !== ChannelType.GuildCategory) {
                throw new Error('Voice category not found or invalid');
            }

            const channelName = this.messageService.getMessage('voice_channels.create.channel_name', {
                username: user.username
            });

            const voiceChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: category,
                userLimit: userLimit,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                            PermissionFlagsBits.UseVAD
                        ]
                    }
                ]
            });

            const tempChannel: TempVoiceChannel = {
                id: voiceChannel.id,
                ownerId: user.id,
                ownerTag: user.tag,
                createdAt: new Date(),
                userLimit: userLimit
            };

            this.tempChannels.set(voiceChannel.id, tempChannel);

            this.startChannelMonitoring(voiceChannel.id, guild);

            return voiceChannel;

        } catch (error) {
            console.error('Error creating temp voice channel:', error);
            return null;
        }
    }

    private startChannelMonitoring(channelId: string, guild: Guild): void {
        const checkInterval = setInterval(async () => {
            try {
                const channel = guild.channels.cache.get(channelId) as VoiceChannel;
                const tempChannel = this.tempChannels.get(channelId);

                if (!channel || !tempChannel) {
                    clearInterval(checkInterval);
                    this.tempChannels.delete(channelId);
                    return;
                }

                if (channel.members.size === 0) {
                    if (!tempChannel.cleanupTimer) {
                        tempChannel.cleanupTimer = setTimeout(async () => {
                            await this.deleteTempChannel(channelId, guild);
                        }, 60000); // 1 minuto
                    }
                } else {
                    if (tempChannel.cleanupTimer) {
                        clearTimeout(tempChannel.cleanupTimer);
                        tempChannel.cleanupTimer = undefined;
                    }
                }

            } catch (error) {
                console.error('Error monitoring voice channel:', error);
                clearInterval(checkInterval);
            }
        }, 10000); 
    }

    public async deleteTempChannel(channelId: string, guild: Guild): Promise<boolean> {
        try {
            const tempChannel = this.tempChannels.get(channelId);
            if (!tempChannel) return false;

            const channel = guild.channels.cache.get(channelId) as VoiceChannel;
            if (channel) {
                await channel.delete('Canal de voz temporal eliminado por inactividad');
                
                console.log(
                    this.messageService.getMessage('voice_channels.cleanup.deleted', {
                        channel: channel.name
                    })
                );
            }

            if (tempChannel.cleanupTimer) {
                clearTimeout(tempChannel.cleanupTimer);
            }

            this.tempChannels.delete(channelId);
            return true;

        } catch (error) {
            console.error('Error deleting temp voice channel:', error);
            return false;
        }
    }

    public isTempChannel(channelId: string): boolean {
        return this.tempChannels.has(channelId);
    }

    public getTempChannel(channelId: string): TempVoiceChannel | undefined {
        return this.tempChannels.get(channelId);
    }


    public validateUserLimit(limit: string): number | null {
        const num = parseInt(limit, 10);
        if (isNaN(num) || num < 1 || num > 99) {
            return null;
        }
        return num;
    }


    public getStats(): { activeChannels: number; totalCreated: number } {
        return {
            activeChannels: this.tempChannels.size,
            totalCreated: this.tempChannels.size // En memoria, no persistente
        };
    }

    public async cleanup(guild: Guild): Promise<void> {
        for (const channelId of this.tempChannels.keys()) {
            await this.deleteTempChannel(channelId, guild);
        }
    }
}
