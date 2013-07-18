#!/usr/bin/env python
# -*- coding: utf-8 -*-

# import base class
import Analyzer

# import standard python modules
import math
import sys

class IntervalAnalyzer(Analyzer.Analyzer):
	
	def __init__(self, router, interface):
		self.router = router
		self.interface = interface
		self.last_timestamp = 0

		self.st = 0
		self.p_st = 0.25
		self.ewmv = 0
		self.p_ewmv = 0.25
		
		self.L = 1.5  

	
	def passDataSet(self, data):
		router = self.router
		interface = self.interface
		timestamp = data[router][interface]["timestamp"]
		
		if self.last_timestamp == 0:
			self.last_timestamp = data[router][interface]["timestamp"]
			return

		t = data[router][interface]["timestamp"] - self.last_timestamp
		self.st = self.p_st * t + (1 - self.p_st) * self.st
		self.ewmv = self.p_ewmv * (t - self.st)**2 + (1 - self.p_ewmv) * self.ewmv


		lower_bound = self.st - self.L * math.sqrt(self.ewmv * self.p_st / (2 - self.p_st))
		upper_bound = self.st + self.L * math.sqrt(self.ewmv * self.p_st / (2 - self.p_st))

		if lower_bound - t > 6e-14:
			print "%s %s: %s - time too small - %s < %s" % (timestamp, router, interface, t, lower_bound)
		if upper_bound - t < -6e-14:
			print "%s %s: %s - time too big - %s > %s" % (timestamp, router, interface, t, upper_bound)

		self.last_timestamp = data[router][interface]["timestamp"]
	
	@staticmethod
	def getInstances(data):
		return ((str(router) + "-" + str(interface), (router, interface)) for router in data for interface in data[router])
