/*
* lib/skul/middleware.js
*
* SKuL middleware methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var Promise = require('promise');
var _ = require('underscore');


/*
 * Set middleware
 *
 * @params {String} name
 * @params {Function} middleware
 *
 * @api public
 */
module.exports.setMiddleware = function(name, middleware) {

	// Check arguments
	if(!(typeof name === "string" && _.contains([ 'beforeSelect', 'afterSelect' ], name)))
		throw new Error("middleware have to be a string set as beforeSelect or afterSelect");
	if(!(typeof middleware === "function" || middleware === null))
		throw new Error("middleware have to be a function");

	// Set filter middleware
	this.middlewares[name] = middleware;

};

/*
 * Get a middleware
 *
 * @params {String} name
 *
 * @return {Function}
 * @api public
 */
module.exports.getMiddleware = function(name) {

	// Check arguments
	if(!(typeof name === "string" && _.contains([ 'beforeSelect', 'afterSelect' ], name)))
		throw new Error("middleware have to be a string set as beforeSelect or afterSelect");

	// Return middleware
	return this.middlewares[name];
	
};

/*
 * Get all middlewares
 *
 * @return {Function}
 * @api public
 */
module.exports.getMiddlewares = function() {
	return this.middlewares;
};



/*
 * Run before select middleware
 *
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} params
 *
 * @return {Promise}
 * @api public
 */
module.exports.runBeforeSelectMiddleware = function(context) {

	// Resolve if the middleware is not defined
	if(typeof this.middlewares.beforeSelect !== 'function') {
		return Promise.resolve();
	}

	// Before select
	return this.middlewares.beforeSelect.call(this, context);

};

/*
 * Run after select middleware
 *
 * @params {Object} filter
 * @params {Object} fields
 * @params {Object} params
 *
 * @return {Promise}
 * @api public
 */
module.exports.runAfterSelectMiddleware = function(data, context) {

	// Resolve if the middleware is not defined
	if(typeof this.middlewares.afterSelect !== 'function') {
		return Promise.resolve();
	}

	// After select
	return this.middlewares.afterSelect.call(this, data, context);

};