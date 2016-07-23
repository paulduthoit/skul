/*
* lib/skul/virtual.js
*
* SKuL virtual methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var _ = require('underscore');


/**
 * Add a virtual
 *
 * @params {String} key
 * @params {Object} requiredKeys
 * @params {Function} transform
 *
 * @api public
 */
module.exports.addVirtual = function(key, requiredKeys, transform) {

	// Check data
	if(typeof(key) !== "string")
		throw new Error("key have to be a string");
	if(typeof(requiredKeys) !== "object")
		throw new Error("requiredKeys have to be an object");
	if(typeof(transform) !== "function")
		throw new Error("transform have to be a function");

	// Set virtual
	this.virtuals[key] = {
		requiredKeys: requiredKeys,
		transform: transform
	};

};

/**
 * Remove a virtual
 *
 * @params {String} key
 *
 * @api public
 */
module.exports.removeVirtual = function(key) {

	// Check data
	if(typeof(key) !== "string")
		throw new Error("key have to be a string");

	// Delete virtual if exists
	if(typeof this.virtuals[key] !== "undefined") {
		delete this.virtuals[key];
	}

};

/**
 * Get all virtuals
 *
 * @return {Object}
 * @api public
 */
module.exports.getVirtuals = function() {
	return this.virtuals;
};

/**
 * Get a virtual
 *
 * @params {String} key
 *
 * @return {Object}
 * @api public
 */
module.exports.getVirtual = function(key) {

	// Check data
	if(typeof(key) !== "string")
		throw new Error("key have to be a string");

	// Return virtual
	return this.virtuals[key];

};



/*
 * Get virtual keys
 *
 * @return {Array}
 * @api public
 */
module.exports.getVirtualKeys = function() {
	return _.map(this.virtuals, function(obj, key) { return key; });
};