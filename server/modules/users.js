"use strict";
var crypto = require('crypto');
var moment = require('moment');
var async = require('async');
var assert = require('assert');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: 'modelUsers'});
var utilities    = require('../../Utilities');
var config    = require('../../config.js');
 
var users;
var contacts;
var tokens;

function now(){ return new Date(); }
var dbSettings = require('./db-settings');
dbSettings.get(function(err,db){
  if(err) throw new Error("Unable to connect to the db: '"+ err + "'");
  users = db.collection('users');
  contacts = db.collection('contacts');
  tokens = db.collection('tokens');
});
exports.waitDB = dbSettings.get;
var getObjectId = dbSettings.getObjectId;

var errorsList = {
  'user-invalid-token':             {code:400,codeTxt:'user-invalid-token',             msg:'the token is invalid'},
  'user-invalid-reset-token':       {code:400,codeTxt:'user-invalid-reset-token',       msg:'the reset token is invalid'},
  'user-email-not-found':           {code:400,codeTxt:'user-email-not-found',           msg:'cannot found a user with this email'},
  'user-email-taken':               {code:400,codeTxt:'user-email-taken',               msg:'email already taken'},
  'user-email-incorrect':           {code:400,codeTxt:'user-email-incorrect',           msg:'the format of the email is incorrect'},
  'user-invalid-password':          {code:400,codeTxt:'user-invalid-password',          msg:'the password is incorrect'},
  'user-db-empty':                  {code:400,codeTxt:'user-db-empty',                  msg:'the database is empty'},
  'user-not-found':                 {code:400,codeTxt:'user-not-found',                 msg:'cannot found the user'},
  'user-already-verified':          {code:400,codeTxt:'user-already-verified',          msg:'the user has already been verified'},
  'user-invalid-id':                {code:400,codeTxt:'user-invalid-id',                msg:'the id is not valid'}
};

var cleanAccount = function(acc) {
  if(acc.name) acc.name = utilities.removeHtml(acc.name);
  if(acc.email) acc.email = utilities.removeHtml(acc.email);    
  return acc;
};

function logCb(cb){
  return function(err,res){
    console.log(err,res);
    cb(err,res);
  };
}

exports.tokenUser = function(req,res,next){
  var token = req.body['token'];
  if(!token) token = req.query['token'];
  if(!token) return next();
  exports.getUserFromToken(token,function(e,user){
    if(e) return res.send(500,'db problem');
    if(!user) return res.send(401,'invalid-token');
    req.user = user;
    next();
  });
};
  
var tokenExtract = function(str){
  assert(str);
  var len = str.length;
  assert(len > 10);
  return {_id:getObjectId(str.substr(0,len-10)),salt:str.substr(len-10,10)};
};

exports.getToken = function(email, pass, callback){
  assert(email); assert(pass); assert(typeof callback == 'function');
  email = email.toLowerCase();
  users.findOne({email:email}, function(e, user) {
    if(e) return callback(e);
    if(!user) return callback(errorsList['user-email-not-found']);
    validatePassword(pass, user.pass, function(err, res) {
      if(!res) return callback(errorsList['user-invalid-password']);
      var salt = generateSalt();
      tokens.insertOne({user:user._id,salt:salt,expirationTime:moment.utc().add(1,"days").toDate()}, {safe: true}, function(err,res){
        if(err) callback(err);
        else callback(null,{token:""+res.ops[0]._id+salt,userId:user._id,status:user.status,name:user.name,gravatar:user.gravatar});
      });
    });
  });
};

exports.destroyToken = function(id, callback){
  if(id.length < 10) return callback(errorsList["user-invalid-token"]);
  tokens.deleteOne(tokenExtract(id), function(err, res) {
    return callback(err,res && (res.matchedCount == 1));
  });
};

exports.getUserFromToken = function(id, callback){
  try{
    tokens.findOne(tokenExtract(id), function(e, token) {
      if(e) return callback(e);
      if(!token) return callback(errorsList["user-invalid-token"]);
      users.findOne({_id: token.user}, function(e, user) {
        if(e) return callback(e);
        callback(null,user);
      });
    });  
  }catch(err){ return callback(err); }
};

exports.get = function(opt,callback){
  if(!callback){ 
    callback = opt; 
    opt = {};
  }
  var q = {};
  if(opt.adminOnly){
   q.status = {$in: ["Admin","Developer"]};
  }
  users.find(q).toArray(function(e,users){
    if(e) return callback(e);
    if(!users) return callback(null,[]);
    var okField = {email:true,name:true,_id:true,date:true,status:true,verified:true,gravatar:true,currency:true};
    callback(null, users.map(function(u){ 
      var u2 = {};
      for(var k in u)
        if(okField[k])
          u2[k] = u[k];
      return u2; 
    }));
  });
};

exports.getUserFromId = function(id, callback){
  if(id.map){ // then it's an array
    var ids = id.map(getObjectId);
    var userMap = {};
    users.find({_id: { $in: ids}}).toArray(function(e,users){
      if(e) return callback(e);
      if(!users) users = [];
      users.forEach(function(user){ 
        delete user.pass;
        userMap[user._id] = user; 
      });  // Fill the user map
      callback(null, ids.map(function(id){ return userMap[id]; })); // reorder the users 
    });
  }else{ // else it's an id
    findById(id, function(e, user) {
      if(e) return callback(e);
      if(!user) return callback(errorsList['user-not-found']);
      delete user.pass;
      callback(null,user);
    });
  }
};
  
exports.getUserFromEmail = function(email, callback){
  email = email.toLowerCase();  
  users.findOne({email:email}, function(e, user){ 
    if(e) return callback(e);
    if(!user) return callback(errorsList['user-email-not-found']);
    callback(null,user); 
  });
};

exports.getUserIdFromEMail = function(email, callback){
  email = email.toLowerCase();
  exports.getUserFromEmail(email, function(e, user) {
    if(e) return callback(e);
    callback(null,user._id);
  });
};

exports.createRandomAccount = function(cb){
  users.insertOne({name:generateSalt(),email:(generateSalt()+"@"+generateSalt()+".com").toLowerCase(),verified:true,isTest:true}, function(err,res){
    if(err) return cb(err);
    return cb(err,res.ops[0]);
  });
};

var processSubscribe = function(newData,opt,callback) {
  if(!callback){
    callback = opt;
    opt = {};
  }
  newData.email = newData.email.toLowerCase();

  users.findOne({email:newData.email}, function(e, o) {
    if(o) return callback(errorsList['user-email-taken']);
    if(!utilities.checkEmail(newData.email)) return callback(errorsList['user-email-incorrect']);
    
    saltAndHash(newData.pass, function(hash){
      newData.pass = hash;
      newData.date = moment().format('YYYY-MM-DD HH:mm:ss');
      newData.status = 'user';
      newData.gravatar = md5(newData.email);
      newData.verified = true;
      users.insertOne(cleanAccount(newData), function(err,data){
        if(err) return callback(err,data);
        if(data.ops.length === 0) return callback(err,null);
        var user = data.ops[0];
        contacts.updateOne({myEmail: newData.email}, {$set: {userId: user._id}},function(err,res){
          return callback(null, {_id:user._id, email: newData.email, gravatar: newData.gravatar, name: newData.name});
        });
      });
    });
  }); 
};

exports.addNewAccount = function(newData, opt, callback){
  processSubscribe(newData, opt, callback);
};

exports.askResetPassword = function(email, callback){
  email = email.toLowerCase();
  users.findOne({email:email}, function(e, o) {
    if(!o) return callback(errorsList['user-not-found']);
    var salt = generateSalt();
    users.updateOne({_id:o._id}, {$set: {resetPasswordToken:salt}}, function(err, res){
      if(err) return callback(err);
      var options = { 
        recipients: o.email,
        subject: 'Password reset',
        from: config.rootMail,
        template: 'password_reset',
        variables: {
            'name': o.name,
            'url': config.url+"/userResetPassword?passToken="+o._id+salt
        }
      };
      postageapp.sendMessage(options);
      return callback();
    });
  }); 
};

exports.resetPasswordTokenInfo = function(token, callback){
  token = tokenExtract(token);
  var salt = token.salt;
  var id = getObjectId(token._id);
  users.findOne({_id:id}, function(e, o) {
    if(e) return callback(e);
    if(!o) return callback(errorsList['user-not-found']);
    if(o.resetPasswordToken != salt) return callback(errorsList['user-invalid-reset-token']);
    return callback(null,o);
  }); 
};

exports.resetPassword = function(token, newPass, callback){
  token = tokenExtract(token);
  var salt = token.salt;
  var id = getObjectId(token._id);
  users.findOne({_id:id}, function(e, o) {
    if(e) return callback(e);
    if(!o) return callback(errorsList['user-not-found']);
    if(o.resetPasswordToken != salt) return callback(errorsList['user-invalid-reset-token']);
    saltAndHash(newPass, function(hash){
      users.updateOne({_id: o._id}, {$set: {pass: hash}, $unset: {resetPasswordToken: true}}, function(e,o){
        return callback(e);
      });
    });
  }); 
};

exports.updateAccount = function(newData, callback){
  var set = {};
  if(newData.name){ set.name = newData.name; }
  if(newData.email){
    set.email = newData.email.toLowerCase();
    set.gravatar = md5(newData.email);
  }
  if(!newData.pass){
    users.updateOne({_id:getObjectId(newData.userId)}, {$set: set}, function(err,res){
      return callback(err,res && (res.matchedCount == 1));
    });
  }else{
    saltAndHash(newData.pass, function(hash){
      set.pass = hash;
      users.updateOne({_id:getObjectId(newData.userId)}, {$set: set},function(err,res){
        return callback(err,res && (res.matchedCount == 1));
      });
    });
  }
};

exports.updatePassword = function(email, newPass, callback){
  saltAndHash(newPass, function(hash){
    users.updateOne({email:email}, {$set: {pass: hash}}, callback);
  });
};

exports.deleteAccount = function(id, callback){
  assert(id);
  users.removeOne({_id: getObjectId(id)}, callback);
};

exports.massDelete = function(ids,cb){
  assert(ids);
  assert(ids.map);
  ids = ids.map(getObjectId);
  users.deleteMany({_id: {$in: ids}},function(err,res){
    return cb(err,res && (res.deletedCount == ids.length));
  });
};

exports.getUsersById = function(ids,callback){
  users.find({_id: {$in: ids}}).toArray(callback);
};

exports.updatePublicInfo = function(id, info, callback){
  users.updateOne({_id: getObjectId(id)},{$set: {publicInfo: info}},function(err,res){
    return callback(err,res && (res.matchedCount == 1));
  });
};

exports.getCurrency = function(id, callback){
  findById(id,function(e,user){
    if(e) return callback(e,user);
    if(!user) return callback(errorsList['user-not-found']);
    return callback(e,user.currency);
  });
};

exports.getPublicInfo = function(id, callback){
  findById(id,function(e,user){
    if(e) return callback(e,user);
    if(!user) return callback(errorsList['user-not-found']);
    return callback(e,user.publicInfo);
  });
};

exports.updateCurrency = function(id, currency, callback){
  users.updateOne({_id: getObjectId(id)},{$set: {currency: currency}},function(err,res){
    return callback(err,res && (res.matchedCount == 1));
  });
};

exports.updatePrivateInfo = function(id, info, callback){
  users.updateOne({_id: getObjectId(id)},{$set: {privateInfo: info}},function(err,res){
    return callback(err,res && (res.matchedCount == 1));
  });
};

exports.getPrivateInfo = function(id, callback){
  findById(id,function(e,user){
    if(e) return callback(e);
    if(!user) return callback(errorsList['user-not-found']);
    return callback(null,user.privateInfo||{});
  });
};

exports.getHash = function(id, callback){
  findById(id,function(e,o){
    if(e || !o) return callback(e,o);
    return callback(e,o.gravatar);
  });
};

/* private encryption & validation methods */

var generateSalt = function(){
  var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
  var salt = '';
  for (var i = 0; i < 10; i++) {
  var p = Math.floor(Math.random() * set.length);
  salt += set[p];
  }
  return salt;
};

var md5 = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
};

var saltAndHash = function(pass, callback){
  var salt = generateSalt();
  callback(salt + md5(pass + salt));
};

var validatePassword = function(plainPass, hashedPass, callback){
  var salt = hashedPass.substr(0, 10);
  var validHash = salt + md5(plainPass + salt);
  callback(null, hashedPass === validHash);
};

/* auxiliary methods */

var findById = function(id, callback){
  try {
    users.findOne({_id: getObjectId(id)},
    function(e, res) {
      if (e) callback(e);
      else callback(null, res);
    });
  }catch(err){
    callback(errorsList['user-invalid-id']);
  }    
};

exports.setUserStatus = function(userId,status,callback){
  assert(userId);
  assert(typeof status == 'string');
  assert(typeof callback == 'function');
  users.updateOne({_id : getObjectId(userId)}, {$set: {status: status}}, function(err,res){
    if(!res.matchedCount) return callback(errorsList['user-not-found']);
    return callback(err);
  });
};  

exports.delAllRecords = function(callback){
  assert(typeof callback == 'function');
  users.deleteMany({}, function(){
    tokens.deleteMany({}, callback);
  });  
};

exports.checkExpiredTokens = function(cb){
  if(!tokens) return cb(); // db not ready
  tokens.deleteMany({expirationTime: {$lt: now()}},cb);
};