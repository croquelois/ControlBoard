"use strict";
const async = require('async');
const assert = require('assert');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'modelItems'});
 
let items;

function now(){ return new Date(); }
const dbSettings = require('./db-settings');
dbSettings.get(function(err,db){
  if(err) 
    throw new Error("Unable to connect to the db: '"+ err + "'");
  items = db.collection('items');
});
exports.waitDB = dbSettings.get;
const getObjectId = dbSettings.getObjectId;

let errorsList = {};
function pushError(codeTxt, code, msg){ errorsList[codeTxt] = {code, codeTxt, msg}; }
pushError('mongodb-problem', 500, 'problem with the database');
pushError('item-not-found', 400, 'cannot found the item');
pushError('item-invalid-id', 400, 'the id is not valid');

exports.getAll = function(cb){
  items.find({}).toArray(function(e,items){
    if(e) 
      return cb(errorsList['mongodb-problem']);
    return cb(null,items);
  });
}

exports.get = function(id, cb){
  if(!id)
    return cb(errorsList['item-invalid-id']);
  items.findOne({_id:getObjectId(id)}, function(e,item){
    if(e) 
      return cb(errorsList['mongodb-problem']);
    if(!item)
      return cb(errorsList['item-not-found']);
    return cb(null,item);
  });
}

exports.pushStatus = function(id, status, cb){
  if(!id)
    return cb(errorsList['item-invalid-id']);
  items.updateOne({_id:getObjectId(id)}, {$set: {status, lastUpdate:now()}}, e => cb(e && errorsList['mongodb-problem']));
}

exports.upsert = function(item, cb){
  item.status = item.status || "unknown";
  if(item._id){
    items.update({_id:getObjectId(item._id)},item, function(err,res){
      if(err) return cb(err);
      return cb(err,res.ops[0]);
    });
    
  }else{
    items.insertOne(item, function(err,res){
      if(err) return cb(err);
      return cb(err,res.ops[0]);
    });
  }
}

exports.reset = function(cb){
  items.deleteMany({},function(err,res){
    return cb(err,res && res.deletedCount);
  });
}