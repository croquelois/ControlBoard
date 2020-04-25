/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

const assert = require('assert');
const {MongoClient, ObjectID} = require('mongodb');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'modelItems'});
 
let items = null;

function now(){ return new Date(); }

function getObjectId(id){
  if(!id.substr)
    return id;
  return new ObjectID(id);
}

let errorsList = {};
function pushError(codeTxt, code, msg){ errorsList[codeTxt] = {code, codeTxt, msg}; }
pushError('mongodb-problem', 500, 'problem with the database');
pushError('item-not-found', 400, 'cannot found the item');

class Items {
  constructor(){
    this.items = null;
  }
  
  async init(config){
    assert(config);
    assert(config.dbUrl);
    assert(config.dbName);
    log.info(`open database: '${config.dbUrl}' '${config.dbName}'`); 
    const client = new MongoClient(config.dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
    await client.connect();
    log.info('connected to the database');
    const db = client.db(config.dbName);
    this.items = db.collection('items');
  }
  
  async getAll(){
    return await this.items.find({}).toArray();
  }

  async get(id){
    let item = await this.items.findOne({_id:getObjectId(id)});
    if(!item)
      throw errorsList['item-not-found'];
    return item;
  }

  async pushStatus(id, status){
    await this.items.updateOne({_id:getObjectId(id)}, {$set: {status, lastUpdate:now()}});
  }

  async upsert(item){
    item.status = item.status || "unknown";
    let res = null;
    if(item._id)
      res = await this.items.update({_id:getObjectId(item._id)}, item);
    else
      res = await this.items.insertOne(item);
    return res.ops[0];
  }

  async reset(){
    return (await this.items.deleteMany({})).deletedCount;
  }
}

module.exports = Items;