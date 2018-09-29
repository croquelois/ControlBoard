"use strict";
module.exports = function(app){  
  require('./routerUser.js')(app);
  require('./routerControlBoard.js')(app);  
  app.get('*', function(req, res){ res.status(404).send({ title: 'Page Not Found'}); });
};