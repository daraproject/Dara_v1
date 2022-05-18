/*

This file contains code from SavePage WE, used under GPL license

*/

"use strict";

fontfaceScript();

function fontfaceScript() {
	var script;
	script = document.createElement("script");
	script.setAttribute("data-dara-fontface","");
	script.textContent = "(" + interceptFontFace.toString() + ")();";
	document.documentElement.appendChild(script);
	script.remove();
	function interceptFontFace() {
		var OrigFontFace;
		if (window.FontFace) {
			OrigFontFace = window.FontFace;
			window.FontFace =
			function () {
				var i,fontfacerule,style;
				fontfacerule = "@font-face { ";
				fontfacerule += "font-family: " + arguments[0] + "; ";
				fontfacerule += "src: " + arguments[1] + "; ";
				if (arguments[2]) {
					if (arguments[2].weight) fontfacerule += "font-weight: " + arguments[2].weight + "; ";
					if (arguments[2].style) fontfacerule += "font-style: " + arguments[2].style + "; ";
					if (arguments[2].stretch) fontfacerule += "font-stretch: " + arguments[2].stretch + "; ";
				}
				fontfacerule += " }";
				style = document.createElement("style");
				style.setAttribute("data-dara-fontface","");
				style.textContent = fontfacerule;
				document.head.appendChild(style);
				return new OrigFontFace(...arguments);
			};
		}
	}
}
