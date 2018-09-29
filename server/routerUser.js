"use strict";
var path = require('path');
var fs = require('fs');
var moment = require('moment');
var async = require('async');
var rimraf = require('rimraf');
var users = require('./modules/users.js');
var multipart = require('connect-multiparty');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: 'routerUser'});
var redis = require('redis');
var util = require('./util.js');

var buildGenCb = util.buildGenericCallbackFactory(log);
var noImpl = util.noImpl;

var validStatus = {"Admin":true,"Developer":true};

/** /user/signup
name: name
email: email
pass: pass
return: 200,'ok'
*/
function userSignup(req, res){          
  var  email = req.body['email'];
  var  name  = req.body['name'];
  var  pass  = req.body['pass'];
  if(!email || !name || !pass) return res.status(500).send('invalid request');
  email = email.toLowerCase();                    
  var logindata = {
    email : email,
    pass : pass,
    name : name
  };
  users.addNewAccount(logindata, function(err,data){
    log.info({email:email},"account created");
    buildGenCb(res)(err,data);
  });
}

/** /user/login
email: email
pass: password
return: 200,token
*/
function userLogin(req,res){
  var email = req.body['email'];
  var pass = req.body['pass'];
  console.log(email);
  console.log(pass);
  if(!email || !pass || typeof email != "string" || typeof pass != "string") return res.status(500).send('invalid request');
  email = email.toLowerCase();
  
  users.getToken(email, pass, function(e, token){
    log.info({email:email},"user login " + (e?"fail":"succeed"));
    if(!e) res.send(token);
    else res.status(400).send(e);
  });
}

/** /user/logout
token: token
return: 200,'ok'
*/
function userLogout(req,res){
  if(!req.user) return res.status(401).send('invalid token');
  users.destroyToken(req.body['token'], function(e){
    log.info({email:req.user.email},"user logout");
    if(!e) res.send('ok');
    else res.status(500).send('error');
  });
}

/** /user/delete
token: token
return: 200,'ok'
*/  
function userDelete(req, res){
  if(!req.user) return res.status(401).send('invalid token');
  log.info({email:req.user.email},"user delete");
  users.deleteAccount(req.user._id, buildGenCb(res));
}

function userAdminDelete(req, res){
  var cb = buildGenCb(res);
  if(!req.user) return res.status(401).send('invalid token');
  if(!validStatus[req.user.status]) return cb(403,"need admin right");
  var id  = req.body['userId'];
  if(!id) return cb(400, 'need user id');
  log.info({email:req.user.email, userId: id},"admin delete user");
  users.deleteAccount(id,cb);
}

/** /parameter
token: token
name: name
email: email
pass: pass
return: 200,'ok'
*/
function userUpdate(req, res){
  if(!req.user) return res.status(401).send('invalid token');
  var name  = req.body['name'];
  var email = req.body['email'];
  var pass  = req.body['pass'];
  if(!name && !email && !pass)  return res.send(500, 'invalid request');  
  throw "to be done"; // @@@@
  /*email = email.toLowerCase();
           
  users.updateAccount({
    userId: req.user._id,
    name: name,
    email: email,
    pass: pass
  },buildGenCb(res));*/
}
  
function userGetPublicInfo(req, res){
  if(!req.user) return res.status(401).send('invalid token');
  var id  = req.body['userId'];
  if(!id) return res.send(200, req.user.publicInfo);
  var cb = buildGenCb(res);
  users.getPublicInfo(id, cb);
}

function userUpdatePublicInfo(req, res){
  if(!req.user) return res.status(401).send('invalid token');
  var info = req.body['info'];
  var userId = req.body['userId'];
  if(userId && !validStatus[req.user.status]) return cb(403,"need admin right");
  var cb = buildGenCb(res);
  users.updatePublicInfo(userId || req.user._id, info, cb);
} 

function userGetPrivateInfo(req, res){
  if(!req.user) return res.status(401).send('invalid token');
  var userId = req.body['userId'];
  if(userId && !validStatus[req.user.status]) return cb(403,"need admin right");
  if(!userId) return res.send(200, req.user.privateInfo);
  var cb = buildGenCb(res);
  users.getPrivateInfo(userId, cb);
}

function userUpdatePrivateInfo(req, res){
  if(!req.user) return res.status(401).send('invalid token');
  var info = req.body['info'];
  var userId = req.body['userId'];
  if(userId && !validStatus[req.user.status]) return cb(403,"need admin right");
  var cb = buildGenCb(res);
  users.updatePrivateInfo(userId || req.user._id, info, cb);
}

function userCurrencyChange(req,res){
  if(!req.user) return res.status(401).send('invalid token');
  var currency = req.body['currency'];
  var userId = req.body['userId'];
  if(userId && !validStatus[req.user.status]) return cb(403,"need admin right");
  var cb = buildGenCb(res);
  users.updateCurrency(userId || req.user._id, currency, cb);
}
  
function userCurrencyGet(req,res){
  if(!req.user) return res.status(401).send('invalid token');
  var userId = req.body['userId'];
  if(userId && !validStatus[req.user.status]) return cb(403,"need admin right");
  var cb = buildGenCb(res);
  users.getCurrency(userId || req.user._id, cb);
}

function userRead(req, res){  
  if(!req.user) return res.status(401).send('invalid token');
  users.getUserFromId(req.user._id,buildGenCb(res));
}

function userVerification(req, res){
  var email = req.body['email'];
  var verificationToken = req.body['verificationToken'];
  users.verification(email, verificationToken, buildGenCb(res));
}

function userVerificationUrl(req, res){
  var cb = buildGenCb(res);
  var token = req.query.verifToken;
  if(!token) return cb(400,"no token specified");
  if(token.length <= 10) return cb(400,"token too short");
  try{
    users.verificationUrl(token, cb);
  }catch(err){
    return cb(500,"unable to verify your token"); 
  }
}

function userResetPasswordUrl(req, res){
  var cb = buildGenCb(res);
  var passToken = req.query.passToken;
  if(!passToken) return cb(400,"no token specified");
  if(passToken.length <= 10) return cb(400,"token too short");
  users.resetPasswordTokenInfo(passToken,function(err,o){
    if(err) return cb(500,err);
    var email = o.email;
    res.render('passwordReset',{email: email, passToken: passToken});
  });
}

function userAskResetPassword(req, res){
  var cb = buildGenCb(res);
  var email = req.body['email'];
  if(!email) return cb(400,"no email specified");
  users.askResetPassword(email,cb);
}

function userResetPassword(req, res){
  var cb = buildGenCb(res);
  var passToken = req.body['passToken'];
  var pass = req.body['pass'];
  if(!passToken) return cb(400,"no token specified");
  if(!pass) return cb(400,"password is empty");
  if(passToken.length <= 10) return cb(400,"token too short");
  users.resetPassword(passToken,pass,cb);
}
/*
function userCreateCroq(req, res){
  users.addNewAccount({email:"croquelois@gmail.com",pass:"croq",name:"Croq"}, {noVerif:true}, buildGenCb(res));
}
*/
function userChangePhoto(req, cb){
  var file = req.files.file;
  if(!file) return cb(400, "no file");
  var okExt = {".jpeg":true,".jpg":true,".gif":true,".png":true};
  var error;
  if(file.size > 2*1024*1024) error = (error?(error+","):"")+"file too big (max 2MB)";
  else if(!okExt[path.extname(file.path).toLowerCase()]) error = (error?(error+","):"")+"unsupported extension ("+path.extname(file.path)+")";
  
  if(error){
    console.log("error, userChangePhoto", error);
    return cb(error);
  }else{
    var dest = path.join("public/img/",path.basename(file.path));
    util.copyFile(file.path,dest,function(err,res){
      if(err) return cb(500,err);
      // change photo in db, and remove previous
      // be carreful you have changed connect-multiparty, need to fork and deploy on github
      return cb(null,{file:path.basename(file.path)});
    });
  }
}

function stream(req,res){
  var sub = redis.createClient();
  var messageCount = 0;
  sub.on("message", function(channel, message){
    messageCount++;
    res.write('id: ' + messageCount + '\n');
    res.write("data: " + message + '\n\n');
  });
  sub.subscribe(""+req.user._id);
  req.on("close", function() {
    sub.unsubscribe();
    sub.end();
  });
  res.status(200);
  res.writeHead({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('\n');
}

module.exports = function(app) {
  var tmpUserDir = "temp/img/user";
  function addPost(url,fct){
    app.post(url, function(req,res){
      try{ 
        fct(req,res);
      }catch(err){ 
        log.error(err.stack?err.stack:err,"try/catch"); 
        res.status(500).send(err.stack?err.stack:err); 
      }
    });
  }
  function addPostFile(url, fct){
    fs.mkdir(tmpUserDir,function(err){
      function cleanDir(){ rimraf(tmpUserDir,{disableGlob:true},function(err){ log.error(err); }); }
      function cleanFiles(files){
        async.map(files,function(file,cb){
          return fs.unlink(file,function(err){
            if(err) console.log("fail to delete tmp image ", file, err);
            return cb();
          }); 
        },function(){});
      }
      app.post(url, multipart({uploadDir:tmpUserDir}), users.tokenUser, function(req,res){
        if(!req.user){
          cleanFiles(req.allFiles);
          return res.status(401).send('invalid token');
        }
        try{ 
          var cb = buildGenCb(res);
          fct(req,function(err,res){
            cleanFiles(req.allFiles);
            cb(err,res);
          });
        }catch(err){ 
          cleanFiles(req.allFiles);
          log.error(err.stack?err.stack:err,"try/catch"); 
          res.status(500).send(err.stack?err.stack:err); 
        }
      });    
    });
  }
  
  function addGet(url,fct){
    app.get(url, function(req,res){
      try{ 
        fct(req,res);
      }catch(err){ 
        log.error(err.stack?err.stack:err,"try/catch"); 
        res.status(500).send(err.stack?err.stack:err); 
      }
    });
  }
  function addStream(url,fct){
    app.get(url, function(req,res){
      if(!req.user) return res.status(401).send('invalid token');
      req.socket.setTimeout(24*60*60*1000);
      try{ 
        fct(req,res);
      }catch(err){ 
        log.error(err.stack?err.stack:err,"try/catch"); 
        res.status(500).send(err.stack?err.stack:err); 
      }          
    });
  }
  addPost('/user/signup', userSignup); // email, password, name -> token/Error
  addPost('/user/verification', userVerification); // email, verificationToken -> Ok/Error
  addPost('/user/askResetPassword', userAskResetPassword); // email -> Ok/Error + Mail
  addPost('/user/resetPassword', userResetPassword); // passToken, newPass -> Ok/Error
  addPost('/user/delete', userDelete); // token -> Ok/Error
  addPost('/user/login', userLogin); // email, password -> token/Error
  addPost('/user/logout', userLogout); // token -> Ok/Error
  addPost('/user/update', userUpdate); // token, newPasswd -> Ok/Error
  addPost('/user/read', userRead); // token -> [...]
  
  
  addPost('/user/publicInfo/get', userGetPublicInfo);
  addPost('/user/publicInfo/update', userUpdatePublicInfo);
  addPostFile('/user/changePhoto', userChangePhoto);
  
  addPost('/user/privateInfo/get', userGetPrivateInfo);
  addPost('/user/privateInfo/update', userUpdatePrivateInfo);
  
  addPost('/user/currency/change', userCurrencyChange);
  addPost('/user/currency/get', userCurrencyGet);
  
  addPost('/user/admin/delete', userAdminDelete); // token, uid -> Ok/Error
  
  addGet('/userVerification', userVerificationUrl); // verificationToken -> Ok/Error
  addGet('/userResetPassword', userResetPasswordUrl); //  passToken -> page
  
  // Debuging stuff
  //addGet('/user/createCroq', userCreateCroq);
  addStream('/user/stream', stream);
};