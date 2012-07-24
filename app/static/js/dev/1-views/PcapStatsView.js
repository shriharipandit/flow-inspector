var PcapStatsView = Backbone.View.extend({
	className: "pcapstatsview",
	initialize: function() {

	/*
		// chart formatting
		this.m = [10, 20, 30, 70];
		this.stroke = d3.interpolateRgb("#0064cd", "#c43c35");
    	
		this.index = new IndexQuery(null, { index: this.model.get("index") });
		this.index.bind("reset", this.render, this);
		// fetch at the end because a cached request calls render immediately!
		this.index.fetch();
	*/
	},
	render: function() {
		var container = $(this.el).empty();
		var w = container.width();
		var h = container.height();

		if (w <= 0) {
			return;
		}
		$(this.el).append("<h2>Statistics</h2>");

		this.svg = d3.select(container.get(0))
			.append("svg:svg")
			.attr("width", w)
			.attr("height", h);

		this.ppsImg = this.svg.append("svg:g");
		this.throughPutImg = this.svg.append("svg:g");

		this.svg.append("svg:image")
			.attr("xlink:href", "/api/pcap/images/pps.png")
			.attr("width", w)
			.attr("height", h/2);
		this.svg.append("svg:image")
			.attr("xlink:href", "/api/pcap/images/tp.png")
			.attr("y", h/2)
			.attr("width", w)
			.attr("height", h/2);
//		this.ppsImg.append("label")
//			.text("foobar");

		return this;
	},
	showPcapAnalysisStatus : function() {
		this.pcapAnalysisStatus = true;
	},
	hidePcapAnalysisStatus : function() {
		this.pcapAnalysisStatus = false;
	}
});