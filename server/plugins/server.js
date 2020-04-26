/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

const util = require('util');
const child_process = require('child_process');
const http = require('http');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'plugins-server'});

const regExpCmd = /Cmd$/;

/* 
Example:
{
  type: "server", 
  name:"CS:GO", 
  systemctl: "csgo", 
  updateCmd: "sudo -u csgosrv /home/csgosrv/updateSteam.sh"
}

systemctl: name of the service, will allow to check status, stop and start the server
*Cmd: all field finishing in 'Cmd' will be interpreted as additional action
*/

module.exports = function(info){
  let ret = {};
  
  ret.check = function(){
    return new Promise(function(res, rej){
      if(!info.systemctl)
        rej("only systemctl is currently supported");
      let cmd = "sudo systemctl is-active " + info.systemctl;
      log.info({cmd}, `start check ${info.name}`);
      child_process.exec(cmd, {}, function(error, stdout, stderr){
        log.info({cmd,error,stdout}, `check ${info.name} done`);
        if(error){
          if(error.code == 3)
            return res("offline");
          log.error({cmd, error}, `check ${info.name} error`);
          return rej(`the command doesn't work on the server: ${stderr}`);
        }
        return res("online");
      });
    });
  };
  
  ret.actions = {};
  function addCmdAction(name, cmd){
    ret.actions[name] = function(){
      return new Promise(function(res, rej){
        log.info({cmd}, `start action ${name}`);
        child_process.exec(cmd, {}, function(error, stdout, stderr){
          log.info({cmd,error,stdout}, `${name} done`);
          if(error){
            log.error({cmd, error}, `${name} error`);
            return rej(`the command doesn't work on the server: ${stderr}`);
          }
          return res("done");
        });
      });
    };
  }  
  Object.keys(info).filter(k => regExpCmd.test(k)).forEach(k => addCmdAction(k.slice(0,-3),info[k]));  
  if(info.systemctl){
    addCmdAction("start", "sudo systemctl start " + info.systemctl);
    addCmdAction("stop", "sudo systemctl stop " + info.systemctl);
  }
  return ret;
};