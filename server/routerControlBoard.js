"use strict";
var child_process = require('child_process');
var async = require('async');
var http = require('http');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: 'routerControlBoard'});
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var pg = require('pg');
var redis = require('redis');

var list = require("../config.js").list;

// Git Repository

function pullGit(info,cbFct){
  var where = info.where;
  log.info("start pull git",where);
  child_process.exec("git pull", {cwd: where}, function(err, stdout){
    log.info("git pull done",where);
    if(err) return cbFct(err);
    return cbFct(null,"done");  
  });
}

function checkGit(info,cbFct){
  var where = info.where;
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
  var where = info.where;
  log.info("start check web server",where);
  var finish = function(err,res){
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
  var cmd = info.restartCmd;
  log.info("start action restart server",cmd);
  child_process.exec(info.restartCmd, {}, function(err, stdout){
    log.info("restart server done",cmd,stdout);
    if(err) return cbFct(err);
    return cbFct(null,"done");  
  });
}

// Mongo Database

function checkMongo(info,cbFct){
  var where = info.where;
  log.info("start check mongo database",where);
  MongoClient.connect(where,function(err, db){
    log.info("check mongo database done",where);
    if(err || !db){
      log.error(where,err);
      return cbFct(null,"down");
    }
    if(db.s && db.s.topology && db.s.topology.s && db.s.topology.s.server && db.s.topology.s.server.s && db.s.topology.s.server.s.ismaster){
      var rsInfo = db.s.topology.s.server.s.ismaster;
      if(!rsInfo.hosts) return cbFct(null,"online");
      if(rsInfo.ismaster) return cbFct(null,"primary");
      if(rsInfo.secondary) return cbFct(null,"secondary");
      return cbFct(null,"unexpected");
    }
    return cbFct(null,"online");
  });
}

// Postgres Database

function checkPostgres(info,cbFct){
  var host = info.host;
  var user = info.user;
  var database = info.database;
  var password = info.password;
  var port = info.port || 5432;
  log.info("start check PostgreSQL database",host);
  
  var client = new pg.Client({host:host,user:user,database:database,password:password,port:port});
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

function getStatus(fct,node,cbFct){
  fct(node, function(err,res){
    if(err) return cbFct(err);
    node.status = res;
    return cbFct(null,node);
  });
}

function refresh(req,res){
  var id = req.body['id'];
  if(!list[id]) return res.status(400).send("id '"+id+"' doesn't exist");
  var check = {"git":checkGit, "server":checkServer, "mongo": checkMongo, "postgres":checkPostgres, "redis":checkRedis}[list[id].type];
  if(!check){
    list[id].status = "unsupported";
    return res.status(200).send(list[id]);
  }
  getStatus(check,list[id],function(err){
    if(err) return res.status(500).send(err);
    return res.status(200).send(list[id]);
  });
}

function update(req,res){
  var id = req.body['id'];
  if(!list[id]) return res.status(400).send("id '"+id+"' doesn't exist");
  var doUpdate = {"git":pullGit, "server":restartServer}[list[id].type];
  if(!doUpdate) return res.status(500).send({error:"not supported"});
  doUpdate(list[id],function(err, msg){
    if(err) return res.status(500).send({error: err});
    return res.status(200).send({msg: msg});
  });
}

function getList(req,res){
  var arr = [];
  for(var key in list) arr.push(list[key]);
  return res.status(200).send(arr);
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
};