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

// user

function ajaxUserRead(token, cb){
  reqPost("user/read",{token:token},true,cb);
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

function ajaxGetList(token,cb){
  reqPost("getList",{token:token},true,cb);
}

function ajaxRefresh(token,id,cb){
  reqPost("refresh",{token:token,id:id},true,cb);
}

function ajaxAction(token,id,cb){
  reqPost("action",{token:token,id:id},true,cb);
}