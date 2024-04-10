const fs = require('fs');
const { moveTo , fetchOriginal , getLogger } = require('ldn-inbox-server');
const { storeMemento } = require('../lib/memento');
require('dotenv').config();

const logger = getLogger();

async function notificationHandler(path,options) {
    logger.info(`Processing ${path} ...`);

    let json;

    try {
        json = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8'}));
    }
    catch (e) {
        logger.error(e);
        moveTo(path,options['error']); 
    }
 
    const id = json['id'];
    const type = json['type'];

    if (type !== 'Offer') {
        logger.error(`Refused to process notification of type ${type}`);
        moveTo(path,options['error']);
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
    }
}

module.exports = { notificationHandler };