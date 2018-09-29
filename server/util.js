"user strict";
var fs = require("fs");

function genericCallback(log,res,err,data){
  if(!err && data !== undefined){
    if(typeof data == "number") return res.status(200).send(""+data); // No error and data returned
    return res.status(200).send(data); // No error and data returned
  }
  log.error({err:err,data:data},"error in the generic callback");
  if(!err && !data) return res.status(200).send('ok'); // No error but no data returned
  if(err && data) return res.status(err).send(data); // Error with data returned => error code in err and explanation in data
  if(err.substr) return res.status(500).send(err);
  if(err.message) return res.status(500).send(err.message);
  return res.status(500).send(JSON.stringify(err));
}

function buildGenericCallback(log, res){ 
  return genericCallback.bind(null, log, res);
}

exports.buildGenericCallbackFactory = function(log){
  return buildGenericCallback.bind(null, log);
};

exports.noImpl = function(req, res){ 
  return res.status(500).send('Not implemented'); 
};

exports.copyFile = function(source, target, cb) {
  var cbCalled = false;

  var rd = fs.createReadStream(source);
  rd.on("error", function(err) {
    done(err);
  });
  var wr = fs.createWriteStream(target);
  wr.on("error", function(err) {
    done(err);
  });
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
}