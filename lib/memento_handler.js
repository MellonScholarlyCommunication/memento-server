const { listMementos , getMemento } = require('./memento');
require('dotenv').config();

async function handle_memento(req,res) {
    const baseurl = process.env.MEMENTO_BASEURL;
    const memento_url = process.env.MEMENTO_BASEURL_MEMENTO;
    const memento_part = memento_url.substring(baseurl.length);
    const pathItem = req.url.substring(memento_part.length);

    let index = pathItem.indexOf("/"); 
    let datetime = pathItem.slice(0, index); 
    let url = pathItem.slice(index + 1); 

    if (datetime && url && url.startsWith('http')) {
        const mementos = await listMementos(url);

        if (mementos && mementos.length > 0) {
            let found = false;

            for (let i = 0 ; i < mementos.length ; i++) {
                if (mementos[i]['datetime'] === datetime) {
                    const memento = await getMemento(url,mementos[i]['.git']['hash']);

                    if (memento) {
                        found = true;
                        res.writeHead(200);
                        res.end(memento);
                    }

                    break;
                }
            }

            if (!found) {
                res.writeHead(404)
                res.end(`no memento for this url`); 
            }
        }
        else {
            res.writeHead(404)
            res.end(`no memento for this url`);
        }
    }
    else {
        res.writeHead(404)
        res.end(`no memento for this url`);
    }
}

module.exports = { handle_memento };