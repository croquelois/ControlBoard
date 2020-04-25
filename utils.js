/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

const crypto = require('crypto')

exports.encrypt = function(txt){
  const cipher = crypto.createCipher('aes-256-cbc','a8T9BgyQ')
  let crypted = cipher.update(txt,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}
 
exports.decrypt = function(txt){
  const decipher = crypto.createDecipher('aes-256-cbc','a8T9BgyQ')
  let dec = decipher.update(txt,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}


exports.infiniteLoop = function(what,fct,timer){
  function inner(){
    fct((err,res) => {
      if(err)
        console.error(what, err);
      setTimeout(inner,timer); 
    });
  }
  inner();
}
