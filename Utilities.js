/**
 * Utilities
 */

var crypto = require('crypto')
var moment = require('moment');

function BadArgumentError(message){
  this.message = message || 'Default Message';
}
BadArgumentError.prototype = Object.create(Error.prototype);
BadArgumentError.prototype.constructor = BadArgumentError;

exports.BadArgumentError = BadArgumentError;

exports.dbGenericCb =function(e,o,cb) 
{ 
  if(e) cb(400,'database issue happened'); 
  else  cb(null,o ? 'ok' : null); 
}

exports.decryptAndCheckEmail = function(email,cb) {      
  var safeemail = exports.removeHtml(email);	  
  if(!exports.checkEmail(safeemail)){
    try {   safeemail = exports.decrypt(safeemail); } 
    catch (err){   
      return cb(500, 'email wrongly encrypted');    }
  } else {
    return cb(406,'Email not encrypted');      
  }
  if(!exports.checkEmail(safeemail)) return cb(406,'Wrong email format');
       
  cb(null,safeemail);
}
  
exports.encrypt = function(text){
  var cipher = crypto.createCipher('aes-256-cbc','a8T9BgyQ')
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}
 
exports.decrypt = function(text){
  var decipher = crypto.createDecipher('aes-256-cbc','a8T9BgyQ')
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}

exports.checkEmail = function(email) {
  var regex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  return regex.test(email);
}

exports.cleanObject = function(obj){
  for(var prop in obj) {
    obj[prop] = exports.removeHtml(obj[prop]);
  }
  return obj;
}

exports.cleanJson = function(jsonDataInStr) {
  var jsonData = JSON.parse(jsonDataInStr);
  cleanObject(jsonDataInStr);
  return JSON.stringify(jsonData);
}

exports.removeHtml = function(html){
  if(!html.replace) return html;
  return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>?/gi, '');
}


exports.parseBoolean = function(str){
  if(!str || str.length==0) return false;
  str = str.toUpperCase();
  if(str == 'T' || str == "TRUE") return true;
  return false;
}

exports.dt2ext = function(dt){
  return moment(dt).format("YYYYMMDD-HHmmss")
}
  
exports.eventIntern2Extern = function(p){
  console.log(p);
  var createdDate = exports.dt2ext(p.arrival);
  var ret = {created:createdDate,title:p.title,pos:p.pos,desc:p.desc,id:p._id,nbmembers:p.nbmembers};
  if(!p.when || p.when == 'undefined') {
    ret.when = 'undefined';
  } else {
    ret.when = exports.dt2ext(p.when);
  }    
  if(!p.end || p.end == 'undefined') {
    ret.end = 'undefined';
  } else {
    ret.end = exports.dt2ext(p.end);
  }        
  if(p.joinDate) ret.joinDate = exports.dt2ext(p.joinDate);
  if(p.scope) ret.scope = p.scope;
  if(p.status) {
    ret.status = p.status;
  }    
  if(p.type) ret.type = p.type;
  if(p.joinStatus) ret.joinStatus = p.joinStatus;
  if(p.ownerName) ret.ownerName = p.ownerName;
  if(p.ownerId) ret.ownerId = p.ownerId;

  return ret;
}
  
exports.userIntern2Extern = function(u){
  var ret = {name:u.name,id:u._id};
  if(u.joinDate) ret.joinDate = exports.dt2ext(u.joinDate);
  return ret;
}
  
exports.waitingMemberIntern2Extern = function(u){
  var ret = exports.userIntern2Extern(u);
  if(u.reason) ret.reason = u.reason;
  return ret;
}

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1);
};

exports.generateuuid = function() {
  return s4() + s4()  + s4()   +
         s4()  + s4() + s4();
}