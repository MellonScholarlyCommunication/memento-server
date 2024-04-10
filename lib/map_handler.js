const { listMementos } = require('./memento');
require('dotenv').config();

async function handle_map(req,res) {
    const baseurl = process.env.MEMENTO_BASEURL;
    const timemap_url = process.env.MEMENTO_BASEURL_TIMEMAP;
    const memento_url = process.env.MEMENTO_BASEURL_MEMENTO;
    const timemap_part = timemap_url.substring(baseurl.length);
    let pathItem = req.url.substring(timemap_part.length);

    // Hack for nginx servers that eat the double slash...
    pathItem = pathItem.replace(/^http:\/+/g,'http://')
                       .replace(/^https:\/+/g,'https://');

    const mementos = await listMementos(pathItem);

    if (mementos && mementos.length) {
        let mapStr = `<${pathItem}> ; rel="original",\n`;

        for (let i = 0 ; i < mementos.length ; i++ ) {
            const datetime = mementos[i]['datetime'];
            const url = memento_url + datetime + '/' + mementos[i]['url'];
            const utc_datetime = mementos[i]['utc_datetime'];
            mapStr += `<${url}>; rel="memento"; datetime="${utc_datetime}"`;
            if (i == mementos.length -1 ) {
                mapStr += "\n";
            }
            else {
                mapStr += ",\n";
            }
        }

        res.setHeader('Content-Type','application/link-format');
        res.setHeader('Content-Length',mapStr.length);
        res.writeHead(200)
        res.end(mapStr);
    }
    else {
        res.writeHead(404)
        res.end(`No timemap for this URL`);
    }
}

module.exports = { handle_map };