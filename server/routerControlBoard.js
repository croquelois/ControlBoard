/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

const Items = require('./modules/items.js');
const bunyan = require('bunyan');
const util = require('./util.js');

const log = bunyan.createLogger({name: 'routerControlBoard'});

let errorsList = {};
function pushError(codeTxt, code, msg){ errorsList[codeTxt] = {code, codeTxt, msg}; }
pushError('not-supported', 400, 'the request is not supported');
pushError('item-invalid-id', 400, 'the id is not valid');
pushError('item-invalid-action-type', 400, 'invalid action');

const plugins = {
  "git": require('./plugins/git.js'),
  "website": require('./plugins/website.js'),
  "mongodb": require('./plugins/mongodb.js'),
  "postgres": require('./plugins/postgres.js'),
  "redis": require('./plugins/redis.js'),
  "server": require('./plugins/server.js'),
};

module.exports = async function(app, config){
  let items = new Items();
  await items.init(config);
  
  async function refresh(req){
    let id = req.body['id'];
    if(!id)
      throw errorsList['item-invalid-id'];
    let item = await items.get(id);
    let plugin = plugins[item.type];
    let check = (plugin && plugin(item).check);
    if(!check) 
      throw errorsList['not-supported'];
    item.status = await check();
    await items.pushStatus(id, item.status);
    return item;
  }

  async function action(req){
    let id = req.body['id'];
    if(!id)
      throw errorsList['item-invalid-id'];
    let type = req.body['type'];
    if(!type)
      throw errorsList['item-invalid-action-type'];
    let item = await items.get(id);
    log.info(`Action ${type} on ${item.name}`);
    let plugin = plugins[item.type];
    if(!plugin)
      throw new Error("unrecognized item type in the database: " + item.type);
    const actions = plugins[item.type](item).actions || {};
    if(!actions[type]) 
      throw errorsList['item-invalid-action-type'];
    return actions[type]();
  }

  function toClient(item){
    let plugin = plugins[item.type];
    if(!plugin)
      throw new Error("unrecognized item type in the database: " + item.type);
    return {
        _id: item._id,
        type: item.type,
        name: item.name,
        status: item.status,
        actions: Object.keys(plugins[item.type](item).actions || {})
    };
  }

  async function getList(/*req*/){
    return (await items.getAll()).map(toClient);
  }

  async function upsert(req){
    return items.upsert(req.body['item']);
  }

  const addPost = (url,fct,opt) => util.addPost(app, log, url, fct, opt);

  addPost("/getList",getList);
  addPost("/refresh",refresh);
  addPost("/action",action);
  addPost("/upsert",upsert);
};