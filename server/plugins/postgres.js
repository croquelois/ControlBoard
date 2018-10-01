const pg = require('pg');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'plugins-postgres'});

module.exports = function(info){
  let ret = {};
    
  ret.check = function(cbFct){
    let host = info.host;
    let user = info.user;
    let database = info.database;
    let password = info.password;
    let port = info.port || 5432;
    log.info("start check PostgreSQL database",host);
    
    let client = new pg.Client({host:host,user:user,database:database,password:password,port:port});
    client.connect(function (err) {
      if(err){
        log.error(host,err);
        return cbFct(null,"down");
      }
      client.query('SELECT \'ok\' as name', [], function (err, result) {
        if(err){
          log.error(host,err);
          return cbFct(null,"problem");
        }
        client.end(function (err) {
          if(err){
            log.error(host,err);
            return cbFct(null,"problem");
          }
          return cbFct(null,"online");
        });
      });
    });
  }

  return ret;
};