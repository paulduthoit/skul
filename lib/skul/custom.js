/*
* lib/skul/custom.js
*
* SKuL custom methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var _ = require('underscore');


/*
 * Add a custom
 *
 * @params {String} key
 * @params {Object} custom
 * @params {Object} [options]
 *
 * @api public
 */
module.exports.addCustom = function(key, custom, options) {

    // Check arguments length
    if(arguments.length === 2) {
        options = {};
    }

	// Check arguments
	if(typeof key !== "string")
		throw new Error("key have to be a string");
	if(typeof custom !== "object")
		throw new Error("custom have to be an object");
	if(typeof options !== "object")
		throw new Error("options have to be an object");

	// Get custom field
	custom = _.extend({ data: _.clone(custom) }, options);

	// Add to customs
	this.customs[key] = custom;

};

/**
 * Remove a custom field
 *
 * @params {String} key
 *
 * @api public
 */
module.exports.removeCustom = function(key) {

	// Check data
	if(typeof(key) !== "string")
		throw new Error("key have to be a string");

	// Delete custom if exists
	if(typeof this.customs[key] !== "undefined") {
		delete this.customs[key];
	}

};

/**
 * Get all custom
 *
 * @return {Object}
 * @api public
 */
module.exports.getCustoms = function() {
	return this.customs;
};

/**
 * Get a custom
 *
 * @params {String} key
 *
 * @return {Object}
 * @api public
 */
module.exports.getCustom = function(key) {

	// Check data
	if(typeof(key) !== "string")
		throw new Error("key have to be a string");

	// Return custom field
	return this.customs[key];

};



/*
 * Get custom keys
 *
 * @return {Array}
 * @api public
 */
module.exports.getCustomKeys = function() {
	return _.map(this.customs, function(obj, key) { return key; });
};