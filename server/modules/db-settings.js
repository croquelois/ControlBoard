"use strict";
var mongodb = require('mongodb');
var assert = require('assert');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: 'dbSettings'});
var config = require("../../config.js");
var ObjectID = mongodb.ObjectID;
var MongoClient = mongodb.MongoClient;
 
var url = config.dbUrl;
var db;
var error;
var connecting = false;
var queueCb = [];

exports.get = function(cb){
  assert(cb, "Callback is not defined");
  if(db) return cb(undefined,db);
  queueCb.push(cb);
  if(connecting) return;
  connecting = true;
  log.info("open database: '" + url + "'"); 
  MongoClient.connect(url,function(e, d){
    connecting = false;
    if(e){
      error = e;
      log.error(e);
      return queueCb.forEach(function(cb){ return cb(e); });
    }
    log.info('connected to the database');
    db = d;
    queueCb.forEach(function(cb){ return cb(e,d); });
  });
};
exports.get(function(){});
exports.getObjectId = function(id){
  assert(id);
  if(!id.substr) return id;
  return new ObjectID(id);
};
exports.matchOne = function(cb){ 
  return function(err,res){ 
    return cb(err,res && (res.matchedCount == 1)); 
  }; 
};
exports.matchTwo = function(cb){ 
  return function(err,res){ 
    return cb(err,res && (res.matchedCount == 2)); 
  }; 
};
