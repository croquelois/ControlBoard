"use strict";
const child_process = require('child_process');
const async = require('async');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'routerControlBoard'});
const items = require('./modules/items.js');

const plugins = {
  "git": require('./plugins/git.js'),
  "website": require('./plugins/website.js'),
  "mongodb": require('./plugins/mongodb.js'),
  "postgres": require('./plugins/postgres.js'),
  "redis": require('./plugins/redis.js')
};

function refresh(req,res){
  let id = req.body['id'];
  items.get(id, function(err, item){
    if(err)
      return res.status(err.code).send(err.msg);
    let plugin = plugins[item.type];
    let check = (plugin && plugin(item).check) || (cb => cb(null, "unsupported"));
    check(function(err, status){
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

function action(req,res){
  let id = req.body['id'];
  items.get(id, function(err, item){
    if(err)
      return res.status(err.code).send(err.msg);
    let plugin = plugins[item.type];
    let action = (plugin && plugin(item).action);
    if(!action) 
      return res.status(500).send("not supported");
    action(function(err, msg){
      if(err) 
        return res.status(500).send(err);
      return res.status(200).send(msg);
    });
  });
}

function toClient(item){
  return {
      _id: item._id,
      type: item.type,
      name: item.name,
      status: item.status,
      actionType: (plugins[item.type] && plugins[item.type](item).actionType)
  }
}

function getList(req,res){
  items.getAll((e,r) => res.status(e ? 500 : 200).send(e || r.map(toClient)));
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
  addPost("/action",action);
  addPost("/upsert",upsert);
};