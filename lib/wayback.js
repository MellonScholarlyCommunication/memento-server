const { getLogger , backOff_fetch } = require('ldn-inbox-server');

const logger = getLogger();

async function waybackPOST(url) {
    logger.info(`waybackPOST(${url})`);
    const response = await backOff_fetch('https://web.archive.org/save', {
        body: `url=${url}`,
        method: "POST",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Authorization': `LOW ${process.env.S3_ACCESS_KEY}:${process.env.S3_SECRET_KEY}`
        }
    });
    if (response.ok) {
        const json = await response.text();
        logger.debug(json);
        return json;
    }
    else {
        logger.error(`failed ${response.error}`);
        return null;
    }
}

async function waybackGET(id) {
    logger.info(`waybackGET(${id})`);
    const response = await backOff_fetch(`https://web.archive.org/save/status/${id}`, {
        method: "GET",
        headers: {
            'Accept': 'application/json',
            'Authorization': `LOW ${process.env.S3_ACCESS_KEY}:${process.env.S3_SECRET_KEY}`
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

module.exports = { waybackPOST , waybackGET };