/*
* database.js
*
* Database methods
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var mysql = require('mysql');


// Connect
module.exports.connect = function() {

	// Data
	var databaseConfig = __config.mysql;

	// Create connection
	var connection = mysql.createConnection({
		host: databaseConfig.host,
		port: databaseConfig.port,
		user: databaseConfig.user,
		password: databaseConfig.password,
		database: databaseConfig.name,
		multipleStatements: true
	});

	// Return promise
	return new Promise(function(resolve, reject) {

		// Connect
		connection.connect(function(err) {

			// Reject if error
			if(err) {
				reject(err);
				return;
			}

			// Save database connection
			__mysqlConnection = connection;

			// Resolve
			resolve();
			return;

		});

	});
	
};

// Clean database
module.exports.clean = function() {

	// Return promise
	return new Promise(function(resolve, reject) {

		// Data
		var sqlQueries = fs.readFileSync(path.resolve(__dirname, 'mysql/clean.sql'), 'UTF-8');

		// Query
		__mysqlConnection.query(sqlQueries, function(err, results) {

			// Reject if error
			if(err) {
				reject(err);
				return;
			}

			// Resolve
			resolve();
			return;

		});

	});

};

// Populate database
module.exports.populate = function() {

	// Return promise
	return new Promise(function(resolve, reject) {

		// Data
		var sqlQueries = fs.readFileSync(path.resolve(__dirname, 'mysql/populate.sql'), 'UTF-8');

		// Query
		__mysqlConnection.query(sqlQueries, function(err, results) {

			// Reject if error
			if(err) {
				reject(err);
				return;
			}

			// Resolve
			resolve();
			return;

		});

	});

};

// Disconnect database
module.exports.disconnect = function() {

	// Return promise
	return new Promise(function(resolve, reject) {

		// End
		__mysqlConnection.end(function(err) {

			// Reject if error
			if(err) {
				reject(err);
				return;
			}

			// Resolve
			resolve();
			return;

		});

	});

};