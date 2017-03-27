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

/* USER */

	// Create model
	var User = skul.createModel(__mysqlConnection, 'User');

	// Set model keys
	User.setPrimaryKey('id');
	User.setStructureColumns([ 'id', 'id_org', 'name' ]);

/* /USER */

/* ORGANISATION */

	// Create model
	var Organisation = skul.createModel(__mysqlConnection, 'Organisation');

	// Set model keys
	Organisation.setPrimaryKey('id');
	Organisation.setStructureColumns([ 'id', 'id_workspace', 'name' ]);

/* /ORGANISATION */

/* WORKSPACE */

	// Create model
	var Workspace = skul.createModel(__mysqlConnection, 'Workspace');

	// Set model keys
	Workspace.setPrimaryKey('id');
	Workspace.setStructureColumns([ 'id', 'name' ]);

/* /WORKSPACE */

/* USER VEHICLE */

	// Create model
	var UserVehicle = skul.createModel(__mysqlConnection, 'UserVehicle');

	// Set model keys
	UserVehicle.setPrimaryKey('id');
	UserVehicle.setStructureColumns([ 'id', 'id_user', 'id_vehicle', 'bound_at' ]);

/* /USER VEHICLE */

/* VEHICLE */

	// Create model
	var Vehicle = skul.createModel(__mysqlConnection, 'Vehicle');

	// Set model keys
	Vehicle.setPrimaryKey('id');
	Vehicle.setStructureColumns([ 'id', 'uuid', 'id_autodata' ]);
	Vehicle.setDefaultKeys(Vehicle.getStructureColumns());
	Vehicle.setSearchableKeys(Vehicle.getStructureColumns());
	Vehicle.setDefaultSearchKeys(_.intersection(Vehicle.getSearchableKeys(), [ 'uuid' ]));

/* /VEHICLE */

/* TRIP */

	// Create model
	var Trip = skul.createModel(__mysqlConnection, 'Trip');

	// Set model keys
	Trip.setPrimaryKey('id');
	Trip.setStructureColumns([ 'id', 'id_vehicle', 'uuid', 'time_start', 'distance_m', 'distance_obd_m', 'status' ]);
	Trip.setDefaultKeys(_.union(Trip.getStructureColumns(), [ 'distance_m' ]));
	Trip.setSearchableKeys(_.union(Trip.getStructureColumns(), [ 'distance_m' ]));
	Trip.setDefaultSearchKeys(_.intersection(Trip.getSearchableKeys(), [ 'id', 'uuid' ]));

/* /TRIP */


// Relationships
User.hasMany('vehicles', { model: UserVehicle, foreignKey: 'id_user' });
User.hasMany('trips', { model: Trip, foreignKey: 'id_user' });
User.belongsTo('organisation', { model: Organisation, foreignKey: 'id_org' });

Organisation.belongsTo('workspace', { model: Workspace, foreignKey: 'id_workspace' });

Vehicle.hasMany('trips', { model: Trip, foreignKey: 'id_vehicle' });

Trip.belongsTo('vehicle', { model: Vehicle, foreignKey: 'id_vehicle' });


// Customs
User.addCustom('organisation_name', {
	'$field': [
		{ '$alias': 'o1', '$key': 'name' }
	],
	'$join': [ { '$type': 'left', '$model': Organisation, '$alias': 'o1', '$key': 'id', '$on': 'id_org' } ]
});

Vehicle.addCustom('total_distance_m', {
	'$field': [
		'SUM(CASE ',
			'WHEN ', { '$alias': 't1', '$key': 'distance_m' }, ' IS NOT NULL ',
			'THEN ', { '$alias': 't1', '$key': 'distance_m' }, ' ',
			'ELSE ', { '$alias': 't1', '$key': 'distance_obd_m' }, ' ',
		'END)'
	],
	'$join': [ { '$type': 'left', '$model': Trip, '$alias': 't1', '$key': 'id_vehicle', '$on': 'id' } ]
});

// Return
module.exports = {
	User: User,
	Organisation: Organisation,
	Workspace: Workspace,
	UserVehicle: UserVehicle,
	Vehicle: Vehicle,
	Trip: Trip
};