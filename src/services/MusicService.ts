import {
    AudioPlayer,
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    VoiceConnection,
    VoiceConnectionStatus,
    joinVoiceChannel,
    DiscordGatewayAdapterCreator
} from '@discordjs/voice';
import { Guild, VoiceBasedChannel } from 'discord.js';
import * as play from 'play-dl';

export interface Song {
    title: string;
    url: string;
    duration: number;
    thumbnail: string;
    requestedBy: string;
    type: 'youtube' | 'spotify';
}

export interface MusicQueue {
    textChannel: any;
    voiceChannel: VoiceBasedChannel;
    connection: VoiceConnection;
    player: AudioPlayer;
    songs: Song[];
    volume: number;
    playing: boolean;
    loop: boolean;
    currentSong: Song | null;
}

export class MusicService {
    private static instance: MusicService;
    private queues: Map<string, MusicQueue>;

    private constructor() {
        this.queues = new Map();
    }

    public static getInstance(): MusicService {
        if (!MusicService.instance) {
            MusicService.instance = new MusicService();
        }
        return MusicService.instance;
    }

    public async play(
        guild: Guild,
        voiceChannel: VoiceBasedChannel,
        textChannel: any,
        query: string,
        requestedBy: string
    ): Promise<Song | null> {
        let queue = this.queues.get(guild.id);

        const song = await this.searchSong(query, requestedBy);
        if (!song) return null;

        if (!queue) {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
            });

            const player = createAudioPlayer();

            queue = {
                textChannel,
                voiceChannel,
                connection,
                player,
                songs: [],
                volume: 100,
                playing: false,
                loop: false,
                currentSong: null
            };

            this.queues.set(guild.id, queue);

            connection.subscribe(player);

            player.on(AudioPlayerStatus.Idle, () => {
                this.playNext(guild.id);
            });

            player.on('error', error => {
                console.error('Audio player error:', error);
                this.playNext(guild.id);
            });
        }

        queue.songs.push(song);

        if (!queue.playing) {
            this.playNext(guild.id);
        }

        return song;
    }

    private async searchSong(query: string, requestedBy: string): Promise<Song | null> {
        try {
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                return await this.getYouTubeInfo(query, requestedBy);
            } else if (query.includes('spotify.com')) {
                return await this.getSpotifyInfo(query, requestedBy);
            } else {
                const searched = await play.search(query, { limit: 1 });
                if (searched.length === 0) return null;
                return await this.getYouTubeInfo(searched[0].url, requestedBy);
            }
        } catch (error) {
            console.error('Error searching song:', error);
            return null;
        }
    }

    private async getYouTubeInfo(url: string, requestedBy: string): Promise<Song | null> {
        try {
            const info = await play.video_info(url);
            const video = info.video_details;

            return {
                title: video.title || 'Unknown Title',
                url: video.url,
                duration: video.durationInSec,
                thumbnail: video.thumbnails[0]?.url || '',
                requestedBy,
                type: 'youtube'
            };
        } catch (error) {
            console.error('Error getting YouTube info:', error);
            return null;
        }
    }

    private async getSpotifyInfo(url: string, requestedBy: string): Promise<Song | null> {
        try {
            const spotifyInfo = await play.spotify(url);
            
            if (spotifyInfo && 'name' in spotifyInfo) {
                const track = spotifyInfo as any;
                const searchQuery = `${track.name} ${track.artists?.[0]?.name || ''}`;
                const searched = await play.search(searchQuery, { limit: 1 });
                
                if (searched.length === 0) return null;
                
                return {
                    title: `${track.name} - ${track.artists?.[0]?.name || 'Unknown'}`,
                    url: searched[0].url,
                    duration: track.durationInSec || 0,
                    thumbnail: track.thumbnail?.url || '',
                    requestedBy,
                    type: 'spotify'
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error getting Spotify info:', error);
            return null;
        }
    }

    private async playNext(guildId: string) {
        const queue = this.queues.get(guildId);
        if (!queue) return;

        if (queue.loop && queue.currentSong) {
            queue.songs.unshift(queue.currentSong);
        }

        if (queue.songs.length === 0) {
            queue.playing = false;
            queue.currentSong = null;
            return;
        }

        const song = queue.songs.shift()!;
        queue.currentSong = song;
        queue.playing = true;

        try {
            const stream = await play.stream(song.url);
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type
            });

            queue.player.play(resource);
            await entersState(queue.player, AudioPlayerStatus.Playing, 5000);
        } catch (error) {
            console.error('Error playing song:', error);
            this.playNext(guildId);
        }
    }

    public skip(guildId: string): boolean {
        const queue = this.queues.get(guildId);
        if (!queue || !queue.playing) return false;

        queue.player.stop();
        return true;
    }

    public stop(guildId: string): boolean {
        const queue = this.queues.get(guildId);
        if (!queue) return false;

        queue.songs = [];
        queue.player.stop();
        queue.connection.destroy();
        this.queues.delete(guildId);
        return true;
    }

    public pause(guildId: string): boolean {
        const queue = this.queues.get(guildId);
        if (!queue || !queue.playing) return false;

        return queue.player.pause();
    }

    public resume(guildId: string): boolean {
        const queue = this.queues.get(guildId);
        if (!queue) return false;

        return queue.player.unpause();
    }

    public setLoop(guildId: string, loop: boolean): boolean {
        const queue = this.queues.get(guildId);
        if (!queue) return false;

        queue.loop = loop;
        return true;
    }

    public getQueue(guildId: string): MusicQueue | undefined {
        return this.queues.get(guildId);
    }

    public clearQueue(guildId: string): boolean {
        const queue = this.queues.get(guildId);
        if (!queue) return false;

        queue.songs = [];
        return true;
    }
}
