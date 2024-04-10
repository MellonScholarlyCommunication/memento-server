const { getMemento, getMementoMetadata } = require('./memento');
require('dotenv').config();

async function handle_memento(req,res) {
    const baseurl = process.env.MEMENTO_BASEURL;
    const memento_url = process.env.MEMENTO_BASEURL_MEMENTO;
    const memento_part = memento_url.substring(baseurl.length);
    const pathItem = req.url.substring(memento_part.length);

    let index = pathItem.indexOf("/"); 
    let datetime = pathItem.slice(0, index); 
    let url = pathItem.slice(index + 1); 

    // Hack for nginx servers that eat the double slash...
    url = url.replace(/^http:\/+/g,'http://')
              .replace(/^https:\/+/g,'https://');

    if (datetime && url && url.startsWith('http')) {
        const memento = await getMemento(url,datetime);
        const metadata = await getMementoMetadata(url,datetime);

        if (memento) {
            if (metadata && metadata['content-type']) {
                res.setHeader('Content-Type', metadata['content-type']);
            }
            res.writeHead(200);
            res.end(memento);
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