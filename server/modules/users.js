/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

const crypto = require('crypto');
const moment = require('moment');
const assert = require('assert');
const {MongoClient, ObjectID} = require('mongodb');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'modelUsers'});

let errorsList = {};
function pushError(codeTxt, code, msg){ errorsList[codeTxt] = {code, codeTxt, msg}; }
pushError('user-invalid-token', 400, 'the token is invalid');
pushError('user-email-not-found', 400, 'cannot found a user with this email');
pushError('user-email-taken', 400, 'email already taken');
pushError('user-email-incorrect', 400, 'the format of the email is incorrect');
pushError('user-invalid-password', 400, 'the password is incorrect');
pushError('user-database-error', 400, 'error in the database');

/* helpers */

function now(){ return new Date(); }

function getObjectId(id){
  if(!id.substr)
    return id;
  return new ObjectID(id);
}

const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
function checkEmail(email) {
  return emailRegex.test(email);
}

const htmlTagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>?/gi;
function removeHtml(html){
  if(!html.replace)
    return html;
  return html.replace(htmlTagRegex, '');
}

function cleanAccount(acc) {
  if(acc.name) 
    acc.name = removeHtml(acc.name);
  if(acc.email) 
    acc.email = removeHtml(acc.email);    
  return acc;
}

function tokenExtract(str){
  assert(str);
  const len = str.length;
  assert(len > 10);
  return {_id:getObjectId(str.substr(0,len-10)),salt:str.substr(len-10,10)};
}

/* private encryption & validation methods */

function generateSalt(){
  const set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
  let salt = '';
  for(let i = 0; i < 10; i++)
    salt += set[Math.floor(Math.random() * set.length)];
  return salt;
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function saltAndHash(pass){
  const salt = generateSalt();
  return salt + md5(pass + salt);
}

function isPasswordCorrect(plainPass, hashedPass){
  const salt = hashedPass.substr(0, 10);
  const validHash = salt + md5(plainPass + salt);
  return (hashedPass === validHash);
}

/* Users class */

class Users {
  constructor(){
    this.users = null;
    this.tokens = null;
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
    this.users = db.collection('users');
    this.tokens = db.collection('tokens');
  }

  tokenUser(req, res, next){
    let ip = req.ip;
    let token = req.body['token'];
    if(!token)
      token = req.query['token'];
    if(!token)
      return next();
    if(!token.substr || token.length <= 10){
      log.warn({ip, token}, "token rejected, too short");
      return res.status(401).send(errorsList['user-invalid-token']);
    }
    this.getUserFromToken(token).then(user => {
      if(!user){
        log.warn({ip, token}, "token rejected, not link with a user");
        return res.status(401).send(errorsList['user-invalid-token']);
      }
      delete user.pass;
      req.user = user;
      next();
    }).catch(err => res.status(err.code || 500).send(err));
  }
  
  async getUserFromToken(id){
    const token = await this.tokens.findOne(tokenExtract(id));
    if(!token) 
      return null;
    return await this.users.findOne({_id: token.user});
  }

  async getUserFromEmail(email){
    email = email.toLowerCase();  
    const user = await this.users.findOne({email});
    if(!user) 
      throw errorsList['user-email-not-found'];
    return user;
  }

  async getToken(email, pass){
    assert(email); 
    assert(pass); 
    email = email.toLowerCase();
    const user = await this.users.findOne({email});
    if(!user) 
      throw errorsList['user-email-not-found'];
    if(!isPasswordCorrect(pass, user.pass))
      throw errorsList['user-invalid-password'];
    
    const salt = generateSalt();
    const expirationTime = moment.utc().add(1,"days").toDate();
    const res = await this.tokens.insertOne({user:user._id,salt,expirationTime}, {safe: true});
    const token = ""+res.ops[0]._id+salt;
    return {token, userId:user._id, status:user.status, name:user.name, gravatar:user.gravatar};
  }
  
  async destroyToken(id){
    if(id.length < 10) 
      throw errorsList["user-invalid-token"];
    let res = await this.tokens.deleteOne(tokenExtract(id));
    return (res.matchedCount == 1);
  }
  
  async addNewAccount(newData){
    newData.email = newData.email.toLowerCase();
    newData.pass = saltAndHash(newData.pass);
    newData.date = moment().format('YYYY-MM-DD HH:mm:ss');
    newData.status = 'user';
    newData.gravatar = md5(newData.email);
    newData.verified = true;
    cleanAccount(newData);
    
    const email = newData.email;
    if(!checkEmail(email)) 
      throw errorsList['user-email-incorrect'];
    
    const existingUser = await this.users.findOne({email});
    if(existingUser)
      throw errorsList['user-email-taken'];
    
    const data = await this.users.insertOne(newData);
    if(!data || !data.ops || !data.ops.length) 
      throw new Error("Database error: Unable to insert the new account");
    
    const user = data.ops[0];
    return {_id:user._id, email: newData.email, gravatar: newData.gravatar, name: newData.name};
  }

  async deleteAccount(id){
    await this.users.removeOne({_id: getObjectId(id)});
  }

  async checkExpiredTokens(){
    await this.tokens.deleteMany({expirationTime: {$lt: now()}});
  }
}

module.exports = Users;
