"use strict";

var reqPost = function(){
  var serverurl = "/";
  var dlgParam = {};
  var nb = 0;
  function lock(){  
    if(!(nb++)){
      $("#waitDlg").modal({keyboard: false,backdrop:"static"}); 
      console.log("block!");
    }
  }
  function free(){  
    if(!(--nb)){
      $("#waitDlg").modal('hide'); 
      console.log("unblock!");
    }
  }
  return function(url,data,block,cb){
    cb = cb || function(){};
    var delayedCb = function(err,res){ 
      if(block) free(); 
      //setTimeout(cb.bind(null,err,res),500); 
      setTimeout(function(){
        console.log("cb ", url, block);
        cb(err,res);
      },50); 
    }
    if(block) lock();
    $.ajax(
      { 
        type: "POST", 
        url: serverurl+url,
        data: JSON.stringify(data),
        contentType: "application/json; charset=UTF-8",
        processData: false
      }
     ).done(function(ret){ delayedCb(null,ret); })
      .fail(function(err){ delayedCb(err,null); });
	}
}();

// transaction

function ajaxTransactionCreate(token, destId, quoteId, cb){
  reqPost("transaction/create",{token:token,destId:destId,quoteId:quoteId},true,cb);
}

function ajaxTransactionList(token, cb){
  reqPost("transaction/list",{token:token},true,cb);
}

function ajaxTransactionRead(token, transId, cb){
  reqPost("transaction/read",{token:token,transId:transId},true,cb);
}

function ajaxTransactionRemove(token, transId, cb){
  reqPost("transaction/remove",{token:token,transId:transId},true,cb);
}

function ajaxTransactionMarkAsReviewed(token, transId, cb){
  reqPost("transaction/markAsReviewed",{token:token,transId:transId},true,cb);
}

// contact

function ajaxContactList(token, cb){
  reqPost("contact/list",{token:token},true,cb);
}

function ajaxContactAccept(token, contactId, cb){
  reqPost("contact/accept",{token:token,contactId:contactId},true,cb);
}

function ajaxContactCreate(token, email, cb){
  reqPost("contact/create",{token:token,email:email},true,cb);
}

function ajaxContactRemove(token, contactId, cb){
  reqPost("contact/remove",{token:token,contactId:contactId},true,cb);
}

function ajaxContactUpdate(token, contactId, email, cb){
  reqPost("contact/update",{token:token,contactId:contactId,email:email},true,cb);
}

function ajaxContactRead(token, contactId, cb){
  reqPost("contact/read",{token:token,contactId:contactId},true,cb);
}

// misc
/*
function ajaxGetAmountSend(token, curncy, pay, cb){
  reqPost("getAmountSend",{token:token,curncy:curncy,pay:pay},false,cb);
}*/
function ajaxGetAmountReceived(token, curncy, pay, cb){
  reqPost("getAmountReceived",{token:token,curncy:curncy,pay:pay},false,cb);
}
function ajaxAdminGetInfo(token, cb){
  reqPost("admin/getInfo",{token:token},false,cb);
}
// user

function ajaxUserRead(token, cb){
  reqPost("user/read",{token:token},true,cb);
}

function ajaxUserAskResetPassword(email, cb){
  reqPost("user/askResetPassword",{email:email},true,cb);
}

function ajaxUserResetPassword(passToken, pass, cb){
  reqPost("user/resetPassword",{passToken:passToken, pass:pass},false,cb);
}

function ajaxUserLogin(email,pass,cb){
  if(!email) return cb("Email is empty");
  if(!pass) return cb("Password is empty");
  reqPost("user/login",{email:email,pass:pass},false,function(err,res){
    if(err){
      switch(err.status){
        case 400: return cb("Invalid login or password");
        case 404: return cb("Unable to connect to the server");
        case 405: 
        case 500: return cb("Server error");
        default: return cb(err);
      }
    }
    return cb(null,res);
  });
}

function ajaxUserLogout(token,cb){
  reqPost("user/logout",{token:token},true,cb);
}

function ajaxUserRemove(token,cb){
  reqPost("user/remove",{token:token},true,cb);
}

function ajaxUserSignup(email,pass,name,opt,cb){
  var req = {pass:pass,email:email,name:name};
  if(!email) return cb("Email is empty");
  if(!pass) return cb("Password is empty");
  if(!name) return cb("Name is empty");
  for(var k in opt) req[k] = opt[k];
  reqPost("user/signup",req,false,function(err,res){
    if(err){
      switch(err.status){
        case 400: return cb("Invalid login or password");
        case 404: return cb("Unable to connect to the server");
        case 406:
          if(err.responseText == "email-taken") return cb("Email already used");
          else return cb(err.responseText);
        case 405: 
        case 500: return cb("Server error");
        default: return cb(err);
      }
    }
    return cb(null,res);
  });
}


function ajaxGetList(token,cb){
  reqPost("getList",{token:token},true,cb);
}

function ajaxRefresh(token,id,cb){
  reqPost("refresh",{token:token,id:id},true,cb);
}

function ajaxUpdate(token,id,cb){
  reqPost("update",{token:token,id:id},true,cb);
}