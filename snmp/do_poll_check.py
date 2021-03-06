#!/usr/bin/env python 

"""
This script performs the live checks and snmp availability checks
on the host list that has been generated by add_devices_to_monitoring. 

It employs the fping tool or (tools/onlinecheck) for live check, and the 
external tool snmpwalk for snmp availablity. 

This script requires that the user running this script has the rights to
 run fping or onlinecheck. 
fping or onlinecheck also must be in the default path of the user.
"""

import sys
import os.path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'config'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'vendor'))

import common
import csv_configurator
import subprocess
import backend
import time

def perform_snmp_availability_check(ip_list_community_strings):
	"""
	The method checks the availabiliyt of the ip list for snmp
	queries. It takes a list of tuples of (ip_list, community_string)
	that can be used to query the device for the OID ???
	"""
	checker_pipe = subprocess.Popen([os.path.join(os.path.dirname(__file__), '..', 'tools', 'snmpwalk-worker')], stdout=subprocess.PIPE,stdin=subprocess.PIPE)

	input_for_snmpwalk_worker = ""
	for ip in ip_list_community_strings:
		community_string = ip_list_community_strings[ip]['community_string']
		input_for_snmpwalk_worker += ip + " " + community_string + "\n"

	output = checker_pipe.communicate(input=input_for_snmpwalk_worker)[0].split('\n')
	
	unreachable_ips = []
	for line in output:
		line = line.rstrip('\n')
		# skip empty lines
		if len(line) == 0:
			continue
		unreachable_ips.append(line)
	return unreachable_ips

		

def perform_live_check(ip_list):
	"""
	Retrieves a list of IP addresses that should be checked. All IPs 
	are checked with fping/onlinecheck and a list of unreachable IPs is returend to the caller.
	"""
	#checker_pipe = subprocess.Popen(['fping', '-u', '-i', '10', '-p', '20', '-t', '50'], stdout=subprocess.PIPE,stdin=subprocess.PIPE)
	checker_pipe = subprocess.Popen([os.path.join(os.path.dirname(__file__), '..', 'tools', 'onlinecheck')], stdout=subprocess.PIPE,stdin=subprocess.PIPE)

	input_for_checker = ""
	for ip in ip_list:
		if ip_list[ip]['do_live_check'] == 0:
			continue 

		input_for_checker += ip + "\n"
	output = checker_pipe.communicate(input=input_for_checker)[0].split('\n')
	
	unreachable_ips = []
	for line in output:
		line = line.rstrip('\n')
		# skip empty lines
		if len(line) == 0:
			continue
		
		unreachable_ips.append(line)
	return unreachable_ips


def update_results(collection, unreachable_ips, previous_results):
	# first: check if we need an update on the devices that we 
	# now found unreachble
	for ip in unreachable_ips:
		if not ip in monitoring_ips:
			print "IP %s was checked but is now in list of known monitoring_ips!" % (ip)
			continue
		device_id = monitoring_ips[ip]['_id']
		table_entry = {}
		if not device_id in previous_results:
			# no entries for this IP. So this is the first fail. 
			# create a new entry for the IP
			table_entry = {}
			table_entry['last_checked'] = timestamp
			table_entry['first_fail'] = timestamp
			table_entry['last_fail'] = timestamp
			table_entry['status'] = 0
		else:
			# device has previously failed 
			table_entry = previous_results[device_id]
			del table_entry['device_id']
			table_entry['last_checked'] = timestamp
			table_entry['last_fail'] = timestamp
			if table_entry['status'] == 1:
				# device was available in the mean time but is gone again
				# update status and first_fail timestamp to current
				# time stamp
				table_entry['status'] = 0
				table_entry['first_fail'] = 0
			# remove this ip from the list (we need to update the others later on 
			del previous_results[device_id]

		doc = {}
		doc["$set"] = table_entry
		collection.update({"device_id": device_id}, doc)

	for device_id in previous_results:
		# the remaining ips in the monitoring list are online. update their last_check 	for device_id in previous_results:
		table_entry = previous_results[device_id]
		table_entry["status"] = 1
		table_entry["last_checked"] = timestamp
		del table_entry['device_id']
		doc = {}
		doc["$set"] = table_entry
		collection.update({"device_id": device_id}, doc)
	collection.flushCache()



if __name__ == "__main__":
	parser = common.get_default_argument_parser("Tool for performing live checks on the devices that require the monitoring")

	args = parser.parse_args()

	dst_db = backend.databackend.getBackendObject(
		args.backend, args.dst_host, args.dst_port,
		args.dst_user, args.dst_password, args.dst_database)

	measurement_map_filename =  os.path.join(os.path.dirname(__file__), "..", "config",  "monitoring_devices.csv")
	for name, fields in csv_configurator.read_field_dict_from_csv(args.backend, measurement_map_filename).items():
		dst_db.prepareCollection(name, fields)


	device_table = dst_db.getCollection("device_table")
	live_check_table = dst_db.getCollection("live_check_table")
	snmp_availability_table = dst_db.getCollection("snmp_availability")

		
	# get the ips that should be monitored for live checks
	resultSet = device_table.find({'status': 1}, {'_id': 1, 'ip': 1, 'do_live_check': 1, 'do_snmp': 1})
	monitoring_ips = dict()
	for result in resultSet:
		monitoring_ips[result['ip']] = result
	# get the ips that should be monitored for snmp availability
	resultSet = device_table.find({'do_snmp': 1, 'status': 1}, {'_id': 1, 'ip': 1, 'community_string': 1})
	snmp_ips = dict()
	for result in resultSet:
		snmp_ips[result['ip']] = result

	timestamp = long(time.time())

	# do the live checks
	unreachable_list = perform_live_check(monitoring_ips)

	# get the result set from the last run
	resultSet = live_check_table.find({})
	previous_results = dict()
	for result in resultSet:
		previous_results[result['device_id']] = result

	update_results(live_check_table, unreachable_list, previous_results)

	# do the snmp checks
	unreachable_list = perform_snmp_availability_check(snmp_ips)
	# get the result set from the last checks for snmp availability
	resultSet = snmp_availability_table.find({})
	previous_results = dict()
	for result in resultSet:
		previous_results[result['device_id']] = result

	update_results(snmp_availability_table, unreachable_list, previous_results)

	
