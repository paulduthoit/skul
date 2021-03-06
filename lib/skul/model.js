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
 * @param {Object} dbConnection
 * @param {String} tableName
 *
 * @api public
 */
var Model = function(dbConnection, tableName) {

	// Transform arguments
	if(typeof schema === 'undefined' || schema === null) schema = {};

	// Check arguments
	if(typeof dbConnection !== 'object')
		throw new Error('dbConnection have to be an object');
	if(typeof tableName !== 'string')
		throw new Error('tableName have to be a string');

	// Set basic instance data
	this.dbConnection = dbConnection;
	this.tableName = tableName;

	// Set schema instance data
	this.primaryKey = 'id';
	this.structureColumns = [];

	// Set keys instance data
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
	this.middlewares = {};
	this.permissionChecker = {};

	// Set displayable keys
	this.displayableKeys = null;

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
Model.prototype.structureColumns;
Model.prototype.defaultKeys;
Model.prototype.searchableKeys;
Model.prototype.defaultSearchKeys;
Model.prototype.defaultSelectOptions;
Model.prototype.middlewares;
Model.prototype.permissionChecker;
Model.prototype.displayableKeys;


// Extend methods
Model.prototype = _.extend(Model.prototype, require('./parser'));
Model.prototype = _.extend(Model.prototype, require('./checker'));
Model.prototype = _.extend(Model.prototype, require('./middleware'));
Model.prototype = _.extend(Model.prototype, require('./relationship'));
Model.prototype = _.extend(Model.prototype, require('./virtual'));
Model.prototype = _.extend(Model.prototype, require('./custom'));
Model.prototype = _.extend(Model.prototype, require('./query'));
Model.prototype = _.extend(Model.prototype, require('./search'));
Model.prototype = _.extend(Model.prototype, require('./populate'));
Model.prototype = _.extend(Model.prototype, require('./hider'));



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
 * @param {String} key
 *
 * @api public
 */
Model.prototype.setPrimaryKey = function(key) {

	// Check arguments
	if(typeof key !== 'string')
		throw new Error('key have to be a string');

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
 * @param {Array} keys
 *
 * @api public
 */
Model.prototype.setStructureColumns = function(keys) {

	// Check arguments
	if(!(keys instanceof Array))
		throw new Error('keys have to be an array');

	// Set instance data
	this.structureColumns = _.clone(keys);

};

/*
 * Get available keys
 *
 * @return {Array}
 * @api public
 */
Model.prototype.getStructureColumns = function() {
	return this.structureColumns;
};



/*
 * Set default keys
 *
 * @param {Array} keys
 *
 * @api public
 */
Model.prototype.setDefaultKeys = function(keys) {

	// Check arguments
	if(!(keys instanceof Array))
		throw new Error('keys have to be an array');

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
 * @param {Array} keys
 *
 * @api public
 */
Model.prototype.setSearchableKeys = function(keys) {

	// Check arguments
	if(!(keys instanceof Array))
		throw new Error('keys have to be an array');

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
 * @param {Array} keys
 *
 * @api public
 */
Model.prototype.setDefaultSearchKeys = function(keys) {

	// Check arguments
	if(!(keys instanceof Array))
		throw new Error('keys have to be an array');

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
 * @param {Object} options
 *
 * @api public
 */
Model.prototype.setDefaultSelectOptions = function(options) {

	// Check arguments
	if(!(typeof options === 'object' && options !== null))
		throw new Error('options have to be an object');

	// Set skip
	if(!isNaN(options.skip)) {
		this.defaultSelectOptions.skip = options.skip;
	} else if(typeof options.skip !== 'undefined') {
		throw new Error('options.skip have to be a number');
	}

	// Set limit
	if(!isNaN(options.limit)) {
		this.defaultSelectOptions.limit = options.limit;
	} else if(typeof options.limit !== 'undefined') {
		throw new Error('options.limit have to be a number');
	}

	// Set orderby
	if(options.orderby instanceof Array) {
		this.defaultSelectOptions.orderby = _.clone(options.orderby);
	} else if(typeof options.orderby === 'string') {
		this.defaultSelectOptions.orderby = [ options.orderby ];
	} else if(typeof options.orderby !== 'undefined') {
		throw new Error('options.orderby have to be an array or a string');
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
	if(!(typeof key === 'string' && _.contains([ 'skip', 'limit', 'orderby' ], key)))
		throw new Error('key have to be a string (skip, limit or orderby)');

	// If key provided
	return this.defaultSelectOptions[key];
	
};



/*
 * Get available keys
 *
 * @params null
 *
 * @return {Object}
 * @api public
 */
Model.prototype.getAvailableKeys = function() {
	return _.union(this.getStructureColumns(), this.getRelationshipKeys(), this.getCustomKeys(), this.getVirtualKeys());
};


/*
 * Set displayable keys
 *
 * @param {Function|Array} [keys]
 *
 * @api public
 */
Model.prototype.setDisplayableKeys = function(keys) {

	// Check arguments
	if(!(typeof keys === 'function' || keys instanceof Array || !keys))
		throw new Error('keys have to be a function or an array');

	// Set instance data
	this.displayableKeys = keys || null;

};

/*
 * Get displayable keys
 *
 * @param {Function} params
 * @param {Boolean} willReturnNullIfEmpty
 *
 * @return {Array}
 * @api public
 */
Model.prototype.getDisplayableKeys = function(params, willReturnNullIfEmpty) {
	if(typeof this.displayableKeys === 'function') return this.displayableKeys(params);
	else if(this.displayableKeys instanceof Array) return this.displayableKeys;
	else if(!willReturnNullIfEmpty) return this.getAvailableKeys();
	else return null;
};



// Exports
module.exports = Model;