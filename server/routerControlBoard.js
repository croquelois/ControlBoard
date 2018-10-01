"use strict";
const child_process = require('child_process');
const async = require('async');
const http = require('http');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'routerControlBoard'});
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const pg = require('pg');
const redis = require('redis');
const items = require('./modules/items.js');

const checkTypeMap = {
  "git": checkGit, 
  "server": checkServer, 
  "mongo": checkMongo, 
  "postgres": checkPostgres, 
  "redis": checkRedis
};

const actionTypeMap = {
  "git": pullGit,
  "server": restartServer
};

// Git Repository

function pullGit(info,cbFct){
  let where = info.where;
  log.info("start pull git",where);
  child_process.exec("git pull", {cwd: where}, function(err, stdout){
    log.info("git pull done",where);
    if(err) return cbFct(err);
    return cbFct(null,"done");  
  });
}

function checkGit(info,cbFct){
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

// Web Server

function checkServer(info,cbFct){
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

function restartServer(info,cbFct){
  let cmd = info.restartCmd;
  log.info("start action restart server",cmd);
  child_process.exec(info.restartCmd, {}, function(err, stdout){
    log.info("restart server done",cmd,stdout);
    if(err) return cbFct(err);
    return cbFct(null,"done");  
  });
}

// Mongo Database

function checkMongo(info,cbFct){
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

// Postgres Database

function checkPostgres(info,cbFct){
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

// Reddis Database

function checkRedis(info,cbFct){
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

// ***


function refresh(req,res){
  let id = req.body['id'];
  items.get(id, function(err, item){
    if(err)
      return res.status(err.code).send(err.msg);
    let check = checkTypeMap[item.type];
    if(!check)
      check = (item,cb) => cb(null, "unsupported");
    check(item, function(err, status){
      if(err)
        return res.status(500).send(err);
      item.status = status;
      items.pushStatus(id, status, function(err){
        if(err)
          return res.status(err.code).send(err.msg);
        return res.status(200).send(item);
      });
    });
  });
}

function update(req,res){
  let id = req.body['id'];
  items.get(id, function(err, item){
    if(err)
      return res.status(err.code).send(err.msg);
    let action = actionTypeMap[item.type];
    if(!action) 
      return res.status(500).send("not supported");
    action(item,function(err, msg){
      if(err) 
        return res.status(500).send(err);
      return res.status(200).send(msg);
    });
  });
}

function getList(req,res){
  items.getAll((e,r) => res.status(e ? 500 : 200).send(e || r));
}

function upsert(req,res){
  items.upsert(req.body['item'], e => res.status(e ? 500 : 200).send(e || "ok"));
}

module.exports = function(app){
  function addPost(url,fct){
    app.post(url, function(req,res){
      log.info(url);
      if(!req.user){
        log.info("invalid token");
        return res.status(401).send('invalid token');
      }
      try{ 
        fct(req,res);
      }catch(err){ 
        log.error(err.stack?err.stack:err,"try/catch"); 
        res.status(500).send(err.stack?err.stack:err); 
      }
    });
  }
    
  addPost("/getList",getList);
  addPost("/refresh",refresh);
  addPost("/update",update);
  addPost("/upsert",upsert);
};