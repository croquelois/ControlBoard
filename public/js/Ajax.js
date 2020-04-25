/* jshint undef: true, unused: true, sub:true, esversion:8, strict: global, browser: true */
/* globals $ */
/* exported Ajax */
"use strict";

let Ajax = (function(){

const serverurl = "/";
function reqPost(url,data){
  return new Promise(function(resolve,reject){
    $.ajax({ 
      type: "POST", 
      url: serverurl+url,
      data: JSON.stringify(data),
      contentType: "application/json; charset=UTF-8",
      processData: false
    }).done(ret => resolve(ret))
      .fail(err => reject(err));
  });
}

function userRead(token){
  return reqPost("user/read",{token});
}

async function userLogin(email,pass){
  if(!email)
    throw "Email is empty";
  if(!pass)
    throw "Password is empty";
  try {
    return await reqPost("user/login",{email,pass});
  }catch(err){
    switch(err.status){
      case 400: 
        throw "Invalid login or password";
      case 404: 
        throw "Unable to connect to the server";
      case 405: 
      case 500: 
        throw "Server error";
      default: 
        throw err;
    }
  }
}

function userLogout(token){
  return reqPost("user/logout",{token});
}

function getList(token){
  return reqPost("getList",{token});
}

function refresh(token,id){
  return reqPost("refresh",{token,id});
}

function action(token,id,type){
  return reqPost("action",{token,id,type});
}

return {userRead, userLogin, userLogout, getList, refresh, action};

})();