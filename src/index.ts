import './lib/setup';
import { ProcyoonBot } from './ProcyoonBot';

const client = new ProcyoonBot();

const main = async () => {
    try {
        client.logger.info('Logging in...');
        await client.login(process.env.DISCORD_TOKEN);
        client.logger.info('Logged in successfully!');
    } catch (error) {
        client.logger.fatal(error);
        client.destroy();
        process.exit(1);
    }
};

main();
