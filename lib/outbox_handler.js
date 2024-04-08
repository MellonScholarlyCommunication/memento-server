const fs = require('fs');
const log4js = require('log4js');
const { sendNotification } = require('ldn-inbox-server');
const { backOff_fetch } = require('../lib/util'); 
require('dotenv').config();

const logger = log4js.getLogger();

if (process.env.LOG4JS) {
    log4js.configure({
        appenders: {
          stderr: { type: 'stderr' }
        },
        categories: {
          default: { appenders: ['stderr'], level: process.env.LOG4JS }
        }
    });
}

async function handle_outbox(path,options) {
    logger.info(`[${path}]`);

    const processed = [];
    fs.readdir(path, async (err,files) => {
        for (let i = 0 ; i < files.length ; i++) {
            const file = files[i];

            if (! file.match(".*\.\..jsonld")) {
                continue;
            }

            logger.info(`Processing ${file}`);

            try {
                const notification = `${path}/${file}`;
                const json = fs.readFileSync(notification, { encoding: 'utf-8'});
                const data = JSON.parse(json);
                const type  = data['type'];
                const inbox = data['target']['inbox'];

                logger.info(`Sending ${type} to ${inbox}`);
                await sendNotification(inbox, data, { fetch: backOff_fetch });

                processed.push(notification);

                fs.unlinkSync(notification);
            }
            catch (e) {
                logger.error(e);
            }
        }
    });

    return processed;
}

module.exports = { handle_outbox };