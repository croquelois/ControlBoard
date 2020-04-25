/* jshint undef: true, unused: true, sub:true, esversion:8, strict: global, browser: true */
/* globals $ */
/* exported Screen */
"use strict";

var Screen = (function(){
  
let nb = 0;

// Return the function to call to unlock the screen
function lock(){
  if(!(nb++))
    $("#waitDlg").modal({keyboard: false, backdrop:"static"});
  return function(){
    if(!(--nb))
      $("#waitDlg").modal('hide');
  };
}

// Return the function to call to unlock the screen
function fatal(txt){
  $(".modal").modal('hide');
  $("#fatalDlg").modal({keyboard: false, backdrop:"static"});
  $("#fatalDlg .modal-body").text(txt);
}

return {lock, fatal};

})();
