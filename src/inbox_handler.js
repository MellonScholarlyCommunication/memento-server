const fs = require('fs');
const fsPath = require('path');
const log4js = require('log4js');
const { backOff } = require('exponential-backoff');
const simpleGit = require('simple-git');
const crypto = require('crypto');
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

if (!process.env.MEMENTO_REPOSITORY) {
    logger.error('Need a MEMENTO_REPOSITORY');
    process.exit(2);
}

async function handleInbox(path,options) {
    logger.info(`[${path}]`);

    fs.readdir(path, (err,files) => {
        files.forEach( (file) => {
            const fullPath = `${path}/${file}`;
            if (file.match("^\\..*$")) {
                // Ignore
            }
            else if (file.match("^.*\\.jsonld$")) {
                // Process
                handleNotification(fullPath,options);
            }
            else {
                fs.unlinkSync(fullPath);
            }
        });
    });
}

async function handleNotification(path,options) {
    try {
        logger.info(`Processing ${path} ...`);
        const json = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8'}));
        const object = json['object']['id'];
        const actor_id = json['actor']['id'];
        const actor_inbox = json['actor']['inbox'];

        const body = await fetchOriginal(object);

        await storeMemento(object,body,actor_id);
    }
    catch (e) {
        logger.error(e);
        //moveToError(path);
    }
}

async function fetchOriginal(url) {
    logger.info(`Fetching ${url}...`);
    const response = await backOff_fetch(url, { method: 'GET' });

    if (!response.ok) {
        throw Error(`failed to fetch object ${url}`);
    }

    const body = await response.text();

    return body;
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

    if (fs.existsSync(repostoryPath)) {
        isNewFile = true;
    }

    fs.writeFileSync(repostoryPath,body);

    if (isNewFile) {
        logger.info(`git add ${repostoryPath}`);
        await git.add([repostoryPath]);
    }

    logger.info(`git commit ${repostoryPath}`);

    await git.commit(`offer from ${actor}`);

    return repostoryPath;
}

function moveToError(path) {
    const newPath = `./error/` + fsPath.basename(path);
    fs.rename(path, newPath, function (err) {
        if (err) throw err
        console.log(`${path} => ${newPath}`);
    });
}

async function backOff_fetch(url,options) {
    return await backOff( () => fetch(url,options) , {
        retry: (e,attempt) => {
            logger.warn(`attempt ${attempt} on ${url}`);
            return true;
        }
    });
}

module.exports = { handleInbox };