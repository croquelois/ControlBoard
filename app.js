/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const path = require('path');
const bunyan = require('bunyan'); // node.exe app.js | ./node_modules/.bin/bunyan --color
const log = bunyan.createLogger({name: 'routerAdmin'});
const Users = require('./server/modules/users');
const utils = require('./utils.js');
const configFile = process.argv[2] || "config.js";
const config = require('./' + configFile);

async function main(){
  let app = express();
  let users = new Users();
  await users.init(config);
  app.use(bodyParser.json());
  app.use(users.tokenUser.bind(users));
  app.use(express.static(path.join(__dirname, 'public')));
  await require('./server/router')(app, config);
  const server = http.createServer(app);
  server.listen(config.port, () => log.info(`Express server listening on port ${config.port}`));
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      log.error(`port ${config.port} is already in use`);
    } else {
      log.error({error}, "Error sent by the server instance");
    }
    process.exit(-1);
  });
  utils.infiniteLoop("Token cleanup", users.checkExpiredTokens.bind(users), 10*60*1000);
}

process.on('unhandledRejection', e => { throw e; });
main();

