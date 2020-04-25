/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

const redis = require('redis');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'plugins-redis'});

module.exports = function(info){
  let ret = {};
  
  ret.check = function(){
    return new Promise(function(res){
      let where = info.where;
      log.info("start check Redis database",where||"localhost");
      let client = redis.createClient(where);
      client.on("error", () => res("down"));
      client.on("ready", () => { client.quit(); return res("online"); });
    });
  };
  
  return ret;
};