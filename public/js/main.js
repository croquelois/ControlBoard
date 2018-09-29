$(function(){
  var listElem = [];
  var statusMapByType = {
    "git": {"up to date": "success", "behind": "danger", "error": "danger"},
    "server": {"online": "success", "down": "danger"},
    "mongo": {"online": "success", "primary": "success", "down": "danger", "secondary": "warning"},
    "postgres": {"online": "success", "down": "danger"},
    "redis": {"online": "success", "down": "danger"},
  }
  
  function add(elem){
    var prevColor;
    var statusMap = statusMapByType[elem.type] || {};
    var isBlocked = false;
    var toCallWhenUnblocked = [];
    function refreshStatus(text,color){
      if(prevColor) main.removeClass("alert-"+prevColor);
      if(!color) color = statusMap[text] || "danger";
      prevColor = color;
      main.addClass("alert-"+color);
      status.text(text);
    }
    var main = $("<div>").addClass("alert");
    var list = $("<ul>").addClass("list-inline");
    var name = $("<strong>").text(elem.name);
    var status = $("<div>");
    refreshStatus(elem.status);
    var btnRefresh = $("<button>").addClass("btn btn-success btn-xs").append($("<span>").addClass("glyphicon glyphicon-refresh")).tooltip({title: "refresh"});
    var iconAction = $("<span>").addClass("glyphicon");
    var btnAction = $("<button>").addClass("btn btn-danger btn-xs").append(iconAction);
    main.append(list);
    list.append($("<li>").append(name));
    list.append($("<li>").append(status));
    function block(why){
      if(isBlocked) return false;
      isBlocked = true;
      btnRefresh.tooltip('hide');
      btnAction.tooltip('hide');
      btnRefresh.prop('disabled', true);
      btnAction.prop('disabled', true);
      refreshStatus(why+"...","info");
      return true;
    }
    function unblock(state){
      isBlocked = false;
      btnRefresh.tooltip('hide');
      btnAction.tooltip('hide');
      btnRefresh.prop('disabled', false);
      btnAction.prop('disabled', false);
      refreshStatus(state);
      console.log(toCallWhenUnblocked);
      toCallWhenUnblocked.forEach(function(fct){ fct(); });
      toCallWhenUnblocked = [];
    }
    function queueFct(fct){
      toCallWhenUnblocked.push(fct);
    }
    function refresh(cbFct){
      if(cbFct) queueFct(cbFct);
      if(!block("refreshing")) return;
      ajaxRefresh(localStorage.token,elem.id,function(err,res){
        if(err){
          console.log(err);
          return unblock("error");
        }
        unblock(res.status);
      });
    }
    listElem.push(refresh);
    btnRefresh.click(function(){ refresh(); });
    btnAction.click(function(){
      block("updating");
      ajaxUpdate(localStorage.token,elem.id,function(err,res){
        if(err){
          console.log(err);
          return unblock("error");
        }
        ajaxRefresh(localStorage.token,elem.id,function(err,res){
          if(err){
            console.log(err);
            return unblock("error");
          }
          unblock(res.status);
        });
      });
    });
    list.append($("<li>").append(btnRefresh));
    if(elem.type == "git"){
      iconAction.addClass("glyphicon-download");
      btnAction.tooltip({title: "pull the last version"});
      list.append($("<li>").append(btnAction));
    }else if(elem.type == "server"){
      iconAction.addClass("glyphicon-repeat");
      btnAction.tooltip({title: "restart the web server"});
      list.append($("<li>").append(btnAction));
    }
    $("#"+elem.type).append(main);
  }
  
  function reset(){
    $("#git").empty();
    $("#server").empty();
    $("#mongo").empty();
    $("#redis").empty();
    $("#postgres").empty();
    listElem = [];
  }
  
  function login(cbFct){
    if(localStorage.token){
      return ajaxUserRead(localStorage.token, function(err,res){
        if(err){
            localStorage.token = "";
            return login(cbFct);
        }
        return cbFct();
      });
    }
    var prevColor;
    var alert = $("#login-alert");
    function refreshAlert(text,color){
      if(!text) alert.hide();
      else alert.show();
      if(prevColor) alert.removeClass("alert-"+prevColor);
      color = color || "info";
      prevColor = color;
      alert.addClass("alert-"+color);
      alert.text(text);
    }
    alert.removeClass("alert-info");
    alert.removeClass("alert-danger");
    alert.removeClass("alert-success");
    refreshAlert();
    $("#login-email").val(localStorage.email || "");
    $("#login-password").val(localStorage.password || "");
    $("#login").modal({backdrop:'static'});
    $("#btn-login").click(function(){
      refreshAlert("Authorization...","info");
      var email = $("#login-email").val();
      var password = $("#login-password").val();
      ajaxUserLogin(email,password,function(err,res){
        if(err) return refreshAlert(err, "danger");
        localStorage.email = email;
        localStorage.password = password;
        refreshAlert("Authorized","success");
        localStorage.token = res.token;
        $("#login").modal("hide");
        return cbFct();
      });
    });
  }
  
  $("#refresh").tooltip({title: "refresh all"});
  $("#refresh").click(function(){
    $("#refresh").tooltip("hide");
    $("#refresh").prop('disabled', true);
    async.forEach(listElem, function(fct,cbFct){ return fct(cbFct); }, function(){
      $("#refresh").prop('disabled', false);
    });
  });
  
  login(function(){
    ajaxGetList(localStorage.token,function(err,res){
      if(err) return;
      reset();
      res.forEach(add);
    });
  });
});