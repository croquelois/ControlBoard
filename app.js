var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var path = require('path');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: 'routerAdmin'});
var users = require('./server/modules/users');
var config = require('./config');

var app = express();

// all environments
app.set('port', config.port);
app.set('view engine', 'jade');
app.use(bodyParser.json());
app.use(users.tokenUser);
app.use(express.static(path.join(__dirname, 'public')));

require('./server/router')(app);

http.createServer(app).listen(app.get('port'), function(){
  log.info('Express server listening on port ' + app.get('port'));
});

function infiniteLoop(what,fct,timer){
  log.info(what,"Start");
  function inner(){
    log.info(what,"refresh");
    fct(function(err,res){
      if(err) console.log(what, err);
      setTimeout(inner,timer); 
    });
  }
  inner();
}

infiniteLoop("Token cleanup", users.checkExpiredTokens.bind(users), 10*60*1000);
