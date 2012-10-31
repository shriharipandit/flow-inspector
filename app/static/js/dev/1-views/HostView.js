var HostView = Backbone.View.extend({
	className: "host-chart",
	events: {},
	initialize: function(options) {
		if(!this.model ) {
			this.model = new HostViewModel();
		}
    	
		this.model.bind("change:value", this.changeValue, this);
		this.model.bind("change:interval", this.changeInterval, this);
		this.model.bind("change:bucket_size", this.changeBucketSize, this);

		this.loaderTemplate = _.template($("#loader-template").html());
    	
		// chart formatting
		this.m = [10, 20, 30, 70];
		this.stroke = d3.interpolateRgb("#0064cd", "#c43c35");
    	
		this.index = options.index;// new IndexQuery(null, { index: this.model.get("index") });
		this.index.bind("reset", this.render, this);

		// fetch at the end because a cached request calls render immediately!
		if (this.model.get("fetchOnInit")) {
			this.fetchData();
		}
	},
	render: function() {
		var
			container = $(this.el).empty()
			w = container.width() / 1.8,
			cw = container.width(),
			yOffset = 30
			h = 350,
			data = this.index.models,
			num_val = this.model.get("value"),
			stroke = this.stroke
			;
		if (w <= 0) {
			return ;
		}

		if(data.length === 0) {
			container.append(this.loaderTemplate());
			return this;
		}

		this.svg = d3.select(container.get(0))
			.append("svg:svg")
			.attr("width", cw + this.m[1] + this.m[3])
			.attr("height", h + this.m[0] + this.m[2] + yOffset);

		this.labelGroup = this.svg.append("svg:g");
		this.barGroup = this.svg.append("svg:g");
		this.lineGroup = this.svg.append("svg:g");

		var y = d3.scale.linear().range([yOffset,  h + yOffset]);
		var min_value = d3.min(data, function(d) { return d.get(num_val); });
		var max_value = d3.max(data, function(d) { return d.get(num_val); });
		y.domain([0, data.length]);
		
		// draw grid layout
		this.lineGroup.selectAll()
			.data(data)
			.enter()
				.append("svg:line")
					.attr("x1", 0)
					.attr("x2", cw - 75)
					.attr("y1", function(d, idx) { return y(idx) + 18; })
					.attr("y2", function(d, idx) { return y(idx) + 18; })
					.style("stroke", "rgb(0,0,0)");

		this.lineGroup.append("svg:line")
			.attr("x1", 0)
			.attr("x2", cw - 75)
			.attr("y1", 18)
			.attr("y2", 18)
			.style("stroke", "rgb(0,0,0)")

		this.lineGroup.append("svg:line")
			.attr("x1", w)
			.attr("x2", w)
			.attr("y1", 0)
			.attr("y3", 0)

		this.labelGroup.append("text")
			.attr("x", 0)
			.attr("y", this.m[0])
			.attr("text-anchor", "center")
			.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
			.text("IP Address")

		var perGroup = (cw - w - 75) / 5;
		var tOffset = w + 30;
		this.labelGroup.append("text")
			.attr("x", tOffset)
			.attr("y", this.m[0])
			.attr("text-anchor", "center")
			.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
			.text("TCP")

		this.labelGroup.append("text")
			.attr("x", tOffset + perGroup)
			.attr("y", this.m[0])
			.attr("text-anchor", "center")
			.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
			.text("UDP")

		this.labelGroup.append("text")
			.attr("x", tOffset + 2*perGroup)
			.attr("y", this.m[0])
			.attr("text-anchor", "center")
			.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
			.text("ICMP")

		this.labelGroup.append("text")
			.attr("x", tOffset + 3*perGroup)
			.attr("y", this.m[0])
			.attr("text-anchor", "center")
			.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
			.text("Other")


		this.labelGroup.append("text")
			.attr("x", tOffset + 4*perGroup)
			.attr("y", this.m[0])
			.attr("text-anchor", "center")
			.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
			.text("Total")


		// add text to bars
		this.labelGroup.selectAll()
			.data(data)
			.enter()
				.append("text")
					.attr("class", "host-overview-y-axis-text")
					.attr("x", 0)
					.attr("y", function(d, idx) { return y(idx) + 10; })
					.attr("text-anchor", "left")
  					.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
					.text(function(d) { return FlowInspector.ipToStr(d.id); });

		var textGroup = this.labelGroup.selectAll('.host-overview-y-axis-text');
		var offset = textGroup.node().getComputedTextLength() + 15;

		var x = d3.scale.linear().range([0, w - offset]);
		x.domain([0, max_value]);


		this.labelGroup.append("text")
			.attr("x", offset )
			.attr("y", this.m[0])
			.attr("text-anchor", "center")
			.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
			.text("Traffic")

		// draw the bars
		var barWidth = h / data.length / 2;
		var bar = this.barGroup.selectAll("rect")
			.data(data);

		var bar_enter = bar.enter().append("g")
			.attr("class", "bar")
			.attr("title", FlowInspector.getTitleFormat(num_val));

		$(".bar", this.el).twipsy({
			offset: 3,
			placement: "above"
		});

		// the following method aims at getting the appropriate x-offset for 
		// the value of num_val (which can be flows, pakets, or bytes) 
		// for the given protocol (tcp, udp, icmp, others)
		getProtoSpecificX = function(obj, proto, num_val) {
			var val = 1;
			var protoObj = obj.get(proto);
			// the value might not be set in the db. use 0 as default
			if (protoObj) {
				val = protoObj[num_val];
				if (! val > 0) {
					val = 1;
				}
			}
			return x(val);
		}
			
		this.labelGroup.selectAll()
			.data(data)
			.enter()
				.append("text")
					.attr("x", tOffset)
					.attr("y", function(d, idx) { return y(idx) + 10; })
					.attr("text-anchor", "left")
  					.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
					.text(function(d) {
							var f = FlowInspector.getTitleFormat(num_val, "tcp");
							return f(d);
					});

		this.labelGroup.selectAll()
			.data(data)
			.enter()
				.append("text")
					.attr("x", tOffset + perGroup)
					.attr("y", function(d, idx) { return y(idx) + 10; })
					.attr("text-anchor", "left")
  					.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
					.text(function(d) {
							var f = FlowInspector.getTitleFormat(num_val, "udp");
							return f(d);
					});


		this.labelGroup.selectAll()
			.data(data)
			.enter()
				.append("text")
					.attr("x", tOffset + 2*perGroup)
					.attr("y", function(d, idx) { return y(idx) + 10; })
					.attr("text-anchor", "left")
  					.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
					.text(function(d) {
							var f = FlowInspector.getTitleFormat(num_val, "icmp");
							return f(d);
					});

		this.labelGroup.selectAll()
			.data(data)
			.enter()
				.append("text")
					.attr("x", tOffset + 3*perGroup)
					.attr("y", function(d, idx) { return y(idx) + 10; })
					.attr("text-anchor", "left")
  					.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
					.text(function(d) {
							var f = FlowInspector.getTitleFormat(num_val, "other");
							return f(d);
					});

		this.labelGroup.selectAll()
			.data(data)
			.enter()
				.append("text")
					.attr("x", tOffset + 4*perGroup)
					.attr("y", function(d, idx) { return y(idx) + 10; })
					.attr("text-anchor", "left")
  					.attr("style", "font-size: 12; font-family: Helvetica, sans-serif")
					.text(function(d) {
							var f = FlowInspector.getTitleFormat(num_val);
							return f(d);
					});


		// tcp bar, starts of the left side of the graph
		bar_enter.append("rect")
				.attr("class", "tcp")
				.attr("x", offset)
				.attr("y", function(d, idx) { return y(idx); })
				.attr("width", function(d) { return getProtoSpecificX(d, "tcp", num_val); })
				.attr("height", barWidth)
				.attr("fill", FlowInspector.tcpColor)
				.attr("title", function(d) { 
							var f = FlowInspector.getTitleFormat(num_val);
							return "TCP: " + f(d);
						});

		$(".tcp", this.el).twipsy({
			offset: 3,
			placement: "above"
		});

		// udp bar, starts after the tcp bar
		bar_enter.append("rect")
				.attr("class", "udp")
				.attr("x", function(d, idx) { return offset + getProtoSpecificX(d, "tcp", num_val); } )
				.attr("y", function(d, idx) { return y(idx); })
				.attr("width", function(d) { return getProtoSpecificX(d, "udp", num_val); })
				.attr("height", barWidth)
				.attr("fill", FlowInspector.udpColor)
				.attr("title", function(d) { 
							var f = FlowInspector.getTitleFormat(num_val);
							return "UDP: " + f(d);
						});
		$(".udp", this.el).twipsy({
			offset: 3,
			placement: "above"
		});

		// icmp bar, starts after the udp bar
		bar_enter.append("rect")
				.attr("class", "icmp")
				.attr("x", function(d, idx) { return offset + getProtoSpecificX(d, "tcp", num_val) + getProtoSpecificX(d, "udp", num_val); } )
				.attr("y", function(d, idx) { return y(idx); })
				.attr("width", function(d) { return getProtoSpecificX(d, "icmp", num_val); })
				.attr("height", barWidth)
				.attr("fill", FlowInspector.icmpColor)
				.attr("title", function(d) { 
							var f = FlowInspector.getTitleFormat(num_val);
							return "ICMP: " + f(d);
						});
		$(".icmp", this.el).twipsy({
			offset: 3,
			placement: "above"
		});


		// others bar, starts after the imcp bar
		bar_enter.append("rect")
				.attr("class", "other")
				.attr("x", function(d, idx) { return offset + getProtoSpecificX(d, "tcp", num_val) + getProtoSpecificX(d, "udp", num_val) + getProtoSpecificX(d, "icmp", num_val) } )
				.attr("y", function(d, idx) { return y(idx); })
				.attr("width", function(d) { return getProtoSpecificX(d, "other", num_val); })
				.attr("height", barWidth)
				.attr("fill", FlowInspector.otherColor)
				.attr("title", function(d) { 
							var f = FlowInspector.getTitleFormat(num_val);
							return "Other: " + f(d);
						});
		$(".other", this.el).twipsy({
			offset: 3,
			placement: "above"
		});


		bar_enter.append("line")
			.attr("x1", function(d) { return x(d.get(num_val)) + offset; })
			.attr("x2", function (d) {return x(d.get(num_val)) + offset; })
			.attr("y1", function(d, idx) { return y(idx); })
			.attr("y2", function(d, idx) { return y(idx) + barWidth; })
			.attr("stroke", function(d) { return stroke(d.get(num_val) / max_value); });

    	
		var legendXOffset = 65;

		this.labelGroup.append("text")
			.attr("x", cw-5)
			.attr("y", h-5)
			.attr("text-anchor", "end")
			.text("#" + num_val);

		this.labelGroup.append("text")
			.attr("x", cw-5)
			.attr("y", h - 65)
			.attr("text-anchor", "end")
			.text("tcp");

		this.labelGroup.append("rect")
			.attr("width", 20)
			.attr("height", 10)
			.attr("x", cw - legendXOffset)
			.attr("y", h - 75)
			.attr("fill", FlowInspector.tcpColor);

    		this.labelGroup.append("text")
			.attr("x", cw-5)
			.attr("y", h - 50 )
			.attr("text-anchor", "end")
			.text("udp");

		this.labelGroup.append("rect")
			.attr("width", 20)
			.attr("height", 10)
			.attr("x", cw - legendXOffset)
			.attr("y", h - 60)
			.attr("fill", FlowInspector.udpColor);


    		this.labelGroup.append("text")
			.attr("x", cw-5)
			.attr("y", h - 35)
			.attr("text-anchor", "end")
			.text("icmp");

		this.labelGroup.append("rect")
			.attr("width", 20)
			.attr("height", 10)
			.attr("x", cw - legendXOffset)
			.attr("y", h - 45)
			.attr("fill", FlowInspector.icmpColor);


    		this.labelGroup.append("text")
			.attr("x", cw-5)
			.attr("y", h - 20)
			.attr("text-anchor", "end")
			.text("other");

		this.labelGroup.append("rect")
			.attr("width", 20)
			.attr("height", 10)
			.attr("x", cw - legendXOffset)
			.attr("y", h - 30)
			.attr("fill", FlowInspector.otherColor);


		return this;
	},
	changeIndex: function(model, value) {
		if (w <= 0) {
			return ;
		}

		this.index.index = value;
		this.fetchData();
		return this;
	},
	fetchData: function() {
		var limit = this.model.get("limit");
		var interval = this.model.get("interval");
		var bucket_size = this.model.get("bucket_size");

		var filter_ports = this.model.get("filterPorts");
		var filter_ports_type = this.model.get("filterPortsType");
		var filter_ips = this.model.get("filterIPs");
		var filter_ips_type = this.model.get("filterIPsType");
		var filter_protocols = this.model.get("filterProtocols");
		var filter_protocols_type = this.model.get("filterProtocolsType");
		var do_aggregate = false;

		var data = {
			"limit": limit, 
			"sort": this.model.get("value") + " desc"
		}
		if (interval.length > 0) {
			data["start_bucket"] =  Math.floor(interval[0].getTime() / 1000);
			data["end_bucket"] =  Math.floor(interval[1].getTime() / 1000);
		} else {
			data["start_bucket"] = 0;
			data["end_bucket"] = 0;
		}
		if (bucket_size) {
			data["bucket_size"] = bucket_size;
		}

		// apply filter for ports
		var ports = filter_ports.split("\n");
		filter_ports = "";
		for(var i = 0; i < ports.length; i++) {
			var p = parseInt(ports[i]);
    			// test for NaN
    			if(p === p) {
    				if(filter_ports.length > 0) {
    					filter_ports += ",";
    				}
    				filter_ports += p;
    			}
		}
		if(filter_ports) {
			if(filter_ports_type === "exclusive") {
				data["exclude_ports"] = filter_ports;
			} else {
				data["include_ports"] = filter_ports;
			}
			do_aggregate = true;
		}

		// apply filter for IPs
		var ips = filter_ips.split("\n");
		filter_ips = "";
		for(var i = 0; i < ips.length; i++) {
			var p = FlowInspector.strToIp(ips[i]);
    			if(p != null) {
    				if(filter_ips.length > 0) {
    					filter_ips += ",";
    				}
    				filter_ips += p;
    			}
		}
		if(filter_ips) {
			if(filter_ips_type === "exclusive") {
				data["exclude_ips"] = filter_ips;
			} else {
				data["include_ips"] = filter_ips;
			}
			do_aggregate = true;
		}

		// apply filter for IPs
		var protocols = filter_protocols.split("\n");
		filter_protocols = "";
		for(var i = 0; i < protocols.length; i++) {
			if(filter_protocols.length > 0) {
				filter_protocols += ",";
			}
    			filter_protocols += protocols[i];
		}
		if(filter_protocols) {
			if(filter_protocols_type === "exclusive") {
				data["exclude_protos"] = filter_protocols;
			} else {
				data["include_protos"] = filter_protocols;
			}
			do_aggregate = true;
		}


		// we need to calculate the buckets dynamically 
		// because of dynamic filtering. Prepare the 
		// query that does the aggregation on the default
		// non-aggregated db
		if (do_aggregate) {
			data["aggregate"] = FlowInspector.COL_IPADDRESS;
		}


		this.index.models = [];
		this.render();

		this.index.fetch({data: data});
	},
	changeInterval: function() {
		this.fetchData();
	},
	changeValue: function() {
		this.fetchData();
	},
	changeBucketSize: function() {
		this.fetchData();
	}
});
