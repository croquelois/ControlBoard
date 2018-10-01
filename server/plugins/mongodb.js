const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'plugins-mongodb'});

module.exports = function(info){
  let ret = {};
    
  ret.check = function(cbFct){
    let where = info.where;
    log.info("start check mongo database",where);
    MongoClient.connect(where,function(err, db){
      log.info("check mongo database done",where);
      if(err || !db){
        log.error(where,err);
        return cbFct(null,"down");
      }
      function closeAndCb(status){
        db.close();
        return cbFct(null,status);
      }
      if(db.s && db.s.topology && db.s.topology.s && db.s.topology.s.server && db.s.topology.s.server && db.s.topology.s.server.ismaster){
        let rsInfo = db.s.topology.s.server.ismaster;
        if(!rsInfo.hosts) return closeAndCb("online");
        if(rsInfo.ismaster) return closeAndCb("primary");
        if(rsInfo.secondary) return closeAndCb("secondary");
        return closeAndCb("unexpected");
      }
      return closeAndCb("online");
    });
  }

  return ret;
};