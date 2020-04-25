/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

module.exports = async function(app, config){
  let routePromises = [];
  routePromises.push(require('./routerUser.js')(app, config));
  routePromises.push(require('./routerControlBoard.js')(app, config));
  await Promise.all(routePromises);
  app.get('*', (req, res) => res.status(404).send({ title: 'Page Not Found'}));
};