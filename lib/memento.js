const fs = require('fs');
const crypto = require('crypto');
const simpleGit = require('simple-git');
const logger = require('../lib/util.js').getLogger();
require('dotenv').config();

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

module.exports = { storeMemento };