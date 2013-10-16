#!/usr/bin/env python
# -*- coding: utf-8 -*-

# prepare paths
import sys
import os.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'config'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))

# import other modules
import common
import backend
import config
import csv_configurator

# include python modules
#import argparse
#import math
#import datetime
#import subprocess

class Exporter:

	def __init__(self):
		pass

	def writeEventDataSet(self, analyzer, mainid, subid, eventtype, start, end, description, parameterdump):
		pass



class ConsoleExporter(Exporter):
	
	def __init__(self):
		self.keys = set()

	def writeEventDataSet(self, analyzer, mainid, subid, eventtype, start, end, description, parameterdump):
		key = (analyzer, mainid, subid, eventtype, start)
		
		from datetime import datetime
		start = datetime.fromtimestamp(int(start)).strftime("%d.%m.%Y %H:%M:%S")
		
		if key in self.keys:
			print "UPDATE: %s: %s - %s/%s - %s - %s" % (start, analyzer, mainid, subid, eventtype, description)
		else:
			print "%s: %s - %s/%s - %s - %s" % (start, analyzer, mainid, subid, eventtype, description)
	
		self.keys.add((analyzer, mainid, subid, eventtype, start))



class FlowBackendExporter(Exporter):

	def __init__(self):
		# prepare mysql target database
		# TODO: make this more generic later on

		# prepare fieldDict
		generic_mysql = csv_configurator.readDictionary("../config/generic_mysql.csv")
		fieldDict = csv_configurator.create_fieldDict("mysql", lambda generic_type: generic_mysql[generic_type], lambda snmp_type: snmp_type, "../analyzer/events.csv")

		# prepare database connection and create required collection objects
		db = backend.databackend.getBackendObject(config.data_backend, config.data_backend_host, config.data_backend_port, config.data_backend_user, config.data_backend_password, config.data_backend_snmp_name, "UPDATE")
		db.prepareCollection("events", fieldDict["events"])
		global events
		events = db.getCollection("events")

	def writeEventDataSet(self, analyzer, mainid, subid, eventtype, start, end, description, parameterdump):
		events.update(
			{"analyzer": analyzer, "mainid": mainid, "subid": subid, "eventtype": eventtype, "start": start},
			{"$set": {"end": end, "description": description, "parameterdump": parameterdump}}
		)
		events.flushCache()