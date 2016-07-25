/*
* lib/skul/model.js
*
* SKuL model
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var _ = require('underscore');


/*
 * Model constructor
 *
 * @params {Object} dbConnection
 * @params {String} tableName
 *
 * @api public
 */
var Model = function(dbConnection, tableName) {

	// Transform arguments
	if(typeof schema === "undefined" || schema === null) schema = {};

	// Check arguments
	if(typeof dbConnection !== "object")
		throw new Error("dbConnection have to be an object");
	if(typeof tableName !== "string")
		throw new Error("tableName have to be a string");

	// Set basic instance data
	this.dbConnection = dbConnection;
	this.tableName = tableName;

	// Set keys instance data
	this.primaryKey = 'id';
	this.availableKeys = [];
	this.defaultKeys = [];
	this.searchableKeys = [];
	this.defaultSearchKeys = [];

	// Set select instance data
	this.defaultSelectOptions = {
		skip: 0,
		limit: 20,
		orderby: null
	};

	// Set more instance data
	this.relationships = {};
	this.virtuals = {};
	this.customs = {};

	// Set checker instance data
	this.filterChecker = null;
	this.permissionChecker = {};

	// Set private instance data
	this._self = Model;

};


// Instances data
Model.prototype.dbConnection;
Model.prototype.tableName;
Model.prototype.primaryKey;
Model.prototype.relationships;
Model.prototype.virtuals;
Model.prototype.customs;
Model.prototype.availableKeys;
Model.prototype.defaultKeys;
Model.prototype.searchableKeys;
Model.prototype.defaultSearchKeys;
Model.prototype.defaultSelectOptions;
Model.prototype.filterChecker;
Model.prototype.permissionChecker;


// Extend methods
Model.prototype = _.extend(Model.prototype, require('./parser'));
Model.prototype = _.extend(Model.prototype, require('./checker'));
Model.prototype = _.extend(Model.prototype, require('./relationship'));
Model.prototype = _.extend(Model.prototype, require('./virtual'));
Model.prototype = _.extend(Model.prototype, require('./custom'));
Model.prototype = _.extend(Model.prototype, require('./query'));
Model.prototype = _.extend(Model.prototype, require('./search'));
Model.prototype = _.extend(Model.prototype, require('./populate'));



/*
 * Get database connection
 *
 * @return {String}
 * @api public
 */
Model.prototype.getDbConnection = function() {
	return this.dbConnection;
};

/*
 * Get table name
 *
 * @return {String}
 * @api public
 */
Model.prototype.getTableName = function() {
	return this.tableName;
};



/*
 * Set primary key
 *
 * @params {String} key
 *
 * @api public
 */
Model.prototype.setPrimaryKey = function(key) {

	// Check arguments
	if(typeof key !== "string")
		throw new Error("key have to be a string");

	// Set primary key
	this.primaryKey = key;

};

/*
 * Get primary key
 *
 * @return {String}
 * @api public
 */
Model.prototype.getPrimaryKey = function() {
	return this.primaryKey;
};



/*
 * Set available keys
 *
 * @params {Array} keys
 *
 * @api public
 */
Model.prototype.setAvailableKeys = function(keys) {

	// Check arguments
	if(!(keys instanceof Array))
		throw new Error("keys have to be an array");

	// Set instance data
	this.availableKeys = _.clone(keys);

};

/*
 * Get available keys
 *
 * @return {Array}
 * @api public
 */
Model.prototype.getAvailableKeys = function() {
	return this.availableKeys;
};



/*
 * Set default keys
 *
 * @params {Array} keys
 *
 * @api public
 */
Model.prototype.setDefaultKeys = function(keys) {

	// Check arguments
	if(!(keys instanceof Array))
		throw new Error("keys have to be an array");

	// Set instance data
	this.defaultKeys = _.clone(keys);

};

/*
 * Get default keys
 *
 * @return {Array}
 * @api public
 */
Model.prototype.getDefaultKeys = function() {
	return this.defaultKeys;
};



/*
 * Set searchable keys
 *
 * @params {Array} keys
 *
 * @api public
 */
Model.prototype.setSearchableKeys = function(keys) {

	// Check arguments
	if(!(keys instanceof Array))
		throw new Error("keys have to be an array");

	// Set instance data
	this.searchableKeys = _.clone(keys);

};

/*
 * Get searchable keys
 *
 * @return {Array}
 * @api public
 */
Model.prototype.getSearchableKeys = function() {
	return this.searchableKeys;
};



/*
 * Set default search keys
 *
 * @params {Array} keys
 *
 * @api public
 */
Model.prototype.setDefaultSearchKeys = function(keys) {

	// Check arguments
	if(!(keys instanceof Array))
		throw new Error("keys have to be an array");

	// Set instance data
	this.defaultSearchKeys = _.clone(keys);

};

/*
 * Get default search keys
 *
 * @return {Array}
 * @api public
 */
Model.prototype.getDefaultSearchKeys = function() {
	return this.defaultSearchKeys;
};



/*
 * Set default list options
 *
 * @params {Object} options
 *
 * @api public
 */
Model.prototype.setDefaultSelectOptions = function(options) {

	// Check arguments
	if(!(typeof options === "object" && options !== null))
		throw new Error("options have to be an object");

	// Set skip
	if(!isNaN(options.skip)) {
		this.defaultSelectOptions.skip = options.skip;
	} else if(typeof options.skip !== "undefined") {
		throw new Error("options.skip have to be a number");
	}

	// Set limit
	if(!isNaN(options.limit)) {
		this.defaultSelectOptions.limit = options.limit;
	} else if(typeof options.limit !== "undefined") {
		throw new Error("options.limit have to be a number");
	}

	// Set orderby
	if(options.orderby instanceof Array) {
		this.defaultSelectOptions.orderby = _.clone(options.orderby);
	} else if(typeof options.orderby === "string") {
		this.defaultSelectOptions.orderby = [ options.orderby ];
	} else if(typeof options.orderby !== "undefined") {
		throw new Error("options.orderby have to be an array or a string");
	}

};

/*
 * Get all default list options
 *
 * @return {Object}
 * @api public
 */
Model.prototype.getDefaultSelectOptions = function() {
	return this.defaultSelectOptions;
};

/*
 * Get a default list option
 *
 * @return {Object}
 * @api public
 */
Model.prototype.getDefaultSelectOption = function(key) {

	// Check arguments
	if(!(typeof key === "string" && _.contains([ 'skip', 'limit', 'orderby' ], key)))
		throw new Error("key have to be a string (skip, limit or orderby)");

	// If key provided
	return this.defaultSelectOptions[key];
	
};


// Exports
module.exports = Model;