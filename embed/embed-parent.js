/* jslint browser: true, indent: 4, regexp: true  */

(function() {
	var config = require("../client-config-defaults.js"),
		validate = require("../lib/validate.js");

	function insertWidget() {
		var sb, style, iframe, container,
			embed = {},
			host = config.server.protocol + config.server.host;

		window.scrollback = window.scrollback || {};

		sb = window.scrollback;

		sb.room = sb.room || ((sb.streams && sb.streams.length) ? sb.streams[0] : "scrollback");

		embed.form = sb.form || "toast";
		embed.theme = "dark";
		embed.nick = sb.nick || sb.suggestedNick;
		embed.minimize = (typeof sb.minimize === "boolean") ? sb.minimize : false;
		embed.origin = {
			protocol: location.protocol,
			host: location.host,
			path: location.pathname + location.search + location.hash
		};

		embed.titlebarColor = sb.titlebarColor;
		embed.titlebarImage = sb.titlebarImage;

		sb.room = validate(sb.room).sanitized;

		// Insert required styles
		style = document.createElement("link");
		style.rel = "stylesheet";
		style.type = "text/css";
		style.href = host + "/s/styles/dist/embed.min.css";

		document.head.appendChild(style);
		iframe = document.createElement("iframe");
		if (embed.form === "canvas") {
			container = document.getElementById("scrollback-container");
		}
		
		if (!container) {
			embed.form = sb.embed = "toast";
			document.body.appendChild(iframe);
		} else {
			container.appendChild(iframe);
		}
		


		// TODO: change "embed" to "context"
		iframe.src = host + "/" + sb.room + (sb.thread ? "/" + sb.thread : "") + "?embed=" + encodeURIComponent(JSON.stringify(embed));

		iframe.className = "scrollback-stream scrollback-" + embed.form + " " + ((sb.minimize && embed.form == "toast") ? " scrollback-minimized" : "");				
		window.addEventListener("message", function (e) {
			var data;
			var minReg = /\bscrollback-minimized\b/;

			if (e.origin === host) {
				try{
					data = JSON.parse(e.data);
				}catch(e){
					console.log("Parse error: ", data);
					return;
				}
				switch(data.type) {
					case "activity":
						if(data.hasOwnProperty("minimize")) {
							if (data.minimize) {
								if(!minReg.test(iframe.className)) {
									iframe.className = iframe.className + " scrollback-minimized";
								}
							} else {
								iframe.className = iframe.className.replace(minReg, "").trim();
							}
						}
					break;
					case "domain-challenge":
						iframe.contentWindow.postMessage(JSON.stringify({
							type: "domain-response",
							token: data.token
						}), host);
					break;		
				}
			}
		}, false);
	}

	if (document.readyState === "complete") {
		// document is already fully loaded. do our work
		insertWidget();
	} else {
		// document is not ready, wait till it's loaded
		document.addEventListener("readystatechange", function() {
			if (document.readyState === "complete") {
				insertWidget();
			}
		}, false);
	}
})();
