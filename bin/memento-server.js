#!/usr/bin/env node

const path = require('path');
const { program } = require('commander');
const { inbox_server, handle_inbox } = require('ldn-inbox-server');

const HOST = 'localhost'
const PORT = 8000;
const PUBLIC_PATH = './public';
const INBOX_PATH = './inbox';
const JSON_SCHEMA_PATH = './config/offer_schema.json';

program
  .name('memento-server')
  .version('1.0.0')
  .description('An experimental Memento (RFC 7089) server');

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
        path.resolve(__dirname,'../src/inbox_handler.js'),
        options
    );
  });

program.parse();