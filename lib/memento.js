const fs = require('fs');
const crypto = require('crypto');
const simpleGit = require('simple-git');
const logger = require('../lib/util.js').getLogger();
require('dotenv').config();

function removeStore() {
    const repository = process.env.MEMENTO_REPOSITORY;

    if (! repository) {
        logger.error(`no MEMENTO_REPOSITORY set`);
        return false;
    }

    logger.info(`removing ${repository}`);

    fs.rmSync(repository, { recursive: true, force: true });

    return true;
}

async function initStore() {
    const repository = process.env.MEMENTO_REPOSITORY;
    
    if (! repository) {
        logger.error(`no MEMENTO_REPOSITORY set`);
        return false;
    }

    if (fs.existsSync(`${repository}`) &&
        fs.existsSync(`${repository}/.git`) &&
        fs.existsSync(`${repository}/mementos`)) {
        return true;
    }

    if (! fs.existsSync(`${repository}/mementos`) ) {
        fs.mkdirSync(`${repository}/mementos`, { recursive: true });
    }

    const git = simpleGit({ baseDir: repository });

    if (! fs.existsSync(`${repository}/.git`)) {
        logger.info(`initializing ${repository}`);
        await git.init(); 
    }

    return true;
}

async function storeMemento(url, body, actor) {
    const checksum = crypto.createHash('sha256').update(url).digest('base64url');

    logger.info(`Writing ${url} to repository as ${checksum}`);

    const repositoryPath = process.env.MEMENTO_REPOSITORY + '/mementos/' + checksum;

    if (! fs.existsSync(process.env.MEMENTO_REPOSITORY + '/mementos/')) {
        fs.mkdirSync(process.env.MEMENTO_REPOSITORY + '/mementos/', { recursive: true});
    }

    const git = simpleGit({ baseDir: process.env.MEMENTO_REPOSITORY });

    let isNewFile = false;

    if (!fs.existsSync(repositoryPath)) {
        isNewFile = true;
    }

    fs.writeFileSync(repositoryPath,body);

    if (isNewFile) {
        logger.info(`git add ${repositoryPath}`);
        await git.add([repositoryPath]);

        logger.info(`adding ${repositoryPath}.json`);
        fs.writeFileSync(`${repositoryPath}.json`, JSON.stringify({
            'id': url ,
            'actor': actor 
        }));

        logger.info(`git add ${repositoryPath}.json`);
        await git.add([`${repositoryPath}.json`]);
    }

    logger.info(`git commit ${repositoryPath}`);

    await git.commit(`offer from ${actor}`, [ repositoryPath ]);

    const file_log = await git.log({file: repositoryPath});

    let commit_hash ;

    if (file_log && file_log['all']?.length > 0 ) {
        commit_hash = file_log['all'][0]['hash'];
    }

    return { id: checksum , path: repositoryPath , memento: commit_hash };
}

module.exports = { storeMemento , removeStore , initStore };