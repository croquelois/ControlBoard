/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

const util = require('util');
const child_process = require('child_process');
const http = require('http');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'plugins-website'});

module.exports = function(info){
  let ret = {};
  
  ret.check = function(){
    return new Promise(function(res){
      let where = info.where;
      log.info("start check web server",where);
      let req = {
        hostname: where.split(":")[0],
        port: (parseInt(where.split(":")[1]||"0",10) || 80),
        path: '/'
      };
      http.get(req, () => res("online")).on('error', () => res("down"));
    });
  };
  
  ret.actions = {};

  if(info.restartCmd){
    ret.actions.restart = function(){
      return new Promise(function(res, rej){
        let cmd = info.restartCmd;
        log.info({cmd}, "start action restart server");
        child_process.exec(info.restartCmd, {}, function(error, stdout, stderr){
          log.info({cmd,error,stdout}, "restart server done");
          if(error){
            log.error({cmd, error}, "restart server error");
            return rej(`the command doesn't work on the server: ${stderr}`);
          }
          return res("done");  
        });
      });
    };
  }
  
  return ret;
};