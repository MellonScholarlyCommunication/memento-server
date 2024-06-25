/**
 * See: https://docs.google.com/document/d/1Nsv52MvSjbLb2PCpHlat0gkzw0EvtSgpKHu4mk0MnrA/edit#heading=h.1gmodju1d6p0
 */
const { getLogger , backOff_fetch } = require('ldn-inbox-server');
const { memento } = require('memento-cli');

const logger = getLogger();
const SLEEP = 10;
const MAX_ATTEMPTS = 10;
const TIMEMAP_BASE_URL = 'http://web.archive.org/web/timemap/link/';
const MEMENTO_BASE_URL = 'http://web.archive.org/web/';
const delay = ms => new Promise(res => setTimeout(res, ms * 1000));

async function waybackPOST(url,options) {
    logger.info(`waybackPOST(${url})`);
    logger.debug(options);
    const response = await backOff_fetch('https://web.archive.org/save', {
        body: `url=${url}`,
        method: "POST",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Authorization': `LOW ${options['access_key']}:${options['secret_key']}`
        }
    });
    if (response.ok) {
        const json = await response.json();
        logger.debug(json);
        return json;
    }
    else {
        logger.error(`failed ${response.error}`);
        return null;
    }
}

async function waybackGET(id,options) {
    logger.info(`waybackGET(${id})`);
    logger.debug(options);
    const response = await backOff_fetch(`https://web.archive.org/save/status/${id}`, {
        method: "GET",
        headers: {
            'Accept': 'application/json',
            'Authorization': `LOW ${options['access_key']}:${options['secret_key']}`
        }
    });
    if (response.ok) {
        const json = await response.json();
        logger.debug(json);
        return json;
    }
    else {
        logger.error(`failed ${response.error}`);
        return null;
    }
}

async function waybackCapture(url,options) {
    const timestamp = await _waybackCapture(url,options) ;

    if (! timestamp) {
        return null;
    }

    const timeMap = `${TIMEMAP_BASE_URL}${url}`;
    const memento = `${MEMENTO_BASE_URL}${timestamp}/${url}`;

    return {
        "id": timeMap ,
        "type": "Document" ,
        "iana:original": url,
        "iana:memento": memento
    };
}

async function _waybackCapture(url,options) {
    options['sleep'] = options['sleep'] || SLEEP;
    options['max_attemps'] = options['max_attemps'] || MAX_ATTEMPTS;

    return new Promise( async (resolve,reject) => {
        try {
            const post_response = await waybackPOST(url,options);

            let job_id = undefined;

            if (post_response && post_response['job_id']) {
                job_id = post_response['job_id'];
            }
            else {
                throw new Error(`no job_id generated for ${url}`);
            }

            let attempt = 0;
            while (attempt < options['max_attemps']) {
                const status_response = await waybackGET(job_id,options);

                if (! status_response) {
                    throw new Error(`no status response for job_id ${job_id}`);
                }

                const status = status_response['status'];
                const timestap = status_response['timestamp'];

                if (!status) {
                    throw new Error(`no status for job_id ${job_id}`);
                }
                else if (status === 'success') {
                    logger.debug(`> ${status}`);
                    resolve(timestap);
                    break;
                }
                else if (status === 'error') {
                    logger.debug(`> ${status}`);
                    throw new Errorr(`error status for job_id ${job_id}`);
                }
                else if (status === 'pending') {
                    logger.debug(`> ${status}`);
                    // we are ok..and still waiting
                }
                else {
                    throw new Error(`unknown status ${status} for job_id ${job_id}`);
                }

                attempt++;

                await delay(options['sleep']);
            } 
        }
        catch(e) {
            reject(e);
        }

        resolve(null);
    });
}

module.exports = { waybackPOST , waybackGET , waybackCapture };