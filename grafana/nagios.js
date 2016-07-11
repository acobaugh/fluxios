/* global _ */

'use strict';

// accessible variables in this scope
var window, document, ARGS, $, jQuery, moment, kbn;

// some global settings
var nagios_db_name = 'nagios'; // name of the influxdb db
var nagios_ds = 'Nagios'; // name of the grafana datasource
var nagios_ds_id = 3;
var nagios_host_default = "your.nagios.host.com";
var base_url = window.location.protocol + '//' + window.location.host + '/api';


// Store the unsorted panels, keyed by service_description (row)
var panels = {};

// Check that the host argument was supplied
if(!_.isUndefined(ARGS.host)) {
	var host_name = ARGS.host;
} else {
	error("Must specify value for query param 'host'");
	return dashboard;
}
// Set nagios_host if it was supplied
if(!_.isUndefined(ARGS.nagios_host)) {
	var nagios_host = ARGS.nagios_host;
} else {
	var nagios_host = nagios_host_default;
}

// Initialize dashboard
var dashboard = {
	"rows" : [],
	"title": 'Nagios: ' + host_name,
	"editable": true,
	"style": "dark",
	"timezone": "browser",
	"hideControls": "false",
	"tags": [ "nagios" ],
	"time": {
		"from": "now-6h",
		"to": "now"
	},
	"templating": {
		"list": [
			{
				"type": "query",
				"datasource": nagios_ds,
				"name": "nagios_host",
				"refresh": true,
				"options": [],
				"includeAll": false,
				"query": "SHOW TAG VALUES WITH KEY = nagios_host",
				"current": { "text": nagios_host, "value": nagios_host }
			},
			{
				"type": "query",
				"datasource": nagios_ds,
				"name": "host_name",
				"refresh": true,
				"options": [],
				"includeAll": false,
				"query": "SHOW TAG VALUES WITH KEY = host_name",
				"current": { "text": host_name, "value": host_name }
			}
		]
	}
	"links": [
		{
			"type": "link",
			"icon": "dashboard",
			"url": "/dashboard/script/nagios.js?host=$host_name&nagios_host=$nagios_host",
			"targetBlank": false,
			"title": "View another host: $host_name"
		}
	]
};

return function(callback) {
	$.when(get_metrics(nagios_ds_id, host_name)).done(function(data) {
		var column_lookup = [];
		var deferreds = [];
		for (var i in data.results[0].series) {
			// build a lookup table to select a value by column name
			for (var j in data.results[0].series[i].columns) {
				column_lookup[data.results[0].series[i].columns[j]] = j;
			}
			for (var k in data.results[0].series[i].values) {
				var service_description = data.results[0].series[i].values[k][column_lookup['service_description']];
				var metric = data.results[0].series[i].values[k][column_lookup['metric']];
				var command = data.results[0].series[i].name;
				deferreds.push(build_panels(nagios_ds_id, host_name, command, service_description, metric));
			}
		}
		// build a panel object for every metric
		$.when.apply($, deferreds).done(function() {
			var keys = Object.keys(panels);
			keys.sort();
			// now create the rows and add the panels
			for (var i=0; i < keys.length; i++) {
				dashboard.rows.push({
					"title": keys[i],
					"height": '250px',
					"collapsable": true,
					"showTitle": true,
					"panels": panels[keys[i]]
				});
			}
		});
	}); // END done()

	callback(dashboard);
};

function get_metrics(nagios_ds_id, host_name) {
	var q = "SHOW SERIES WHERE host_name = '" + host_name + "' AND nagios_host = '" + nagios_host + "'";
	return $.ajax({
		type: 'GET',
		url: base_url + '/datasources/proxy/' + nagios_ds_id + '/query?epoch=ms&db=' + nagios_db_name + '&q=' + q,
		dataType: 'json'
	});
}

function build_panels(nagios_ds_id, host_name, measurement, service_description, metric) {
	// escape single quotes in metric
	metric = metric.replace(/'/g, "\\'");
	var q = "SELECT"
		+ " last(uom) as uom, last(min) as min, last(warn) as warn, last(crit) as crit" 
		+ " FROM \"" + measurement + "\""
		+ " WHERE host_name = '" + host_name + "'"
		+ " AND service_description= '" + service_description + "'"
		+ " AND metric = '" + metric + "'";
	return $.ajax({
		type: 'GET',
		url: base_url + '/datasources/proxy/' + nagios_ds_id + '/query?epoch=ms&db=' + nagios_db_name + '&q=' + q,
		dataType: 'json'
	})
	.fail(function(data) {
		error("Failed to build panel for "
		+ "measurement = " + measurement 
		+ ", service = " + service_description 
		+ ", metric = " + metric 
		+ ": " + data.status + " " + data.statusText);
	})
	.done(function(data) {
		// build a lookup table to select a value by column name
		var column_lookup = [];
		for (var j in data.results[0].series[0].columns) {
			column_lookup[data.results[0].series[0].columns[j]] = j;
		}
		var values = data.results[0].series[0].values[0];
		var uom = values[column_lookup['uom']];
		var warn = values[column_lookup['warn']];
		var crit = values[column_lookup['crit']];
		var min = values[column_lookup['min']];

		//create one row per service description	
		if (! panels.hasOwnProperty(service_description)) {
			panels[service_description] = [];
		}
		panels[service_description].push(
			{
				"title": metric,
				"id": service_description + metric,
				"type": 'graph',
				"span": 4,
				"collapsable": true,
				"editable": true,
				"render": "flot",
				"x-axis": true,
				"y-axis": true,
				"leftYAxisLabel": uom,
				"rightYAxisLabel": "",
				"datasource": nagios_ds,
				"grid": {
					"leftLogBase": 1,
					"leftMax": null,
					"rightMax": null,
					//"leftMin": min,
					"rightMin": null,
					"rightLogBase": 1,
					"threshold1": warn,
					"threshold2": crit,
					"threshold1Color": "rgba(216, 200, 27, 0.3)",
					"threshold2Color": "rgba(234, 112, 112, 0.22)",
					"thresholdLine": false
				},
				"y_formats": [ "short", "short"],
				"lines": true,
				"fill": 1,
				"linewidth": 2,
				"points": false,
				"pointradius": 5,
				"bars": false,
				"stack": false,
				"percentage": false,
				"aliasColors": {},
				"seriesOverrides": [ {} ],
				"nullPointMode": "connected",
				"legend": {
					"show": true,
					"values": false,
					"min": false,
					"max": false,
					"current": true,
					"total": false,
					"avg": false
				},
				"targets": [
					{
						"alias": measurement + ": " + metric,
						"dsType": "influxdb",
						"refId": "A",
						"measurement": measurement,
						"query": "SELECT mean(\"value\") FROM \"" + measurement + "\" WHERE \"host_name\" = '" + host_name + "' AND \"metric\" = '" + metric + "' AND \"service_description\" = '" + service_description + "' AND $timeFilter AND \"nagios_host\" = \"$nagios_host\" GROUP BY time($interval) fill(null)",
						"resultFormat": "time_series",
						"groupBy": [
							{ "type": "time", "params": [ "$interval" ] },
							{ "type": "fill", "params": [ "null" ] }
						],
						"select": [
							[
								{ "type": "field", "params": [ "value" ] },
								{ "type": "mean", "params": [] }
							]
						],
						"tags": [
							{ "key": "host_name", "operator": "=", "value": host_name },
							{ "condition": "AND", "key": "metric", "operator": "=", "value": metric },
							{ "condition": "AND", "key": "service_description", "operator": "=", "value": service_description },
							{ "condition": "AND", "key": "nagios_host", "operator": "=", "value": "$nagios_host" },
						]

					}
				],
			}); // END push()
	}); // END done()
} // END build_panels()

function error(text) {
	dashboard.rows.push({
		title: 'Error',
		height: '30px',
		panels: [
			{
				title: 'Error',
				type: 'text',
				span: 12,
				height: 1,
				"mode": "text",
				"content": text
			}
		]
	});
}

