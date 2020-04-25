/* jshint undef: true, unused: true, sub:true, esversion:8, strict: global, browser: true */
/* globals $, Ajax */
/* exported login */
"use strict";

// return the user once logged
async function login(){
  if(localStorage.token){
    try {
      let user = await Ajax.userRead(localStorage.token);
      return user;
    }catch(err){
      localStorage.token = "";
    }
  }
  let prevColor;
  const alert = $("#login-alert");
  function refreshAlert(txt,color){
    if(!txt) 
      alert.hide();
    else 
      alert.show();
    if(prevColor) 
      alert.removeClass("alert-"+prevColor);
    color = color || "info";
    prevColor = color;
    alert.addClass("alert-"+color);
    alert.text(txt);
  }
  alert.removeClass("alert-info");
  alert.removeClass("alert-danger");
  alert.removeClass("alert-success");
  refreshAlert();
  $("#login-email").val(localStorage.email || "");
  $("#login-password").val(localStorage.password || "");
  $("#login").modal({keyboard: false, backdrop:'static'});
  
  return new Promise(function(resolve){
    $("#btn-login").click(function(){
      refreshAlert("Authorization...","info");
      let email = $("#login-email").val();
      let password = $("#login-password").val();
      Ajax.userLogin(email,password).then(user => {
        localStorage.email = email;
        localStorage.password = password;
        refreshAlert("Authorized","success");
        localStorage.token = user.token;
        $("#login").modal("hide");
        resolve(user);
      }).catch(err => refreshAlert(err, "danger"));
    });
  });
}
