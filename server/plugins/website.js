const child_process = require('child_process');
const http = require('http');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'plugins-website'});

module.exports = function(info){
  let ret = {};
  
  ret.check = function(cbFct){
    let where = info.where;
    log.info("start check web server",where);
    let finish = function(err,res){
      finish = null;
      log.info("check web server done",where);
      if(err) return cbFct(null, "down");
      return cbFct(null, "online"); 
    };
    http.get({
      hostname: where.split(":")[0],
      port: (parseInt(where.split(":")[1]||"0",10) || 80),
      path: '/'
    }, function(res){
      if(finish) return finish(null,res);
    }).on('error', function(err){
      log.error(where,err);
      if(finish) return finish(err);
    });
  }

  if(info.restartCmd){
    ret.action = function(cbFct){
      let cmd = info.restartCmd;
      log.info("start action restart server",cmd);
      child_process.exec(info.restartCmd, {}, function(err, stdout){
        log.info("restart server done",cmd,stdout);
        if(err) return cbFct(err);
        return cbFct(null,"done");  
      });
    }
    ret.actionType = "restart";
  }
  
  return ret;
};