/*
* app/models/files/vehicle.js
*
* Vehicle model
*
* Author: Paul Duthoit
* Copyright(c) 2016 OOCAR
*/

// Dependencies
var _ = require('underscore');
var skul = require('../lib/skul');

/* VEHICLE */

	// Create model
	var Vehicle = skul.createModel(__mysqlConnection, 'Vehicle');

	// Set model keys
	Vehicle.setPrimaryKey('id');
	Vehicle.setAvailableKeys([ 'id', 'uuid', 'id_autodata' ]);
	Vehicle.setDefaultKeys(Vehicle.getAvailableKeys());
	Vehicle.setSearchableKeys(Vehicle.getAvailableKeys());
	Vehicle.setDefaultSearchKeys(_.intersection(Vehicle.getSearchableKeys(), [ 'uuid' ]));

/* /VEHICLE */

/* TRIP */

	// Create model
	var Trip = skul.createModel(__mysqlConnection, 'Trip');

	// Set model keys
	Trip.setPrimaryKey('id');
	Trip.setAvailableKeys([ 'id', 'id_vehicle', 'uuid', 'time_start', 'distance_m', 'distance_obd_m', 'status' ]);
	Trip.setDefaultKeys(_.union(Trip.getAvailableKeys(), [ 'distance_m' ]));
	Trip.setSearchableKeys(_.union(Trip.getAvailableKeys(), [ 'distance_m' ]));
	Trip.setDefaultSearchKeys(_.intersection(Trip.getSearchableKeys(), [ 'id', 'uuid' ]));

/* /TRIP */


// Relationships
Vehicle.hasMany('trips', { model: Trip, foreignKey: 'id_vehicle' });

// Relationships
Trip.belongsTo('vehicle', { model: Vehicle, foreignKey: 'id_vehicle' });

// Return
module.exports = {
	Vehicle: Vehicle,
	Trip: Trip
};