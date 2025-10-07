import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import { 
    type Message
} from 'discord.js';
import { SuggestionService } from '../services/SuggestionService';

@ApplyOptions<Command.Options>({
    description: 'Rechaza una sugerencia con un ID específico',
    aliases: ['rechazar']
})
export class RejectCommand extends Command {
    public override async messageRun(message: Message, args: Args) {
        const messageService = this.container.client.messageService;
        const suggestionService = SuggestionService.getInstance();

        if (!message.guild) {
            await message.reply(messageService.getMessage('suggestions.errors.guild_only'));
            return;
        }

        if (!suggestionService.hasStaffPermissions(message.guild, message.author.id)) {
            await message.reply(messageService.getMessage('suggestions.errors.no_permissions'));
            return;
        }

        const suggestionId = await args.pick('string').catch(() => null);
        
        if (!suggestionId) {
            await message.reply(messageService.getMessage('suggestions.moderation.reject_usage'));
            return;
        }

        const reason = await args.rest('string').catch(() => null);
        
        if (!reason || reason.length < 5) {
            await message.reply(messageService.getMessage('suggestions.moderation.reject_reason'));
            return;
        }

        const suggestion = suggestionService.getSuggestion(suggestionId);
        if (!suggestion) {
            await message.reply(messageService.getMessage('suggestions.errors.not_found'));
            return;
        }

        if (suggestion.status !== 'pending') {
            await message.reply(messageService.getMessage('suggestions.errors.already_processed'));
            return;
        }

        const success = await suggestionService.rejectSuggestion(
            suggestionId, 
            message.author.id, 
            reason, 
            message.guild
        );

        if (success) {
            await message.reply(messageService.getMessage('suggestions.moderation.reject_success'));
        } else {
            await message.reply(messageService.getMessage('suggestions.errors.processing_error'));
        }
    }
}
