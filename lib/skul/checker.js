/*
* lib/skul/checker.js
*
* SKuL checker methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var Promise = require('promise');



/*
 * Set permission checker
 *
 * @params {String} key
 * @params {Function} checker
 *
 * @api public
 */
module.exports.setPermissionChecker = function(key, checker) {

	// Check arguments
	if(!(typeof key === "string"))
		throw new Error("key have to be a string");
	if(!(typeof checker === "function" || checker === null))
		throw new Error("checker have to be a function");

	// Set permission checker
	this.permissionChecker[key] = checker;

};

/*
 * Get all permission checkers
 *
 * @return {Function}
 * @api public
 */
module.exports.getPermissionCheckers = function() {
	return this.permissionChecker;
};

/*
 * Get a permission checker
 *
 * @return {Function}
 * @api public
 */
module.exports.getPermissionChecker = function(key) {

	// Check arguments
	if(!(typeof key === "string" && typeof this.permissionChecker[key] === "function"))
		throw new Error("key have to be a defined permission checker");

	// Return permission checker
	return this.permissionChecker[key];

};



/*
 * Check permission
 *
 * @params {String} key
 *
 * @return {Promise}
 * @api public
 */
module.exports.checkPermission = function(key) {

	// Check arguments
	if(!(typeof key === "string" && typeof this.permissionChecker[key] === "function"))
		throw new Error("key have to be a defined permission checker");

	// Data
	var checkerArguments = Array.apply(null, arguments).splice(1);

	// Check permission
	return this.permissionChecker[key].apply(this, checkerArguments);

};