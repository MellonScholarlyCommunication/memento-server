#!/usr/bin/env node

const path = require('path');
const { program } = require('commander');
const { inbox_server, handle_inbox } = require('ldn-inbox-server');
const { handle_outbox } = require('../lib/outbox_handler');
const { removeStore, initStore } = require('../lib/memento');

const HOST = 'localhost'
const PORT = 8000;
const PUBLIC_PATH = './public';
const INBOX_PATH  = './inbox';
const OUTBOX_PATH = './outbox';
const JSON_SCHEMA_PATH = './config/offer_schema.json';

program
  .name('memento-server')
  .version('1.0.0')
  .description('An experimental Memento (RFC 7089) server');

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
  .command('start-server')
  .option('--host <host>','host',HOST)
  .option('--port <port>','port',PORT)
  .option('--inbox <inbox>','inbox',INBOX_PATH)
  .option('--public <public>','public',PUBLIC_PATH)
  .option('--schema <schema>','json schema',JSON_SCHEMA_PATH)
  .option('--registry <registry>','registry',null)
  .action( (options) => {
    inbox_server(options);
  });

program
  .command('handle-inbox')
  .option('--inbox <inbox>','inbox',INBOX_PATH)
  .action( async(options) => {
    await handle_inbox(
        options['inbox'],
        path.resolve(__dirname,'../lib/inbox_handler.js'),
        options
    );
  });

program
    .command('handle-outbox')
    .option('--outbox <outbox>','outbox',OUTBOX_PATH)
    .action( async(options) => {
     await handle_outbox(options['outbox'],options);
    });

program.parse();