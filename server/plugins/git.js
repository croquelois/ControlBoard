/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

const child_process = require('child_process');
const fs = require('fs');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'plugins-git'});

module.exports = function(info){
  let ret = {};
  
  ret.actions = {};
  
  ret.actions.update = function(){
    return new Promise(function(res,rej){
      let where = info.where;
      log.info(`start pull git: ${where}`);
      child_process.exec("git pull", {cwd: where}, function(error){
        if(error){
          log.error({where, error}, "git pull error");
          return rej(error);
        }
        log.info("git pull done",where);
        return res("done");  
      });
    });
  };

  ret.check = function(){
    return new Promise(function(res,rej){
      let where = info.where;
      log.info(`start check git: ${where}`);
      let cmd = "git remote update >> /dev/null && git rev-list --count master..origin/master";
      child_process.exec(cmd, {cwd: where}, function(error, stdout){
        log.info("git command done",where);
        if(error){
          log.error({where, error}, "git check error");
          if(error.errno == "ENOENT")
            return rej(`the directoty ${where} doesn't exist on the server`);
          return rej("internal error");
        }
        try {
          let behind = parseInt(stdout);
          return res(behind?"behind":"up to date");
        }catch(err){
          log.error({where,stdout}, "git check problem, can't parse stdout");
          return res("error");
        }
      });
    });
  };
  
  return ret;
};