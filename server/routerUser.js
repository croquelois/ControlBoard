/* jshint undef: true, unused: true, sub:true, node:true, esversion:8 */
"use strict";

const Users = require('./modules/users.js');
const bunyan = require('bunyan');
const util = require('./util.js');

const log = bunyan.createLogger({name: 'routerUser'});

let errorsList = {};
function pushError(codeTxt, code, msg){ errorsList[codeTxt] = {code, codeTxt, msg}; }
pushError('invalid-request', 400, 'the request is invalid');

module.exports = async function(app, config) {
  let users = new Users();
  await users.init(config);
  
  async function userSignup(req){
    let email = req.body['email'];
    let name  = req.body['name'];
    let pass  = req.body['pass'];
    if(!email || !name || !pass || typeof email != "string" || typeof pass != "string" || typeof name != "string")
      throw errorsList['invalid-request'];
    email = email.toLowerCase();

    log.info({email},"create account");
    return users.addNewAccount({email, pass, name});
  }

  async function userLogin(req){
    let email = req.body['email'];
    let pass  = req.body['pass'];
    if(!email || !pass || typeof email != "string" || typeof pass != "string")
      throw errorsList['invalid-request'];
    email = email.toLowerCase();

    log.info({email},"user login");
    return users.getToken(email, pass);
  }

  async function userLogout(req){
    log.info({email:req.user.email},"user logout");
    return users.destroyToken(req.body['token']);
  }

  async function userDelete(req){
    log.info({email:req.user.email},"user delete");
    return users.deleteAccount(req.user._id);
  }

  async function userRead(req){ 
    return req.user;
  }

  const addPost = (url,fct,opt) => util.addPost(app, log, url, fct, opt);
  
  addPost('/user/signup', userSignup, {noToken:true}); // email, password, name -> token/Error
  addPost('/user/delete', userDelete); // token -> Ok/Error
  addPost('/user/login', userLogin, {noToken:true}); // email, password -> token/Error
  addPost('/user/logout', userLogout); // token -> Ok/Error
  addPost('/user/read', userRead); // token -> [...]
};