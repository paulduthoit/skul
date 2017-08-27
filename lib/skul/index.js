/**
 * lib/skul/index.js
 *
 * SKuL library
 *
 * Author: Paul Duthoit
 * Copyright(c) 2016 Paul Duthoit
 */


// Data
var Skul = {};

// Skul constants
Skul.Model = require('./model');
Skul.QueryBuilder = require('./query-builder');
Skul.QueryException = require('./exceptions/query');


/*
 * Create model
 *
 * @params {Object} dbConnection
 * @params {String} tableName
 *
 * @return {Model}
 * @api public
 */
Skul.createModel = function(dbConnection, tableName) {

	// Data
	var Model = Skul.Model;

	// Create and return model
	return new Model(dbConnection, tableName);

};


// Exports
module.exports = Skul;