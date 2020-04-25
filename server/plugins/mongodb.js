/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'plugins-mongodb'});

const codeToHuman = {
  RSPrimary: "primary",
  RSSecondary: "secondary",
  RSArbiter: "arbiter",
  Standalone: "standalone",
  Unknown: "unknown",
  Mongos: "proxy",
};

module.exports = function(info){
  let ret = {};
    
  ret.check = async function(){
    let where = info.where;
    let status = "down";
    log.info({where}, "start check mongo database");
    const client = new MongoClient(where, {useNewUrlParser: true, useUnifiedTopology: true});
    client.on('serverDescriptionChanged', e => status = codeToHuman[e.newDescription.type]);
    try {
      await client.connect();
      await client.close();
      log.info({where}, "check mongo database done");
    }catch(err){
      log.error({where,err}, "unable to connect to mongo db");
    }
    return status;
  };

  return ret;
};