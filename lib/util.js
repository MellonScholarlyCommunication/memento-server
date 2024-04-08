const fs = require('fs');
const crypto = require('crypto');
const simpleGit = require('simple-git');
const log4js = require('log4js');
const { backOff } = require('exponential-backoff');
require('dotenv').config();

const logger = getLogger();

function getLogger() {
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

    return logger;
}

async function fetchOriginal(url) {
    logger.info(`Fetching ${url}...`);
    const response = await backOff_fetch(url, { method: 'GET' });

    if (!response.ok) {
        logger.error(`Failed to fetch original ${url} [${response.status}]`);
        throw Error(`failed to fetch object ${url}`);
    }

    const body = await response.text();

    return body;
}

async function backOff_fetch(url,options) {
    return await backOff( () => fetch(url,options) , {
        retry: (e,attempt) => {
            logger.warn(`attempt ${attempt} on ${url}`);
            return true;
        }
    });
}

async function storeMemento(url, body, actor) {
    const checksum = crypto.createHash('sha256').update(url).digest('base64url');

    logger.info(`Writing ${url} to repository as ${checksum}`);

    const repostoryPath = process.env.MEMENTO_REPOSITORY + '/mementos/' + checksum;

    if (! fs.existsSync(process.env.MEMENTO_REPOSITORY + '/mementos/')) {
        fs.mkdirSync(process.env.MEMENTO_REPOSITORY + '/mementos/', { recursive: true});
    }

    const git = simpleGit({ baseDir: process.env.MEMENTO_REPOSITORY });

    let isNewFile = false;

    if (!fs.existsSync(repostoryPath)) {
        isNewFile = true;
    }

    fs.writeFileSync(repostoryPath,body);

    if (isNewFile) {
        logger.info(`git add ${repostoryPath}`);
        await git.add([repostoryPath]);
    }

    logger.info(`git commit ${repostoryPath}`);

    await git.commit(`offer from ${actor}`, [ repostoryPath ]);

    const file_log = await git.log({file: repostoryPath});

    let commit_hash ;

    if (file_log && file_log['all']?.length > 0 ) {
        commit_hash = file_log['all'][0]['hash'];
    }

    return { id: checksum , path: repostoryPath , memento: commit_hash };
}

module.exports = { storeMemento , getLogger , backOff_fetch , fetchOriginal };