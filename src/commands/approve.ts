import { ApplyOptions } from '@sapphire/decorators';
import { Args, Command } from '@sapphire/framework';
import { 
    type Message,
    type TextChannel
} from 'discord.js';
import { SuggestionService } from '../services/SuggestionService';

@ApplyOptions<Command.Options>({
    description: 'Aprueba una sugerencia con un ID específico',
    aliases: ['approve']
})
export class ApproveCommand extends Command {
    public override async messageRun(message: Message, args: Args) {
        const messageService = this.container.client.messageService;
        const suggestionService = SuggestionService.getInstance();

        if (!message.guild) {
            await message.reply('❌ Este comando solo puede usarse en servidores.');
            return;
        }

        if (!suggestionService.hasStaffPermissions(message.guild, message.author.id)) {
            await message.reply(messageService.getMessage('suggestions.errors.no_permissions'));
            return;
        }

        const suggestionId = await args.pick('string').catch(() => null);
        
        if (!suggestionId) {
            await message.reply('❌ Debes especificar el ID de la sugerencia.\n**Uso:** `!aprobar <ID> <motivo>`\n**Ejemplo:** `!aprobar 0001 Esta sugerencia mejorará la experiencia del servidor`');
            return;
        }

        const reason = await args.rest('string').catch(() => null);
        
        if (!reason || reason.length < 5) {
            await message.reply('❌ Debes especificar un motivo de al menos 5 caracteres.\n**Uso:** `!aprobar <ID> <motivo>`\n**Ejemplo:** `!aprobar 0001 Esta sugerencia mejorará la experiencia del servidor`');
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

        const success = await suggestionService.approveSuggestion(
            suggestionId, 
            message.author.id, 
            reason, 
            message.guild
        );

        if (success) {
            await message.reply(messageService.getMessage('suggestions.moderation.approve_success'));
        } else {
            await message.reply(messageService.getMessage('suggestions.errors.processing_error'));
        }
    }
}
