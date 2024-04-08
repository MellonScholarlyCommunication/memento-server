const fs = require('fs');
const fsPath = require('path');
const logger = require('../lib/util.js').getLogger();
const { storeMemento , fetchOriginal } = require('../lib/util.js'); 

require('dotenv').config();

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

    const outboxFile = process.env.MEMENTO_OUTBOX + '/' + path.split('/').pop();

    try {
        const body = await fetchOriginal(object);

        const memento = await storeMemento(object,body,actor_id);

        logger.info(`storing Announce to ${outboxFile}`);

        fs.writeFileSync(outboxFile, JSON.stringify({
            '@context': [
                "https://www.w3.org/ns/activitystreams",
                { ietf: "https://www.iana.org/" }
            ],
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
        },null,2));
        fs.unlinkSync(path);
    }
    catch (e) {
        logger.error(e);

        logger.info(`storing Flag to ${outboxFile}`);

        fs.writeFileSync(outboxFile, JSON.stringify({ 
            '@context': [
                "https://www.w3.org/ns/activitystreams",
                { ietf: "https://www.iana.org/" }
            ],
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
        },null,2));

        moveToError(path);
    }
}

function moveToError(path) {
    const newPath = `./error/` + fsPath.basename(path);
    fs.rename(path, newPath, function (err) {
        if (err) throw err
        console.log(`${path} => ${newPath}`);
    });
}

module.exports = { handleInbox };