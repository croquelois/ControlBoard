const redis = require('redis');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'plugins-redis'});

module.exports = function(info){
  let ret = {};
  
  ret.check = function(cbFct){
    var where = info.where;
    log.info("start check Redis database",where||"localhost");
    var client = redis.createClient(where);
    client.on("error", function(err){ 
      var fct = cbFct;
      cbFct = function(){};
      return fct(null,"down"); 
    });
    client.on("ready", function(err){ 
      var fct = cbFct;
      cbFct = function(){};
      client.quit(); 
      return fct(null,"online"); 
    });
  }
  
  return ret;
};