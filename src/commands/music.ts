import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { 
    type ChatInputCommandInteraction, 
    SlashCommandBuilder,
    EmbedBuilder,
    GuildMember
} from 'discord.js';
import { MusicService } from '../services/MusicService';

@ApplyOptions<Command.Options>({
    description: 'Reproduce música desde YouTube o Spotify'
})
export class MusicCommand extends Command {
    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(
            new SlashCommandBuilder()
                .setName('music')
                .setDescription('Sistema de música del bot')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('play')
                        .setDescription('Reproduce una canción desde YouTube o Spotify')
                        .addStringOption(option =>
                            option
                                .setName('query')
                                .setDescription('URL o nombre de la canción')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('skip')
                        .setDescription('Salta a la siguiente canción')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('stop')
                        .setDescription('Detiene la música y limpia la cola')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('pause')
                        .setDescription('Pausa la canción actual')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('resume')
                        .setDescription('Reanuda la canción pausada')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('queue')
                        .setDescription('Muestra la cola actual de canciones')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('nowplaying')
                        .setDescription('Muestra la canción que se está reproduciendo')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('loop')
                        .setDescription('Activa/desactiva el modo de repetición')
                        .addBooleanOption(option =>
                            option
                                .setName('enabled')
                                .setDescription('Activar o desactivar repetición')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('clear')
                        .setDescription('Limpia la cola de canciones')
                ),
            {
                guildIds: process.env.GUILD_ID ? [process.env.GUILD_ID] : undefined
            }
        );
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'play':
                await this.handlePlay(interaction);
                break;
            case 'skip':
                await this.handleSkip(interaction);
                break;
            case 'stop':
                await this.handleStop(interaction);
                break;
            case 'pause':
                await this.handlePause(interaction);
                break;
            case 'resume':
                await this.handleResume(interaction);
                break;
            case 'queue':
                await this.handleQueue(interaction);
                break;
            case 'nowplaying':
                await this.handleNowPlaying(interaction);
                break;
            case 'loop':
                await this.handleLoop(interaction);
                break;
            case 'clear':
                await this.handleClear(interaction);
                break;
        }
    }

    private async handlePlay(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
        const musicService = MusicService.getInstance();

        try {
            if (!interaction.guild) {
                await interaction.reply({
                    content: messageService.getMessage('general.guild_only'),
                    ephemeral: true
                });
                return;
            }

            const member = interaction.member as GuildMember;
            const voiceChannel = member.voice.channel;

            if (!voiceChannel) {
                await interaction.reply({
                    content: messageService.getMessage('music.errors.not_in_voice'),
                    ephemeral: true
                });
                return;
            }

            const query = interaction.options.getString('query', true);

            await interaction.deferReply();

            const song = await musicService.play(
                interaction.guild,
                voiceChannel,
                interaction.channel,
                query,
                interaction.user.tag
            );

            if (!song) {
                await interaction.editReply({
                    content: messageService.getMessage('music.errors.song_not_found')
                });
                return;
            }

            const queue = musicService.getQueue(interaction.guild.id);
            const isFirstSong = queue && queue.songs.length === 0 && queue.playing;

            const embed = new EmbedBuilder()
                .setColor('#FF4F00')
                .setTitle(isFirstSong ? messageService.getMessage('music.play.now_playing') : messageService.getMessage('music.play.added_to_queue'))
                .setDescription(`**[${song.title}](${song.url})**`)
                .addFields([
                    {
                        name: messageService.getMessage('music.play.duration'),
                        value: this.formatDuration(song.duration),
                        inline: true
                    },
                    {
                        name: messageService.getMessage('music.play.requested_by'),
                        value: song.requestedBy,
                        inline: true
                    },
                    {
                        name: messageService.getMessage('music.play.source'),
                        value: song.type === 'youtube' ? 'YouTube' : 'Spotify',
                        inline: true
                    }
                ])
                .setThumbnail(song.thumbnail)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            this.container.logger.error('Error playing music:', error);
            await interaction.reply({
                content: messageService.getMessage('general.error_occurred'),
                ephemeral: true
            });
        }
    }

    private async handleSkip(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
        const musicService = MusicService.getInstance();

        if (!interaction.guild) {
            await interaction.reply({
                content: messageService.getMessage('general.guild_only'),
                ephemeral: true
            });
            return;
        }

        const success = musicService.skip(interaction.guild.id);

        if (success) {
            await interaction.reply({
                content: messageService.getMessage('music.skip.success'),
                ephemeral: false
            });
        } else {
            await interaction.reply({
                content: messageService.getMessage('music.errors.nothing_playing'),
                ephemeral: true
            });
        }
    }

    private async handleStop(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
        const musicService = MusicService.getInstance();

        if (!interaction.guild) {
            await interaction.reply({
                content: messageService.getMessage('general.guild_only'),
                ephemeral: true
            });
            return;
        }

        const success = musicService.stop(interaction.guild.id);

        if (success) {
            await interaction.reply({
                content: messageService.getMessage('music.stop.success'),
                ephemeral: false
            });
        } else {
            await interaction.reply({
                content: messageService.getMessage('music.errors.nothing_playing'),
                ephemeral: true
            });
        }
    }

    private async handlePause(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
        const musicService = MusicService.getInstance();

        if (!interaction.guild) {
            await interaction.reply({
                content: messageService.getMessage('general.guild_only'),
                ephemeral: true
            });
            return;
        }

        const success = musicService.pause(interaction.guild.id);

        if (success) {
            await interaction.reply({
                content: messageService.getMessage('music.pause.success'),
                ephemeral: false
            });
        } else {
            await interaction.reply({
                content: messageService.getMessage('music.errors.nothing_playing'),
                ephemeral: true
            });
        }
    }

    private async handleResume(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
        const musicService = MusicService.getInstance();

        if (!interaction.guild) {
            await interaction.reply({
                content: messageService.getMessage('general.guild_only'),
                ephemeral: true
            });
            return;
        }

        const success = musicService.resume(interaction.guild.id);

        if (success) {
            await interaction.reply({
                content: messageService.getMessage('music.resume.success'),
                ephemeral: false
            });
        } else {
            await interaction.reply({
                content: messageService.getMessage('music.errors.not_paused'),
                ephemeral: true
            });
        }
    }

    private async handleQueue(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
        const musicService = MusicService.getInstance();

        if (!interaction.guild) {
            await interaction.reply({
                content: messageService.getMessage('general.guild_only'),
                ephemeral: true
            });
            return;
        }

        const queue = musicService.getQueue(interaction.guild.id);

        if (!queue || (!queue.currentSong && queue.songs.length === 0)) {
            await interaction.reply({
                content: messageService.getMessage('music.queue.empty'),
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#FF4F00')
            .setTitle(messageService.getMessage('music.queue.title'))
            .setTimestamp();

        if (queue.currentSong) {
            embed.addFields([{
                name: messageService.getMessage('music.queue.now_playing'),
                value: `**[${queue.currentSong.title}](${queue.currentSong.url})**\n${messageService.getMessage('music.play.requested_by')}: ${queue.currentSong.requestedBy}`,
                inline: false
            }]);
        }

        if (queue.songs.length > 0) {
            const upNext = queue.songs.slice(0, 10).map((song, index) => 
                `**${index + 1}.** [${song.title}](${song.url}) - ${song.requestedBy}`
            ).join('\n');

            embed.addFields([{
                name: messageService.getMessage('music.queue.up_next', {
                    count: queue.songs.length.toString()
                }),
                value: upNext,
                inline: false
            }]);
        }

        await interaction.reply({ embeds: [embed] });
    }

    private async handleNowPlaying(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
        const musicService = MusicService.getInstance();

        if (!interaction.guild) {
            await interaction.reply({
                content: messageService.getMessage('general.guild_only'),
                ephemeral: true
            });
            return;
        }

        const queue = musicService.getQueue(interaction.guild.id);

        if (!queue || !queue.currentSong) {
            await interaction.reply({
                content: messageService.getMessage('music.errors.nothing_playing'),
                ephemeral: true
            });
            return;
        }

        const song = queue.currentSong;

        const embed = new EmbedBuilder()
            .setColor('#FF4F00')
            .setTitle(messageService.getMessage('music.nowplaying.title'))
            .setDescription(`**[${song.title}](${song.url})**`)
            .addFields([
                {
                    name: messageService.getMessage('music.play.duration'),
                    value: this.formatDuration(song.duration),
                    inline: true
                },
                {
                    name: messageService.getMessage('music.play.requested_by'),
                    value: song.requestedBy,
                    inline: true
                },
                {
                    name: messageService.getMessage('music.nowplaying.loop'),
                    value: queue.loop ? '🔁 Activado' : '▶️ Desactivado',
                    inline: true
                }
            ])
            .setThumbnail(song.thumbnail)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    private async handleLoop(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
        const musicService = MusicService.getInstance();

        if (!interaction.guild) {
            await interaction.reply({
                content: messageService.getMessage('general.guild_only'),
                ephemeral: true
            });
            return;
        }

        const enabled = interaction.options.getBoolean('enabled', true);
        const success = musicService.setLoop(interaction.guild.id, enabled);

        if (success) {
            await interaction.reply({
                content: enabled 
                    ? messageService.getMessage('music.loop.enabled')
                    : messageService.getMessage('music.loop.disabled'),
                ephemeral: false
            });
        } else {
            await interaction.reply({
                content: messageService.getMessage('music.errors.nothing_playing'),
                ephemeral: true
            });
        }
    }

    private async handleClear(interaction: ChatInputCommandInteraction) {
        const messageService = this.container.client.messageService;
        const musicService = MusicService.getInstance();

        if (!interaction.guild) {
            await interaction.reply({
                content: messageService.getMessage('general.guild_only'),
                ephemeral: true
            });
            return;
        }

        const success = musicService.clearQueue(interaction.guild.id);

        if (success) {
            await interaction.reply({
                content: messageService.getMessage('music.clear.success'),
                ephemeral: false
            });
        } else {
            await interaction.reply({
                content: messageService.getMessage('music.queue.empty'),
                ephemeral: true
            });
        }
    }

    private formatDuration(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}
