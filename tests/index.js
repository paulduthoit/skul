/*
* tests/index.js
*
* Test main file
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var assert = require('assert');
var debug = require('debug');
var _ = require('underscore');
var fs = require('fs');
var skul = require('../lib/skul');
var config = require('./config');


// Set debug
global.__logInfo = debug('info');
global.__logError = debug('error');
global.__logDebug = debug('debug');

// Set globals
global.__config = config;
global.__context = {};
global.__mysqlConnection = null;

// Skul
describe('Skul', function() {

	// Data
	var databaseMethods = require('./database');

	// Before tests
	before(function() {

		// Return promises
		return databaseMethods.connect()
			.then(databaseMethods.clean)
			.then(databaseMethods.populate);

	});

	// Test skul
	describe('', require('./lib/skul'));

	// After tests
	after(function() {

		// Return promises
		return databaseMethods.disconnect();

	});
	
});