/* jshint undef: true, unused: true, sub:true, esversion:8, strict: global, browser: true */
/* globals $, Ajax, console */
/* exported Cards */
"use strict";

var Cards = (function(){
  
const statusMapByType = {
  "git": {"up to date": "success", "behind": "danger", "error": "danger"},
  "website": {"online": "success", "down": "danger"},
  "mongodb": {"standalone": "success", "primary": "success", "down": "danger", "secondary": "warning", "unknown": "danger", "arbiter": "info", "proxy": "info"},
  "postgres": {"online": "success", "down": "danger"},
  "redis": {"online": "success", "down": "danger"},
  "server": {"online": "success", "down": "danger"},
};

class Card {
  constructor(elem){
    this.id = elem._id;
    this.type = elem.type;
    this.elem = elem;
    
    this.prevColor = null;
    this.statusMap = statusMapByType[this.type] || {};
    this.isBlocked = false;
    this.queuedRefreshResolve = [];
    this.buttons = [];
  }
  
  block(why){
    if(this.isBlocked) 
      return false;
    this.isBlocked = true;
    this.buttons.forEach(btn => btn.tooltip('hide'));
    this.buttons.forEach(btn => btn.prop('disabled', true));
    this.refreshStatus(why+"...","info");
    return true;
  }
  
  unblock(state){
    this.isBlocked = false;
    this.buttons.forEach(btn => btn.tooltip('hide'));
    this.buttons.forEach(btn => btn.prop('disabled', false));
    this.refreshStatus(state);
    this.queuedRefreshResolve.forEach(res => res());
    this.queuedRefreshResolve = [];
  }
  
  createRefreshButton(){
    const iconAction = $("<span>").addClass("oi oi-loop-circular");
    const btn = $("<button>").addClass("btn btn-success btn-xs").append(iconAction).tooltip({title: "refresh"});
    btn.click(() => this.refresh());
    this.buttons.push(btn);
    return btn;
  }
  
  createActionButton(actionType){
    const iconAction = $("<span>").addClass("oi");
    const btn = $("<button>").addClass("btn btn-danger btn-xs").append(iconAction);
    if(actionType == "update"){
      iconAction.addClass("oi-data-transfer-download");
      btn.tooltip({title: "update to the last version"});
    }else if(actionType == "restart"){
      iconAction.addClass("oi-reload");
      btn.tooltip({title: "restart the server"});
    }else if(actionType == "start"){
      iconAction.addClass("oi-media-play");
      btn.tooltip({title: "start the server"});
    }else if(actionType == "stop"){
      iconAction.addClass("oi-media-stop");
      btn.tooltip({title: "stop the server"});
    }
    btn.click(() => this.action(actionType));
    this.buttons.push(btn);
    return btn;
  }
  
  async action(actionType){
    this.block("updating");
    try {
      await Ajax.action(localStorage.token, this.id, actionType);
      let res = await Ajax.refresh(localStorage.token, this.id);
      return this.unblock(res.status);
    }catch(err){
      console.log(err);
      return this.unblock("error");
    }
  }
  
    
  refresh(){
    let promise = new Promise(resolve => this.queuedRefreshResolve.push(resolve));
    if(!this.block("refreshing"))
      return;
    Ajax.refresh(localStorage.token,this.id).then(res => this.unblock(res.status)).catch(err => {
      console.log(err);
      this.unblock("error");
    });
    return promise;
  }
  
  publish(){
    this.main = $("<div>").addClass("alert");
    $("#"+this.type).removeClass("d-none");
    $("#"+this.type+">div").append(this.main);
    
    const list = $("<ul>").addClass("list-inline").css("margin-bottom", 0);
    this.main.append(list);
    
    function addToCard(item){
      return list.append($("<li>").addClass("list-inline-item").append(item));
    }
    
    const title = $("<h5>").text(this.elem.name);
    addToCard(title);
    
    this.status = $("<div>");
    addToCard(this.status);
    this.refreshStatus(this.elem.status);

    addToCard(this.createRefreshButton());
    this.elem.actions.forEach(action => addToCard(this.createActionButton(action)));
  }

  refreshStatus(text,color){
    if(this.prevColor) 
      this.main.removeClass("alert-"+this.prevColor);
    if(!color) 
      color = this.statusMap[text] || "danger";
    this.prevColor = color;
    this.main.addClass("alert-"+color);
    this.status.text(text);
  }
}

class Cards {
  constructor(){
    this.list = [];
  }
  add(elem){
    let card = new Card(elem);
    this.list.push(card);
    card.publish();
  }
  refreshAll(){
    return Promise.all(this.list.map(card => card.refresh()));
  }
  reset(){
    $("#main-container>div").addClass("d-none");
    $("#main-container>div>div").empty();
    this.list = [];
  }
}

return Cards;
})();

