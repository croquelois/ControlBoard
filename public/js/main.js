/* jshint undef: true, unused: true, sub:true, esversion:8, strict: global, browser: true */
/* globals $, Ajax, Cards, Screen, login, console */
"use strict";

(function(){ 

function initGlobalRefreshButton(cards){
  const btn = $("#refresh");
  btn.tooltip({title: "refresh all"});
  btn.click(async function(){
    btn.tooltip("hide");
    btn.prop('disabled', true);
    try {
      await cards.refreshAll();
    }catch(err){
      console.log(err);
    }
    btn.prop('disabled', false);
  });
}

async function start(cards){
  try {
    await login();
    cards.reset();
    let res = await Ajax.getList(localStorage.token);
    res.forEach(item => cards.add(item));
    $("#refresh").removeClass("d-none");
    $("#loading").addClass("d-none");
  }catch(err){
    Screen.fatal(err);
  }
}
  
$(function(){
  const cards = new Cards();
  initGlobalRefreshButton(cards);
  start(cards);
});

})();