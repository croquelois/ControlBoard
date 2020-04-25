/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

const pg = require('pg');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'plugins-postgres'});

module.exports = function(info){
  let ret = {};
    
  ret.check = function(){
    return new Promise(function(res){
      let host = info.host;
      let user = info.user;
      let database = info.database;
      let password = info.password;
      let port = info.port || 5432;
      log.info("start check PostgreSQL database",host);
      
      let client = new pg.Client({host,user,database,password,port});
      client.connect(function(err){
        if(err){
          log.error(host,err);
          return res("down");
        }
        client.query('SELECT \'ok\' as name', [], function(err){
          if(err){
            log.error(host,err);
            return res("problem");
          }
          client.end(function(err){
            if(err){
              log.error(host,err);
              return res("problem");
            }
            return res("online");
          });
        });
      });
    });
  };

  return ret;
};