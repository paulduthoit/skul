/*
* lib/skul/relationship.js
*
* SKuL relationship methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var _ = require('underscore');


/*
 * Add a relationship
 *
 * @params {String} type
 * @params {String} key
 * @params {Object} relationship
 *
 * @api public
 */
module.exports.addRelationship = function(type, key, relationship) {

	// Check arguments
	if(!(typeof type === "string" && _.contains([ 'belongsTo', 'hasMany', 'hasOne', 'hasManyCustom', 'hasOneCustom', 'hasManyThrough', 'hasOneThrough' ], type)))
		throw new Error("type have to be a string defined as belongsTo, hasMany, hasOne, hasManyCustom, hasOneCustom, hasManyThrough or hasOneThrough");
	if(typeof key !== "string")
		throw new Error("key have to be a string");
	if(typeof relationship !== "object")
		throw new Error("relationship have to be an object");

	// If type is basic
	if(type === 'belongsTo' || type === 'hasMany' || type === 'hasOne') {

		// Check relationship argument
		if(!(relationship.model instanceof this._self))
			throw new Error("relationship.model have to be a Skul.Model object");
		if(typeof relationship.foreignKey !== "string")
			throw new Error("relationship.foreignKey have to be a string");

		// Set relationship
		this.relationships[key] = relationship;
		this.relationships[key].type = type;

	}

	// If type is custom
	else if(type === 'hasManyCustom' || type === 'hasOneCustom') {

		// Check relationship argument
		if(!(typeof relationship.model === "object" && relationship.model !== null))
			throw new Error("relationship.model have to be an object");
		if(!(relationship.model['$model'] instanceof this._self))
			throw new Error("relationship.model.$model have to be a Skul.Model object");
		if(!(typeof relationship.model['$alias'] === "string"))
			throw new Error("relationship.model.$alias have to be a string");
		if(!(!relationship.joinRaw || relationship.joinRaw instanceof Array))
			throw new Error("relationship.joinRaw have to be an array");
		if(!(typeof relationship.foreignKey === "object" && relationship.foreignKey !== null))
			throw new Error("relationship.foreignKey have to be an object");
		if(!(typeof relationship.foreignKey['$alias'] === "string"))
			throw new Error("relationship.foreignKey.$alias have to be a string");
		if(!(typeof relationship.foreignKey['$key'] === "string"))
			throw new Error("relationship.foreignKey.$key have to be a string");

		// Set relationship
		this.relationships[key] = relationship;
		this.relationships[key].type = type;

	}

	// If type is through
	else if(type === 'hasManyThrough' || type === 'hasOneThrough') {

		// Check relationship argument
		if(!(relationship instanceof Array))
			throw new Error("relationship have to be an array");

		// Loop over relationships
		_.each(relationship, function(relItem) {

			// Check relItem argument
			if(!(typeof relItem.type === "string" && _.contains([ 'belongsTo', 'hasMany', 'hasOne' ], relItem.type)))
				throw new Error("relationship.$.type have to be a string defined as belongsTo, hasMany or hasOne");
			if(!(relItem.model instanceof this._self))
				throw new Error("relationship.$.model have to be a Skul.Model object");
			if(typeof relItem.foreignKey !== "string")
				throw new Error("relationship.$.foreignKey have to be a string");

		}.bind(this));

		// Set relationship
		this.relationships[key] = { joins: relationship, type: type };

	}

};

/**
 * Remove a relationship
 *
 * @params {String} key
 *
 * @api public
 */
module.exports.removeRelationship = function(key) {

	// Check arguments
	if(typeof key !== "string")
		throw new Error("key have to be a string");

	// Delete relationship if exists
	if(typeof this.relationships[key] !== "undefined") {
		delete this.relationships[key];
	}

};

/**
 * Get all relationships
 *
 * @params {string} [type]
 *
 * @return {Object}
 * @api public
 */
module.exports.getRelationships = function(type) {

	// Check arguments
	if(!(typeof type === "string" && _.contains([ 'belongsTo', 'hasMany', 'hasOne', 'hasManyCustom', 'hasOneCustom', 'hasManyThrough', 'hasOneThrough' ], type)) && typeof type !== "undefined")
		throw new Error("type have to be a string defined as belongsTo, hasMany, hasOne, hasManyCustom, hasOneCustom, hasManyThrough or hasOneThrough");

	// If type is defined
	if(type) {

		// Data
		var requestedRelationships = {};

		// Loop over relationships
		_.each(this.relationships, function(obj, key) {
			if(obj.type === type) {
				requestedRelationships[key] = obj;
			}
		});

		// Return relationships
		return requestedRelationships;

	}

	// If type is not defined
	else {

		// Return relationships
		return this.relationships;

	}

};

/**
 * Get a relationship
 *
 * @params {String} key
 *
 * @return {Object}
 * @api public
 */
module.exports.getRelationship = function(key) {

	// Check arguments
	if(typeof key !== "string")
		throw new Error("key have to be a string");

	// Return relationship
	return this.relationships[key];

};



/*
 * Get relationship keys
 *
 * @return {Array}
 * @api public
 */
module.exports.getRelationshipKeys = function(type) {

	// Check arguments
	if(!(typeof type === "string" && _.contains([ 'belongsTo', 'hasMany', 'hasOne', 'hasManyCustom', 'hasOneCustom', 'hasManyThrough', 'hasOneThrough' ], type)) && typeof type !== "undefined")
		throw new Error("type have to be a string defined as belongsTo, hasMany, hasOne, hasManyCustom, hasOneCustom, hasManyThrough or hasOneThrough");

	// Return typped relationship keys
	if(type) {
		return _.filter(_.map(this.relationships, function(obj, key) { return obj.type === type ? key : null; }), function(obj) { return obj !== null; });
	}

	// Return all relationship keys
	else {
		return _.map(this.relationships, function(obj, key) { return key; });
	}

};



/*
 * Add belongsTo relationship
 *
 * @params {String} key
 * @params {Object} relationship
 *
 * @api public
 */
module.exports.belongsTo = function(key, relationship) {

	// Add relationship
	this.addRelationship('belongsTo', key, relationship);

};

/*
 * Add hasMany relationship
 *
 * @params {String} key
 * @params {Object} relationship
 *
 * @api public
 */
module.exports.hasMany = function(key, relationship) {

	// Add relationship
	this.addRelationship('hasMany', key, relationship);

};

/*
 * Add hasOne relationship
 *
 * @params {String} key
 * @params {Object} relationship
 *
 * @api public
 */
module.exports.hasOne = function(key, relationship) {

	// Add relationship
	this.addRelationship('hasOne', key, relationship);

};

/*
 * Add hasManyCustom relationship
 *
 * @params {String} key
 * @params {Object} relationship
 *
 * @api public
 */
module.exports.hasManyCustom = function(key, relationship) {

	// Add relationship
	this.addRelationship('hasManyCustom', key, relationship);

};

/*
 * Add hasOneCustom relationship
 *
 * @params {String} key
 * @params {Object} relationship
 *
 * @api public
 */
module.exports.hasOneCustom = function(key, relationship) {

	// Add relationship
	this.addRelationship('hasOneCustom', key, relationship);

};

/*
 * Add hasManyThrough relationship
 *
 * @params {String} key
 * @params {Object} relationship
 *
 * @api public
 */
module.exports.hasManyThrough = function(key, relationship) {

	// Add relationship
	this.addRelationship('hasManyThrough', key, relationship);

};

/*
 * Add hasOneThrough relationship
 *
 * @params {String} key
 * @params {Object} relationship
 *
 * @api public
 */
module.exports.hasOneThrough = function(key, relationship) {

	// Add relationship
	this.addRelationship('hasOneThrough', key, relationship);

};