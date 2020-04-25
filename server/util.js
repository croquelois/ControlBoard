/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

let errorsList = {};
function pushError(codeTxt, code, msg){ errorsList[codeTxt] = {code, codeTxt, msg}; }
pushError('user-invalid-token', 400, 'the token is invalid');

exports.addPost = function(app, log, url, fct, opt){
  opt = opt || {};
  app.post(url, function(req,res){
    log.info(url);
    if(!opt.noToken && !req.user){
      log.warn({ip:req.ip},"invalid token");
      let error = errorsList['user-invalid-token'];
      return res.status(error.code).send(error);
    }
    try{ 
      let ret = fct(req,res);
      if(ret.then){
        ret.then(data => {
          if(data !== undefined){
            if(typeof data == "number") 
              return res.status(200).send(""+data); // No error and data returned
            return res.status(200).send(data); // No error and data returned
          }
          return res.status(200).send('ok'); // No error but no data returned
        }).catch(err => {
          if(!err || err instanceof Error){
            res.status(500).send("Server error");
            throw err;
          }
          log.error({err},"error while processing the request");
          if(err.substr) 
            return res.status(500).send(err);
          if(err.code) 
            return res.status(err.code).send(err);
          if(err.message) 
            return res.status(500).send(err.message);
          return res.status(500).send(JSON.stringify(err));
        });
      }
    }catch(err){ 
      log.error(err.stack?err.stack:err,"try/catch"); 
      res.status(500).send(err.stack?err.stack:err); 
    }
  });
};