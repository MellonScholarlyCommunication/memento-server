const fs = require('fs');
const fsPath = require('path');
const log4js = require('log4js');
const { backOff } = require('exponential-backoff');
const simpleGit = require('simple-git');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
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
    logger.info(`Processing ${path} ...`);
    let json;
    try {
        json = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8'}));
    }
    catch (e) {
        logger.error(e);
        moveToError(path); 
    }
 
    const id = json['id'];
    const type = json['type'];

    if (type !== 'Offer') {
        logger.error(`Refused to process notification of type ${type}`);
        moveToError(path);
    }

    const object = json['object']['id'];
    const actor_id = json['actor']['id'];
    const actor_type = json['actor']['type'];
    const actor_inbox = json['actor']['inbox'];

    try {
        const body = await fetchOriginal(object);

        const memento = await storeMemento(object,body,actor_id);

        await sendNotification(actor_inbox,{
            type: 'Announce',
            actor: {
                id: process.env.MEMENTO_ACTOR_ID ,
                inbox: process.env.MEMENTO_ACTOR_INBOX ,
                type: 'Service'
            },
            context: object,
            inReplyTo: id ,
            object: {
                id: `${process.env.MEMENTO_BASEURL_TIMEMAP}${object}`,
                type: 'Document',
                'ietf:original': object ,
                'ietf:memento': `${process.env.MEMENTO_BASEURL_MEMENTO}${object}/${memento.memento}`
            },
            target: {
                id: actor_id ,
                type: actor_type ,
                inbox: actor_inbox
            }
        });
        // fs.unlinkSync(path);
    }
    catch (e) {
        logger.error(e);

        await sendNotification(actor_inbox, {
            type: 'Flag',
            actor: {
                id: process.env.MEMENTO_ACTOR_ID ,
                inbox: process.env.MEMENTO_ACTOR_INBOX ,
                type: 'Service'
            },
            summary: 'We cannot process your object',
            context: object,
            inReplyTo: id ,
            object: json['object'],
            target: {
                id: actor_id ,
                type: actor_type ,
                inbox: actor_inbox
            }
        });

        moveToError(path);
    }
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

async function sendNotification(url,json) {
    logger.info(`Sending to ${url}...`);

    if (!json['@context']) {
        json['@context'] = [
            "https://www.w3.org/ns/activitystreams",
            { ietf: "https://www.iana.org/" }
        ];
    }

    if (!json['id']) {
        json['id'] = 'urn:uuid:' + uuidv4();
    }

    logger.debug(JSON.stringify(json,null,2));
    
    const response = await backOff_fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(json)
    });

    if (! response.ok) {
        logger.error(`Failed to post to ${url} [${response.status}]`);
        throw Error(`failed to POST to ${url}`);
    }

    return true;
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