const fs = require('fs');
const { getLogger , backOff_fetch } = require('ldn-inbox-server');
const { storeMemento } = require('../lib/memento');
const { waybackCapture } = require('./wayback');
require('dotenv').config();

const logger = getLogger();

async function handle({path,options}) {
    logger.info(`Processing ${path} ...`);

    let json;

    try {
        json = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8'}));
    }
    catch (e) {
        logger.error(e);
        return { path, options, success: false };
    }
 
    const id = json['id'];
    const type = json['type'];

    if (type !== 'Offer') {
        logger.error(`Refused to process notification of type ${type}`);
        return { path, options, success: false };
    }

    const object = json['object']['id'];
    const actor_id = json['actor']['id'];
    const actor_type = json['actor']['type'];
    const actor_inbox = json['actor']['inbox'];

    const outboxFile = process.env.MEMENTO_OUTBOX + '/' + path.split('/').pop();

    try {
        const jsonResult = await createMemento(object,options);

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
            object: jsonResult,
            target: {
                id: actor_id ,
                type: actor_type ,
                inbox: actor_inbox
            }
        },null,2));
        return { path, options, success: true};
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

        return { path, options, success: false };
    }
}

async function createMemento(url,options) {
    const original = await fetchOriginal(url);

    if (options['wayback']) {
        return await waybackCapture(url, {
            'sleep': options['sleep'],
            'attemps': options['attemps'],
            'access_key': process.env.S3_ACCESS_KEY ,
            'secret_key': process.env.S3_SECRET_KEY
        });
    } 
    else {
        const memento = await storeMemento(url,original,option['actor_id']);
        return {
            'id': `${process.env.MEMENTO_BASEURL_TIMEMAP}${object}`,
            'type': 'Document',
            'ietf:original': object ,
            'ietf:memento': `${process.env.MEMENTO_BASEURL_MEMENTO}${object}/${memento.memento}`
        }
    }
}

async function fetchOriginal(url) {
    logger.info(`Fetching ${url}...`);
    
    const response = await backOff_fetch(url, { method: 'GET' });

    if (!response.ok) {
        logger.error(`Failed to fetch original ${url} [${response.status}]`);
        throw Error(`failed to fetch object ${url}`);
    }

    const contentType = response.headers.get('Content-Type');

    if (! contentType ) {
        throw new Error(`refusing data without content type`);
    }

    const body = await response.text();

    return {
        'content-type' : contentType ,
        body: body
    };
}

module.exports = { handle };