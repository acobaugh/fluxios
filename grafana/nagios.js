/* global _ */

'use strict';

// accessible variables in this scope
var window, document, ARGS, $, jQuery, moment, kbn;

// some global settings
var nagios_db_name = 'nagios'; // name of the influxdb db
var nagios_ds = 'Nagios'; // name of the grafana datasource
var nagios_host_default = "smith.ait.psu.edu";
var base_url = window.location.protocol + '//' + window.location.host + '/api';

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

var nagios_ds_id;
var dashboard = init_dashboard();
var panels = [];

return main;

function main(callback) {
	
	$.when(get_ds_id(nagios_ds))
	.then(get_metrics)
	.then(parse_metrics)
	.then(build_panels)
	.then(build_rows)
	.then(function() {
		callback(dashboard);
	});
}

function parse_metrics(data) {
	var metrics = [];
	for (var s in data.results[0].series[0].values) {
		var result = {};
		data.results[0].series[0].values[s][0].split(',').forEach(function(x){
			var arr = x.split('=');
			if (!arr[1]) {
				result["measurement"] = arr[0];
			} else {
			        result[arr[0]] = arr[1];
			}
		});
		metrics.push({ 
			'measurement': result["measurement"],
			'service_description': result["service_description"].replace(/\\/g, ""),
			'metric' : result["metric"].replace(/'/g, "\\'")
		});
	}
	return metrics;
}

// custom sort function to ensure __HOST__ graphs appear first
function rowSort(a, b) {
	a = a.toUpperCase();
	b = b.toUpperCase();

	if (a == "__host__") {
		return -1;
	}
	if (b == "__host__") {
		return 1;
	}

	return a.localeCompare(b);
}	


function build_rows() {
	var keys = Object.keys(panels);
	keys.sort(rowSort);
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
}

function get_metrics() {
	var q = "SHOW SERIES WHERE host_name = '" + host_name + "' AND nagios_host = '" + nagios_host + "'";
	return $.ajax({
		type: 'GET',
		url: base_url + '/datasources/proxy/' + nagios_ds_id + '/query?epoch=ms&db=' + nagios_db_name + '&q=' + q,
		dataType: 'json'
	});
}

function build_panels(metrics) {
	var deferreds = metrics.map(build_panel);
	return $.when.apply($, deferreds);
}


function build_panel(m) {
	if (typeof m.metric == 'undefined') {
		error("No m.metric is undefined");
		return;
	} else {
		var q = "SELECT"
			+ " last(uom) as uom, last(min) as min, last(warn) as warn, last(crit) as crit" 
			+ " FROM \"" + m.measurement + "\""
			+ " WHERE host_name = '" + host_name + "'"
			+ " AND service_description= '" + m.service_description + "'"
			+ " AND metric = '" + m.metric + "'";
		return $.ajax({
			type: 'GET',
			url: base_url + '/datasources/proxy/' + nagios_ds_id + '/query?epoch=ms&db=' + nagios_db_name + '&q=' + q,
			dataType: 'json'
		})
		.fail(function(data) {
			console.log("fail(): q = " + q + " statusText = " + data.status +" "+ data.statusText);
			error("Failed to build panel for q = " + q + " statusText = " + data.status +" "+ data.statusText);
		})
		.done(function(data) {
			//create one row per service description	
			if (! panels.hasOwnProperty(m.service_description)) {
				panels[m.service_description] = [];
			}

			var column_lookup = [];
			if (data.results[0].series) {
				// build a lookup table to select a value by column name
				for (var j in data.results[0].series[0].columns) {
					column_lookup[data.results[0].series[0].columns[j]] = j;
				}
				var values = data.results[0].series[0].values[0];
				var uom = values[column_lookup['uom']];
				var warn = values[column_lookup['warn']];
				var crit = values[column_lookup['crit']];
				var min = values[column_lookup['min']];

				panels[m.service_description].push(panel(m.measurement, m.metric, m.service_description, uom, warn, crit));
			} else {
				panels[m.service_description].push(panel(m.measurement, m.metric, m.service_description, null, null, null));
			}
		}); // END done()
	}
} // END build_panel()

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

function get_ds_id(ds_name) {
	return $.ajax({
		type: 'GET',
		url: base_url + '/datasources/id/' + ds_name,
		dataType: 'json'
	})
	.fail(function(data) {
		error("failed to get datasource id for " + ds_name);
	})
	.done(function(data) {
		nagios_ds_id = data.id; // set this in a higher scope
	});
}

function init_dashboard() {
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
		},
		"links": [
			{
				"type": "link",
				"icon": "external link",
				"url": "https://sp.ais.psu.edu/cgi-bin/Assetsv3_CGI.exe?STEP=SEARCH&VIEW=BASIC&SEARCHTEXT=" + host_name,
				"targetBlank": true,
				"title": "Asset Tracking"
			},
			{
				"type": "link",
				"icon": "dashboard",
				"url": "/dashboard/script/nagios.js?host=$host_name&nagios_host=$nagios_host",
				"targetBlank": false,
				"title": "View another host: $host_name"
			}
		]
	};
	return dashboard;
}

function panel(measurement, metric, service_description, uom, warn, crit) {
	var panel = {
		"title": metric,
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
		]
	};
	return panel;
}
