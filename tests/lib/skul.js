/*
* tests/skul.js
*
* Test skul library
*
* Author: Paul Duthoit
* Copyright(c) 2016 Paul Duthoit
*/

// Dependencies
var assert = require('assert');
var fs = require('fs');
var _ = require('underscore');
var mysql = require('mysql');
var Skul = require('../../lib/skul');


// Exports
module.exports = function() {

	// Index
	describe('index.js', function() {

		// #contructor
		describe('#contructor', function() {

			it('should return an Error', function() {

				// Data
				var savedResponseData = null;

				// Request
				return Promise.resolve()
					.then(function(data) {

						// Instantiate Skul object
						var BasicModel = new Skul();

						// Tests
						assert(false);

					})
					.catch(function(err) {

						// Log
						__logInfo(err);

						// Save data
						savedResponseData = err;

						// Tests
						assert(err instanceof Error);
						assert.equal('dbConnection have to be an object', err.message);

						// Resolve
						return Promise.resolve();

					})
					.catch(function(err) {

						__logError(err);
						__logDebug(savedResponseData);

						// Throw error
						throw err;

					});

			});

			it('should return an Error', function() {

				// Data
				var savedResponseData = null;

				// Request
				return Promise.resolve()
					.then(function(data) {

						// Instantiate Skul object
						var BasicModel = new Skul(__mysqlConnection);

						// Tests
						assert(false);

					})
					.catch(function(err) {

						// Log
						__logInfo(err);

						// Save data
						savedResponseData = err;

						// Tests
						assert(err instanceof Error);
						assert.equal('tableName have to be a string', err.message);

						// Resolve
						return Promise.resolve();

					})
					.catch(function(err) {

						__logError(err);
						__logDebug(savedResponseData);

						// Throw error
						throw err;

					});

			});

			it('should instantiate a new Skul object (no schema)', function() {

				// Data
				var savedResponseData = null;

				// Request
				return Promise.resolve()
					.then(function(data) {

						// Instantiate Skul object
						var BasicModel = new Skul(__mysqlConnection, 'user');

						// Save data
						savedResponseData = BasicModel;

						// Tests
						assert(BasicModel instanceof Skul);
						assert.equal('user', BasicModel.tableName);

						// Resolve
						return Promise.resolve();

					})
					.catch(function(err) {

						__logError(err);
						__logDebug(savedResponseData);

						// Throw error
						throw err;

					});

			});

			it('should instantiate a new Skul object (with schema, but no primaryKey)', function() {

				// Data
				var savedResponseData = null;

				// Request
				return Promise.resolve()
					.then(function(data) {

						// Instantiate Skul object
						var BasicModel = new Skul(__mysqlConnection, 'user', {
							name: { default: true }
						});

						// Save data
						savedResponseData = BasicModel;

						// Tests
						assert(BasicModel instanceof Skul);
						assert.equal('user', BasicModel.tableName);
						assert.equal('id', BasicModel.primaryKey);
						assert.equal('object', typeof BasicModel.schema);
						assert.equal('object', typeof BasicModel.schema.name);
						assert.equal(JSON.stringify({ default: true }), JSON.stringify(BasicModel.schema.name));

						// Resolve
						return Promise.resolve();

					})
					.catch(function(err) {

						__logError(err);
						__logDebug(savedResponseData);

						// Throw error
						throw err;

					});

			});

			it('should instantiate a new Skul object (with schema and primaryKey)', function() {

				// Data
				var savedResponseData = null;

				// Request
				return Promise.resolve()
					.then(function(data) {

						// Instantiate Skul object
						var BasicModel = new Skul(__mysqlConnection, 'user', {
							uuid: { default: true, primaryKey: true },
							name: { default: true }
						});

						// Save data
						savedResponseData = BasicModel;

						// Tests
						assert(BasicModel instanceof Skul);
						assert.equal('user', BasicModel.tableName);
						assert.equal('uuid', BasicModel.primaryKey);
						assert.equal('object', typeof BasicModel.schema);
						assert.equal('object', typeof BasicModel.schema.name);
						assert.equal(JSON.stringify({ default: true }), JSON.stringify(BasicModel.schema.name));
						assert.equal('object', typeof BasicModel.schema.uuid);
						assert.equal(JSON.stringify({ default: true, primaryKey: true }), JSON.stringify(BasicModel.schema.uuid));

						// Resolve
						return Promise.resolve();

					})
					.catch(function(err) {

						__logError(err);
						__logDebug(savedResponseData);

						// Throw error
						throw err;

					});

			});

			/*

			it('should instantiate a new Skul object', function() {

				// Data
				var savedResponseData = null;

				// Request
				return Promise.resolve()
					.then(function(data) {

						// Instantiate Skul object
						var BasicModel = new Skul();

						// Resolve
						return Promise.resolve();

					})
					.catch(function(err) {

						__logError(err);
						__logDebug(savedResponseData);

						// Throw error
						throw err;

					});

			});

			*/

		});

	});

};