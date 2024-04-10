#!/usr/bin/env node

const path = require('path');
const { program } = require('commander');
const { inbox_server, handle_inbox , defaultSendNotificationHandler } = require('ldn-inbox-server');
const { notificationHandler } = require('../lib/inbox_handler');
const { handle_map } = require('../lib/map_handler');
const { handle_memento } = require('../lib/memento_handler');
const { removeStore, initStore , listMementos , getMemento , getMementoMetadata , listRepository } = require('../lib/memento');

const HOST = 'localhost'
const PORT = 8000;
const PUBLIC_PATH = './public';
const INBOX_URL   = 'inbox/';
const INBOX_PATH  = './inbox';
const ERROR_PATH  = './error';
const OUTBOX_PATH = './outbox';
const JSON_SCHEMA_PATH = './config/offer_schema.json';

program
  .name('memento-server')
  .version('1.0.0')
  .description('An experimental Memento (RFC 7089) server');

program
  .command('start-server')
  .option('--host <host>','host',HOST)
  .option('--port <port>','port',PORT)
  .option('--url <url>','url',INBOX_URL)
  .option('--inbox <inbox>','inbox',INBOX_PATH)
  .option('--public <public>','public',PUBLIC_PATH)
  .option('--schema <schema>','json schema',JSON_SCHEMA_PATH)
  .option('--registry <registry>','registry',null)
  .action( (options) => {
    const registry = options['registry'] ?? [];
    registry.push({
      'path': '^map/.*' , 
      'do': handle_map
    });
    registry.push({
      'path': '^memento/.*' ,
      'do': handle_memento
    });
    options['registry'] = registry;
    inbox_server(options);
  });

program
  .command('handler')
  .option('--inbox <inbox>','inbox',INBOX_PATH)
  .option('--outbox <outbox>','outbox',OUTBOX_PATH)
  .option('--error <errbox>','errbox',ERROR_PATH)
  .option('-hi,--inbox_handler <handler>','inbox handler')
  .option('-hn,--notification_handler <handler>','notification handler')
  .argument('<box>','box to process')
  .action( async(box,options) => {
    switch (box) {
      case '@inbox':
        box = INBOX_PATH;
        options['notification_handler'] =
           options['notification_handler'] ?? notificationHandler;
        break;
      case '@outbox':
        box = OUTBOX_PATH;
        options['notification_handler'] =
           options['notification_handler'] ?? defaultSendNotificationHandler;
        break;
    }
    await handle_inbox(box,options);
  });

program
  .command('init-repository')
  .option('--clear','remove the old repository',false)
  .action( async(options) => {
    if (options['clear']) {
      await removeStore();
    }
    await initStore();
  });

program
  .command('list-repository')
  .action( async() => {
    const inventory = await listRepository();
    console.log(JSON.stringify(inventory,null,4));
  });

program
  .command('mementos')
  .argument('<url>', 'URL')
  .action( async(url) => {
    const mementos = await listMementos(url);
    console.log(JSON.stringify(mementos,null,4));
  });

program
  .command('memento')
  .option('--metadata', 'retrieve metadata')
  .argument('<url>', 'URL')
  .argument('<datetime>', 'datetime')
  .action( async(url,datetime,options) => {
    if (options['metadata']) {
      const content = await getMementoMetadata(url,datetime);
      console.log(JSON.stringify(content,null,2));
    }
    else {
      const content = await getMemento(url,datetime);
      console.log(content);
    }
  });

program.parse();