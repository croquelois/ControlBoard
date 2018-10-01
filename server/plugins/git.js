const child_process = require('child_process');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'plugins-git'});

module.exports = function(info){
  let ret = {};
  
  ret.action = function(cbFct){
    let where = info.where;
    log.info("start pull git",where);
    child_process.exec("git pull", {cwd: where}, function(err, stdout){
      log.info("git pull done",where);
      if(err) return cbFct(err);
      return cbFct(null,"done");  
    });
  }
  ret.actionType = "update";

  ret.check = function(cbFct){
    let where = info.where;
    log.info("start check git",where);
    child_process.exec("git remote update && git rev-list --count master..origin/master", {cwd: where}, function(err, stdout){
      log.info("git command done",where);
      if(err) return cbFct(err);
      try {
        let behind = parseInt(stdout);
        return cbFct(null,behind?"behind":"up to date");
      }catch(err){
        return cbFct(null,"error");
      }
    });
  }
  
  return ret;
};