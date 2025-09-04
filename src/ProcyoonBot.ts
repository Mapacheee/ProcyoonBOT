import { SapphireClient, ApplicationCommandRegistries, RegisterBehavior, LogLevel } from '@sapphire/framework';
import { GatewayIntentBits, Partials } from 'discord.js';
import { MessageService } from './services/MessageService';

export class ProcyoonBot extends SapphireClient {
    public messageService: MessageService;

    public constructor() {
        super({
            defaultPrefix: '!',
            regexPrefix: /^(hey +)?bot[,! ]/i,
            caseInsensitiveCommands: true,
            logger: {
                level: LogLevel.Debug
            },
            shards: 'auto',
            intents: [
                GatewayIntentBits.DirectMessageReactions,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.GuildEmojisAndStickers,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.MessageContent
            ],
            partials: [Partials.Channel],
            loadMessageCommandListeners: true
        });

        this.messageService = MessageService.getInstance();
    }

    public override async login(token?: string) {
        ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);
        
        return super.login(token);
    }

    public override async destroy() {
        return super.destroy();
    }
}
