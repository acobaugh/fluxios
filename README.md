
Fluxios
========

*Jan 21, 2016*

# Introduction

Fluxios is a script to take and parse nagios perfdata files and write them to InfluxDB. 

Inspiration (and some small pieces of code) has been taken from graphios and the Shinken mod-influxdb module:

* https://github.com/shawn-sterling/graphios
* https://github.com/savoirfairelinux/mod-influxdb

The main differences between fluxios and graphios are:
* Use of influxdb-python to handle all the communication with influxdb
* All configuration is done via config file
* Better handling of perfdata, namely regexes, shlex.split, and re.split where necessary
* Simpler code, fluxios only supports influxdb
* Better use of influxdb tags and fields by storing data more usefully.

Nagios perfdata is mapped into points as such:
<pre>
point = {
	"measurement": check_command,
	"timestamp": timestamp,
	"fields": {
                "label": label,
                "value": value,
                "uom": uom,
                "warn": warn,
                "crit": crit,
                "min": min,
                "max": max
	}
	"tags": {
	    "service_description": service_description,
	    "host_name": host_name,
	    "metric": label,
	}
}

# License

Fluxios is released under the [GP v2](http://www.gnu.org/licenses/gpl-2.0.html).

# Todo
* Finish this readme
* Add command line option to print out the default configuration
* tox unit tests
* Either a retry or buffered approach to sending points to influxdb
