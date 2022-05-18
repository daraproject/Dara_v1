/*

This file contains code from SavePage WE, used under GPL license

*/

"use strict";

var is_firefox;
var firefox_version;
var platform_os;
var platform_arch;
var maxTotalSize;  /* MB */
var display_warnings,display_resources,add_comments,skip_warnings;
var lazy_load_content,lazy_load_kind,merge_css_images,remove_unsaved_urls,remove_elements,hide_elements,format_html;
var save_audio_video,save_embedded_objects,save_all_images;
var save_all_css_images,save_all_css_woff_fonts,save_all_css_fonts,save_scripts;
var save_delay_time;
var lazy_scroll_time;
var max_frame_depth;
var max_resource_size;
var max_resource_time;
var page_kind;
var saved_items;
var toggle_lazy;
var extractSrcUrl;
var multipleSaves;
var skipLazyLoad,cancelSave;
var htmlCssText,bodyCssText,origScrollY;
var passNumber;
var frame_key_array = new Array();
var frame_url_array = new Array();
var frame_html_array = new Array();
var frame_fonts_array = new Array();
var resource_count;
var resource_location_array = new Array();
var resource_referer_array = new Array();
var resource_mimetype_array = new Array();
var resource_charset_array = new Array();
var resource_passive_array = new Array();
var resource_content_array = new Array();
var resource_status_array = new Array();
var resource_reason_array = new Array();
var resource_remembered_array = new Array();
var resource_replaced_array = new Array();
var resource_cssremembered_array = new Array();  /* number of times CSS image remembered */
var resource_cssframekeys_array = new Array();  /* keys of frames in which CSS image remembered */
var first_icon_location;  /* location of first favicon in document head */
var root_icon_location;  /* location of favicon in website root */
var enteredComments;
var htmlStrings = new Array();
var timeStart = new Array();
var timeFinish = new Array();
var shadowElements = new Array("audio","video","use");  /* HTML & SVG elements that have built-in Shadow DOM */
var hrefSVGElements = new Array("a","altGlyph","animate","animateColor","animateMotion","animateTransform","cursor","discard","feImage","filter","font-face-uri","glyphRef","image","linearGradient","mpath","pattern","radialGradient","script","set","textPath","tref","use");

/* Initialize on script load */

chrome.storage.local.get(null,
function(object){
	is_firefox = object["environment-isfirefox"];
	if (is_firefox) firefox_version = object["environment-ffversion"];
	platform_os = object["environment-platformos"];
	platform_arch = object["environment-platformarch"];
	display_warnings = true;
	display_resources = false;
	add_comments = false;
	skip_warnings = true;
	lazy_load_content = false;
	lazy_load_kind = 1;
	merge_css_images = true;
	remove_unsaved_urls = true;
	remove_elements = false;
	hide_elements = false;
	format_html = false;
	save_all_images = false;
	save_audio_video = false;
	save_embedded_objects = false;
	save_all_css_images = false;
	save_all_css_woff_fonts = false;
	save_all_css_fonts = false;
	save_scripts = false;
	save_delay_time = 0;
	lazy_scroll_time = 0.2;
	max_frame_depth = 0;
	max_resource_size = 50;
	max_resource_time = 120;
	if (platform_os == "win") {
		if (is_firefox) {
			if (firefox_version < 55) maxTotalSize = 150;
			else maxTotalSize = (platform_arch == "x86-64") ? 1000 : 400;
		} else {
			maxTotalSize = (platform_arch == "x86-64") ? 250 : 500;
		}
	} else {
		maxTotalSize = 200;
	}
	page_kind = 0;
	addListeners();
	chrome.runtime.sendMessage({ type: "scriptLoaded" });
});

/* Add listeners */
function addListeners() {
	chrome.runtime.onMessage.addListener(
	function(message,sender,sendResponse) {
		var i,panel,bar;
		switch (message.type) {
			case "performAction":
				saved_items = 0;
				extractSrcUrl = message.extractsrcurl;
				multipleSaves = message.multiplesaves;
				cancelSave = false;
				panel = document.getElementById("dara-message-panel-container");
				if (panel != null) document.documentElement.removeChild(panel);
				panel = document.getElementById("dara-unsaved-panel-container");
				if (panel != null) document.documentElement.removeChild(panel);
				performAction();
				break;
			case "loadSuccess":
				loadSuccess(message.index,message.content,message.contenttype,message.alloworigin);
				break;
			case "loadFailure":
				loadFailure(message.index,message.reason);
				break;
			case "replyFrame":
				i = frame_key_array.length;
				frame_key_array[i] = message.key;
				frame_url_array[i] = message.url;
				frame_html_array[i] = message.html;
				frame_fonts_array[i] = message.fonts;
				break;
			case "cancelSave":
				cancelSave = true;
				break;
		}
	});
}

/* Perform action function */
function performAction() {
	chrome.runtime.sendMessage({ type: "delay", milliseconds: save_delay_time*1000 }, 
	function (object) {
		document.querySelectorAll("img").forEach(
			function (element){
				/* Force loading of images with loading="lazy" attributes */
				if (element.getAttribute("loading") == "lazy"){
					element.removeAttribute("loading");
					element.setAttribute("data-dara-loading","lazy");
				}
				/* Force loading of images managed by lazy load JS libraries */
				/* Changes are the same as if the page was scrolled by the user */
				if (element.getAttribute("data-src")) element.setAttribute("src",element.getAttribute("data-src"));
				else if (element.getAttribute("data-original")) element.setAttribute("src",element.getAttribute("data-original"));
				else if (element.getAttribute("data-normal")) element.setAttribute("src",element.getAttribute("data-normal"));
				if (element.getAttribute("data-srcset")) element.setAttribute("srcset",element.getAttribute("data-srcset"));
				else if (element.getAttribute("data-original-set")) element.setAttribute("srcset",element.getAttribute("data-original-set"));
			}
		);
		frame_key_array.length = 0;
		frame_url_array.length = 0;
		frame_html_array.length = 0;
		frame_fonts_array.length = 0;
		resource_location_array.length = 0;
		resource_referer_array.length = 0;
		resource_mimetype_array.length = 0;
		resource_charset_array.length = 0;
		resource_passive_array.length = 0;
		resource_content_array.length = 0;
		resource_status_array.length = 0;
		resource_reason_array.length = 0;
		resource_remembered_array.length = 0;
		resource_replaced_array.length = 0;
		resource_cssremembered_array.length = 0;
		resource_cssframekeys_array.length = 0;
		first_icon_location = "";
		root_icon_location = "";
		enteredComments = "";
		htmlStrings.length = 0;
		htmlStrings[0] = "\uFEFF";  /* UTF-8 Byte Order Mark (BOM) - 0xEF 0xBB 0xBF */
		chrome.runtime.sendMessage({ type: "requestFrames" });
		chrome.runtime.sendMessage({ type: "delay", milliseconds: 200 },  /* allow time for all frames to reply */
		function(object){
			passNumber = 1;
			chrome.runtime.sendMessage({ type: "setSaveState", savestate: 1 });
			timeStart[1] = performance.now();
			findStyleSheets(0,window,document.documentElement);
			timeFinish[1] = performance.now();
			loadResources();
		});
	});
}

/* First Pass - to find external style sheets and load into arrays */
function findStyleSheets(depth,frame,element){
	var i,baseuri,charset,csstext,regex,parser,framedoc,shadowroot;
	var matches = new Array();
	/* External style sheet imported in <style> element */
	if (element.localName == "style"){
		if (!element.disabled){
			csstext = element.textContent;
			baseuri = element.ownerDocument.baseURI;
			charset = element.ownerDocument.characterSet;
			regex = /@import\s*(?:url\(\s*)?((?:"[^"]+")|(?:'[^']+')|(?:[^\s);]+))(?:\s*\))?\s*;/gi;  /* @import url() */
			while ((matches = regex.exec(csstext)) != null){
				matches[1] = removeQuotes(matches[1]);
				if (replaceableResourceURL(matches[1])){
					rememberURL(matches[1],baseuri,"text/css",charset,false);
				}
			}
		}
	}
	/* External style sheet referenced in <link> element */
	else if (element.localName == "link" && !(element.parentElement instanceof SVGElement)){
		if (element.rel.toLowerCase().indexOf("stylesheet") >= 0 && element.getAttribute("href")){
			if (!element.disabled){
				if (replaceableResourceURL(element.href)){
					baseuri = element.ownerDocument.baseURI;
					if (element.charset != "") charset = element.charset;
					else charset = element.ownerDocument.characterSet;
					rememberURL(element.href,baseuri,"text/css",charset,false);
				}
			}
		}
	}
	/* Handle nested frames and child elements */
	if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */{
		if (depth < max_frame_depth){
			try{
				if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before finding */{
					findStyleSheets(depth+1,element.contentWindow,element.contentDocument.documentElement);
				}
			}catch (e)  /* attempting cross-domain web page access */{
				for (i = 0; i < frame_key_array.length; i++){
					if (frame_key_array[i] == element.getAttribute("data-dara-key")) break;
				}
				if (i != frame_key_array.length){
					parser = new DOMParser();
					framedoc = parser.parseFromString(frame_html_array[i],"text/html");
					findStyleSheets(depth+1,null,framedoc.documentElement);
				}
			}
		}
	}else{
		/* Handle shadow child elements */
		if (is_firefox) shadowroot = element.shadowRoot || element.openOrClosedShadowRoot;
		else shadowroot = element.shadowRoot || ((chrome.dom && element instanceof HTMLElement) ? chrome.dom.openOrClosedShadowRoot(element) : null);
		if (shadowroot != null){
			if (shadowElements.indexOf(element.localName) < 0)  /* ignore elements with built-in Shadow DOM */{
				for (i = 0; i < shadowroot.children.length; i++){
					if (shadowroot.children[i] != null)  /* in case web page not fully loaded before finding */{
						findStyleSheets(depth,frame,shadowroot.children[i]);
					}
				}
			}
		}
		/* Handle normal child elements */
		for (i = 0; i < element.children.length; i++){
			if (element.children[i] != null)  /* in case web page not fully loaded before finding */{
				findStyleSheets(depth,frame,element.children[i]);
			}
		}
	}
}

/* Second Pass - to find other external resources and load into arrays */

function gatherOtherResources()
{
	var loadedfonts = new Array();

	passNumber = 2;

	chrome.runtime.sendMessage({ type: "setSaveState", savestate: 2 });

	timeStart[2] = performance.now();

	document.fonts.forEach(  /* CSS Font Loading Module */
	function(font)
	{
		if (font.status == "loaded")  /* font is being used in this document */
		{
			loadedfonts.push({ family: font.family, weight: font.weight, style: font.style, stretch: font.stretch });
		}
	});

	findOtherResources(0,window,document.documentElement,false,false,loadedfonts,"0");

	timeFinish[2] = performance.now();

	loadResources();
}

function findOtherResources(depth,frame,element,crossframe,nosrcframe,loadedfonts,framekey)
{
	var i,j,displayed,style,csstext,baseuri,charset,dupelem,dupsheet,currentsrc,passive,location,origurl,newurl,subframekey,parser,framedoc,shadowroot;
	var subloadedfonts = new Array();

	/* Determine if element is displayed */

	if (crossframe)
	{
		/* In a cross-origin frame, the document created by DOMParser */
		/* does not have an associated frame window, which means that */
		/* the window.getComputedStyle() function cannot be called.   */

		/* Assume all elements are displayed and force saving of all CSS images */

		displayed = true;
	}
	else if ((style = frame.getComputedStyle(element)) == null) displayed = true;  /* should not happen */
	else
	{
		displayed = (style.getPropertyValue("display") != "none");  /* element not collapsed */

		/* External images referenced in any element's computed style */

		if ((saved_items == 0 || saved_items == 1 || (saved_items == 2 && !save_all_css_images)) && displayed)
		{
			csstext = "";

			csstext += style.getPropertyValue("background-image") + " ";
			csstext += style.getPropertyValue("border-image-source") + " ";
			csstext += style.getPropertyValue("list-style-image") + " ";
			csstext += style.getPropertyValue("cursor") + " ";
			csstext += style.getPropertyValue("filter") + " ";
			csstext += style.getPropertyValue("clip-path") + " ";
			csstext += style.getPropertyValue("mask-image") + " ";
			csstext += style.getPropertyValue("-webkit-mask-image") + " ";

			style = frame.getComputedStyle(element,"::before");
			csstext += style.getPropertyValue("background-image") + " ";
			csstext += style.getPropertyValue("border-image-source") + " ";
			csstext += style.getPropertyValue("list-style-image") + " ";
			csstext += style.getPropertyValue("cursor") + " ";
			csstext += style.getPropertyValue("content") + " ";
			csstext += style.getPropertyValue("filter") + " ";
			csstext += style.getPropertyValue("clip-path") + " ";
			csstext += style.getPropertyValue("mask-image") + " ";
			csstext += style.getPropertyValue("-webkit-mask-image") + " ";

			style = frame.getComputedStyle(element,"::after");
			csstext += style.getPropertyValue("background-image") + " ";
			csstext += style.getPropertyValue("border-image-source") + " ";
			csstext += style.getPropertyValue("list-style-image") + " ";
			csstext += style.getPropertyValue("cursor") + " ";
			csstext += style.getPropertyValue("content") + " ";
			csstext += style.getPropertyValue("filter") + " ";
			csstext += style.getPropertyValue("clip-path") + " ";
			csstext += style.getPropertyValue("mask-image") + " ";
			csstext += style.getPropertyValue("-webkit-mask-image") + " ";

			style = frame.getComputedStyle(element,"::first-letter");
			csstext += style.getPropertyValue("background-image") + " ";
			csstext += style.getPropertyValue("border-image-source") + " ";

			style = frame.getComputedStyle(element,"::first-line");
			csstext += style.getPropertyValue("background-image") + " ";

			baseuri = element.ownerDocument.baseURI;

			rememberCSSImageURLs(csstext,baseuri,framekey);
		}
	}

	/* External images referenced in any element's style attribute */

	if (element.hasAttribute("style"))
	{
		if (/*(saved_items == 2 && save_all_css_images) || */crossframe)
		{
			//chrome.runtime.sendMessage({ method: "consoleLog", message: "YES" });
			csstext = element.getAttribute("style");

			baseuri = element.ownerDocument.baseURI;

			rememberCSSImageURLs(csstext,baseuri,framekey);
		}
	}

	/* External script referenced in <script> element */

	if (element.localName == "script")
	{
		if ((saved_items == 2 && save_scripts) && !crossframe && !nosrcframe)
		{

			if (element.getAttribute("src"))
			{
				if (replaceableResourceURL(element.src))
				{
					baseuri = element.ownerDocument.baseURI;

					if (element.charset != "") charset = element.charset;
					else charset = element.ownerDocument.characterSet;

					rememberURL(element.src,baseuri,"application/javascript",charset,false);
				}
			}
		}
	}

	/* External images or fonts referenced in <style> element */

	else if (element.localName == "style")
	{
		if (!element.disabled)
		{
			if (element.hasAttribute("data-dara-sheetrules")) csstext = element.getAttribute("data-dara-sheetrules");
			else
			{
				try
				{
					/* Count rules in element.textContent by creating duplicate element */

					dupelem = element.ownerDocument.createElement("style");
					dupelem.textContent = element.textContent;
					element.ownerDocument.body.appendChild(dupelem);
					dupsheet = dupelem.sheet;
					dupelem.remove();

					/* There may be rules in element.sheet.cssRules that are not in element.textContent */
					/* For example if the page uses CSS-in-JS Libraries */

					if (dupsheet.cssRules.length != element.sheet.cssRules.length)
					{
						csstext = "";

						for (i = 0; i < element.sheet.cssRules.length; i++)
						csstext += element.sheet.cssRules[i].cssText + "\n";
					}
					else csstext = element.textContent;
				}
				catch (e)  /* sheet.cssRules does not exist or cross-origin style sheet */
				{
					csstext = element.textContent;
				}
			}

			baseuri = element.ownerDocument.baseURI;

			rememberCSSURLsInStyleSheet(csstext,baseuri,crossframe,loadedfonts,[],framekey);
		}
	}

	/* External images or fonts referenced in <link> element */
	/* External icon referenced in <link> element */

	else if (element.localName == "link" && !(element.parentElement instanceof SVGElement))  /* <link> is invalid inside <svg> */
	{
		if (element.rel.toLowerCase().indexOf("stylesheet") >= 0 && element.getAttribute("href"))
		{
			if (!element.disabled)
			{
				if (replaceableResourceURL(element.href))
				{
					baseuri = element.ownerDocument.baseURI;

					if (baseuri != null)
					{
						location = resolveURL(element.href,baseuri);

						if (location != null)
						{
							location = removeFragment(location);

							for (i = 0; i < resource_location_array.length; i++)
							if (resource_location_array[i] == location && resource_status_array[i] == "success") break;

							if (i < resource_location_array.length)  /* style sheet found */
							{
								csstext = resource_content_array[i];

								baseuri = element.href;

								rememberCSSURLsInStyleSheet(csstext,baseuri,crossframe,loadedfonts,[location],framekey);
							}
						}
					}
				}
			}
		}
		else if ((element.rel.toLowerCase() == "icon" || element.rel.toLowerCase() == "shortcut icon") && element.getAttribute("href"))
		{
			if (replaceableResourceURL(element.href))
			{
				baseuri = element.ownerDocument.baseURI;

				rememberURL(element.href,baseuri,"image/vnd.microsoft.icon","",false);

				if (first_icon_location == "")
				{
					location = resolveURL(element.href,baseuri);

					if (location != null) first_icon_location = location;
				}
			}
		}
	}

	/* External location referenced in <a> or <area> element */

	else if ((element.localName == "a" && element instanceof HTMLElement) || element.localName == "area")
	{
	}

	/* External image referenced in <body> element */

	else if (element.localName == "body")
	{
		if (element.getAttribute("background"))
		{
			if (saved_items == 1 || (saved_items == 2 && save_all_images) ||
			(saved_items == 0 || (saved_items == 2 && !save_all_images)) && displayed)
			{
				if (replaceableResourceURL(element.background))
				{
					baseuri = element.ownerDocument.baseURI;

					rememberURL(element.background,baseuri,"image/png","",false);
				}
			}
		}
	}

	/* External image referenced in <img> element - can be inside <picture> element */

	else if (element.localName == "img")
	{
		/* currentSrc is set from src or srcset attributes on this <img> element */
		/* or from srcset attribute on <source> element inside <picture> element */

		/* Firefox - workaround because element.currentSrc may be empty string in cross-origin frames */

		currentsrc = (element.currentSrc != "") ? element.currentSrc : (element.getAttribute("src") ? element.src : "");

		if (currentsrc != "")
		{
			if (saved_items == 1 || (saved_items == 2 && save_all_images) ||
			(saved_items == 0 || (saved_items == 2 && !save_all_images)) && displayed)
			{
				if (replaceableResourceURL(currentsrc))
				{
					baseuri = element.ownerDocument.baseURI;

					passive = !((element.parentElement && element.parentElement.localName == "picture") || element.hasAttribute("srcset") || element.hasAttribute("crossorigin"));

					rememberURL(currentsrc,baseuri,"image/png","",passive);
				}
			}
		}
	}

	/* External image referenced in <input> element */

	else if (element.localName == "input")
	{
		if (element.type.toLowerCase() == "image" && element.getAttribute("src"))
		{
			if (saved_items == 1 || (saved_items == 2 && save_all_images) ||
			(saved_items == 0 || (saved_items == 2 && !save_all_images)) && displayed)
			{
				if (replaceableResourceURL(element.src))
				{
					baseuri = element.ownerDocument.baseURI;

					rememberURL(element.src,baseuri,"image/png","",false);
				}
			}
		}
	}

	/* External audio referenced in <audio> element */

	else if (element.localName == "audio")
	{
		if (element.getAttribute("src"))
		{
			if (element.src == element.currentSrc)
			{
				if (saved_items == 1 || (saved_items == 2 && save_audio_video))
				{
					if (replaceableResourceURL(element.src))
					{
						baseuri = element.ownerDocument.baseURI;

						passive = !element.hasAttribute("crossorigin");

						rememberURL(element.src,baseuri,"audio/mpeg","",passive);
					}
				}
			}
		}
	}

	/* External video and image referenced in <video> element */

	else if (element.localName == "video")
	{
		if (element.getAttribute("src"))
		{
			if (element.src == element.currentSrc)
			{
				if (saved_items == 1 || (saved_items == 2 && save_audio_video))
				{
					if (replaceableResourceURL(element.src))
					{
						baseuri = element.ownerDocument.baseURI;

						passive = !element.hasAttribute("crossorigin");

						rememberURL(element.src,baseuri,"video/mp4","",passive);
					}
				}
			}
		}

		if (element.getAttribute("poster"))
		{
			if (saved_items == 1 || (saved_items == 2 && save_audio_video))
			{
				if (saved_items == 1 || (saved_items == 2 && save_all_images) ||
				(saved_items == 0 || (saved_items == 2 && !save_all_images)) && displayed)
				{
					if (replaceableResourceURL(element.poster))
					{
						baseuri = element.ownerDocument.baseURI;

						rememberURL(element.poster,baseuri,"image/png","",false);
					}
				}
			}
		}
	}

	/* External audio/video/image referenced in <source> element */

	else if (element.localName == "source")
	{
		if (element.parentElement)
		{
			if (element.parentElement.localName == "audio" || element.parentElement.localName == "video")
			{
				if (element.getAttribute("src"))
				{
					if (element.src == element.parentElement.currentSrc)
					{
						if (saved_items == 1 || (saved_items == 2 && save_audio_video))
						{
							if (replaceableResourceURL(element.src))
							{
								baseuri = element.ownerDocument.baseURI;

								passive = !element.parentElement.hasAttribute("crossorigin");

								if (element.parentElement.localName == "audio") rememberURL(element.src,baseuri,"audio/mpeg","",passive);
								else if (element.parentElement.localName == "video") rememberURL(element.src,baseuri,"video/mp4","",passive);
							}
						}
					}
				}
			}
		}
	}

	/* External subtitles referenced in <track> element */

	else if (element.localName == "track")
	{
		if (element.getAttribute("src"))
		{
			if (saved_items == 1 || (saved_items == 2 && save_audio_video))
			{
				if (replaceableResourceURL(element.src))
				{
					baseuri = element.ownerDocument.baseURI;

					charset = element.ownerDocument.characterSet;

					rememberURL(element.src,baseuri,"text/vtt",charset,false);
				}
			}
		}
	}

	/* External data referenced in <object> element */

	else if (element.localName == "object")
	{
		if (element.getAttribute("data"))
		{
			if (saved_items == 1 || (saved_items == 2 && save_embedded_objects))
			{
				if (replaceableResourceURL(element.data))
				{
					baseuri = element.ownerDocument.baseURI;

					rememberURL(element.data,baseuri,"application/octet-stream","",false);
				}
			}
		}
	}

	/* External data referenced in <embed> element */

	else if (element.localName == "embed")
	{
		if (element.getAttribute("src"))
		{
			if (saved_items == 1 || (saved_items == 2 && save_embedded_objects))
			{
				if (replaceableResourceURL(element.src))
				{
					baseuri = element.ownerDocument.baseURI;

					rememberURL(element.src,baseuri,"application/octet-stream","",false);
				}
			}
		}
	}

	/* SVG - External location referenced in <a> element */

	else if (element.localName == "a" && element instanceof SVGElement)
	{
	}

	/* SVG - External resource referenced in other SVG elements */

	else if (hrefSVGElements.indexOf(element.localName) >= 0 && element instanceof SVGElement)
	{
		if (element.getAttribute("href") || element.getAttribute("xlink:href"))
		{
			baseuri = element.ownerDocument.baseURI;

			origurl = element.getAttribute("href") || element.getAttribute("xlink:href");

			newurl = adjustURL(origurl,baseuri);

			if (newurl.substr(0,1) != "#")  /* not fragment only */
			{
				if (replaceableResourceURL(element.href.baseVal))
				{
					charset = element.ownerDocument.characterSet;

					rememberURL(element.href.baseVal,baseuri,"image/svg+xml",charset,false);
				}
			}
		}
	}

	/* Handle nested frames and child elements */

	if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
	{
		if (depth < max_frame_depth)
		{
			if (element.localName == "iframe") nosrcframe = nosrcframe || (!element.getAttribute("src") && !element.getAttribute("srcdoc"));
			else nosrcframe = nosrcframe || !element.getAttribute("src");

			subframekey = element.getAttribute("data-dara-key");

			try
			{
				if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before finding */
				{
					element.contentDocument.fonts.forEach(  /* CSS Font Loading Module */
					function(font)
					{
						if (font.status == "loaded")  /* font is being used in this document */
						{
							subloadedfonts.push({ family: font.family, weight: font.weight, style: font.style, stretch: font.stretch });
						}
					});

					findOtherResources(depth+1,element.contentWindow,element.contentDocument.documentElement,crossframe,nosrcframe,subloadedfonts,subframekey);
				}
			}
			catch (e)  /* attempting cross-domain web page access */
			{
				for (i = 0; i < frame_key_array.length; i++)
				{
					if (frame_key_array[i] == subframekey) break;
				}

				if (i != frame_key_array.length)
				{
					parser = new DOMParser();
					framedoc = parser.parseFromString(frame_html_array[i],"text/html");

					findOtherResources(depth+1,null,framedoc.documentElement,true,nosrcframe,frame_fonts_array[i],subframekey);
				}
			}
		}
	}
	else
	{
		/* Handle shadow child elements */

		if (is_firefox) shadowroot = element.shadowRoot || element.openOrClosedShadowRoot;
		else shadowroot = element.shadowRoot || ((chrome.dom && element instanceof HTMLElement) ? chrome.dom.openOrClosedShadowRoot(element) : null);

		if (shadowroot != null)
		{
			if (shadowElements.indexOf(element.localName) < 0)  /* ignore elements with built-in Shadow DOM */
			{
				for (i = 0; i < shadowroot.children.length; i++)
				if (shadowroot.children[i] != null)  /* in case web page not fully loaded before finding */
				findOtherResources(depth,frame,shadowroot.children[i],crossframe,nosrcframe,loadedfonts,framekey);
			}
		}

		/* Handle normal child elements */

		for (i = 0; i < element.children.length; i++)
		if (element.children[i] != null)  /* in case web page not fully loaded before finding */
		findOtherResources(depth,frame,element.children[i],crossframe,nosrcframe,loadedfonts,framekey);

		/* Remember location of favicon in website root */

		if (element.localName == "head" && depth == 0)
		{
			if (first_icon_location == "")
			{
				baseuri = element.ownerDocument.baseURI;

				rememberURL("/favicon.ico",baseuri,"image/vnd.microsoft.icon","",false);

				location = resolveURL("/favicon.ico",baseuri);

				if (location != null) root_icon_location = location;
			}
		}
	}
}

function rememberCSSURLsInStyleSheet(csstext,baseuri,crossframe,loadedfonts,importstack,framekey)
{
	var i,regex,location,fontfamily,fontweight,fontstyle,fontstretch,fontmatches;
	var includeall,includewoff,usedfilefound,wofffilefound,srcregex,urlregex,fontfiletype;
	var matches = new Array();
	var propmatches = new Array();
	var srcmatches = new Array();
	var urlmatches = new Array();
	var fontweightvalues = new Array("normal","bold","bolder","lighter","100","200","300","400","500","600","700","800","900");
	var fontstretchvalues = new Array("normal","ultra-condensed","extra-condensed","condensed","semi-condensed","semi-expanded","expanded","extra-expanded","ultra-expanded");
	var fontstylevalues = new Array("normal","italic","oblique");

	/* @import url() or */
	/* @font-face rule with font url()'s or */
	/* image url() or */
	/* avoid matches inside double-quote strings or */
	/* avoid matches inside single-quote strings or */
	/* avoid matches inside comments */

	regex = new RegExp(/(?:@import\s*(?:url\(\s*)?((?:"[^"]+")|(?:'[^']+')|(?:[^\s);]+))(?:\s*\))?\s*;)|/.source +  /* matches[1] */
/(?:@font-face\s*({[^}]*}))|/.source +  /* matches[2] */
	/(?:url\(\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s)]+))\s*\))|/.source +  /* matches[3] */
	/(?:"(?:\\"|[^"])*")|/.source +
	/(?:'(?:\\'|[^'])*')|/.source +
	/(?:\/\*(?:\*[^\/]|[^\*])*?\*\/)/.source,
	"gi");

	while ((matches = regex.exec(csstext)) != null)  /* style sheet imported into style sheet */
	{
		if (matches[0].substr(0,7).toLowerCase() == "@import")  /* @import url() */
		{
			matches[1] = removeQuotes(matches[1]);

			if (replaceableResourceURL(matches[1]))
			{
				if (baseuri != null)
				{
					location = resolveURL(matches[1],baseuri);

					if (location != null)
					{
						location = removeFragment(location);

						for (i = 0; i < resource_location_array.length; i++)
						if (resource_location_array[i] == location && resource_status_array[i] == "success") break;

						if (i < resource_location_array.length)  /* style sheet found */
						{
							if (importstack.indexOf(location) < 0)
							{
								importstack.push(location);

								rememberCSSURLsInStyleSheet(resource_content_array[i],resource_location_array[i],crossframe,loadedfonts,importstack,framekey);

								importstack.pop();
							}
						}
					}
				}
			}
		}
		else if (matches[0].substr(0,10).toLowerCase() == "@font-face")  /* @font-face rule */
		{
			includeall = (saved_items == 2 && save_all_css_fonts);
			includewoff = (saved_items == 1 || (saved_items == 2 && save_all_css_woff_fonts));

		propmatches = matches[2].match(/font-family\s*:\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s;}]+(?: [^\s;}]+)*))/i);
		if (propmatches == null) fontfamily = ""; else fontfamily = removeQuotes(propmatches[1]).toLowerCase();

	propmatches = matches[2].match(/font-weight\s*:\s*([^\s;}]*)/i);
	if (propmatches == null) fontweight = "normal";
	else if (fontweightvalues.indexOf(propmatches[1].toLowerCase()) < 0) fontweight = "normal";
	else fontweight = propmatches[1].toLowerCase();

propmatches = matches[2].match(/font-style\s*:\s*([^\s;}]*)/i);
if (propmatches == null) fontstyle = "normal";
else if (fontstylevalues.indexOf(propmatches[1].toLowerCase()) < 0) fontstyle = "normal";
else fontstyle = propmatches[1].toLowerCase();

propmatches = matches[2].match(/font-stretch\s*:\s*([^\s;}]*)/i);
if (propmatches == null) fontstretch = "normal";
else if (fontstretchvalues.indexOf(propmatches[1].toLowerCase()) < 0) fontstretch = "normal";
else fontstretch = propmatches[1].toLowerCase();

fontmatches = false;

for (i = 0; i < loadedfonts.length; i++)
{
	if (removeQuotes(loadedfonts[i].family).toLowerCase() == fontfamily && loadedfonts[i].weight == fontweight &&
	loadedfonts[i].style == fontstyle && loadedfonts[i].stretch == fontstretch) fontmatches = true;  /* font matches this @font-face rule */
}

if (fontmatches)
{
	usedfilefound = false;
	wofffilefound = false;

srcregex = /src:([^;}]*)[;}]/gi;  /* @font-face src list */

while ((srcmatches = srcregex.exec(matches[2])) != null)  /* src: list of font file URLs */
{
	urlregex = /url\(\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s)]+))\s*\)(?:\s+format\(([^)]*)\))?/gi;  /* font url() and optional font format() list */

	while ((urlmatches = urlregex.exec(srcmatches[1])) != null)  /* font file URL */
	{
		urlmatches[1] = removeQuotes(urlmatches[1]);  /* url */

		if (replaceableResourceURL(urlmatches[1]))
		{
			fontfiletype = "";

			if (typeof urlmatches[2] != "undefined")  /* font format() list */
			{
				urlmatches[2] = urlmatches[2].replace(/"/g,"'");

				if (urlmatches[2].indexOf("'woff2'") >= 0) fontfiletype = "woff2";  /* Firefox, Chrome & Opera */
				else if (urlmatches[2].indexOf("'woff'") >= 0) fontfiletype = "woff";  /* all browsers */
				else if (urlmatches[2].indexOf("'truetype'") >= 0) fontfiletype = "ttf";  /* all browsers */
				else if (urlmatches[2].indexOf("'opentype'") >= 0) fontfiletype = "otf";  /* all browsers */
			}
			else
			{
				if (urlmatches[1].indexOf(".woff2") >= 0) fontfiletype = "woff2";  /* Firefox, Chrome & Opera */
				else if (urlmatches[1].indexOf(".woff") >= 0 && urlmatches[1].indexOf(".woff2") < 0) fontfiletype = "woff";  /* all browsers */
				else if (urlmatches[1].indexOf(".ttf") >= 0) fontfiletype = "ttf";  /* all browsers */
				else if (urlmatches[1].indexOf(".otf") >= 0) fontfiletype = "otf";  /* all browsers */
			}

			if (fontfiletype != "")
			{
				if (!usedfilefound)
				{
					usedfilefound = true;  /* first font file supported by this browser - should be the one used by this browser */

					if (fontfiletype == "woff") wofffilefound = true;

					rememberURL(urlmatches[1],baseuri,"application/font-woff","",false);
				}
				else if (includewoff && fontfiletype == "woff")
				{
					wofffilefound = true;  /* woff font file supported by all browsers */

					rememberURL(urlmatches[1],baseuri,"application/font-woff","",false);
				}
				else if (includeall)
				{
					rememberURL(urlmatches[1],baseuri,"application/font-woff","",false);
				}
			}

			if (!includeall && (wofffilefound || (!includewoff && usedfilefound))) break;
		}
	}

	if (!includeall && (wofffilefound || (!includewoff && usedfilefound))) break;
}
}
}
else if (matches[0].substr(0,4).toLowerCase() == "url(")  /* image url() */
{
	if ((saved_items == 2 && save_all_css_images) || crossframe)
	{
		matches[3] = removeQuotes(matches[3]);

		if (replaceableResourceURL(matches[3]))
		{
			rememberCSSImageURL(matches[3],baseuri,"image/png","",false,framekey);
		}
	}
}
else if (matches[0].substr(0,1) == "\"") ;  /* double-quote string */
else if (matches[0].substr(0,1) == "'") ;  /* single-quote string */
else if (matches[0].substr(0,2) == "/*") ;  /* comment */
}
}

function rememberCSSImageURLs(csstext,baseuri,framekey)
{
	var regex;
	var matches = new Array();

	regex = /url\(\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s)]+))\s*\)/gi;  /* image url() */

	while ((matches = regex.exec(csstext)) != null)
	{
		matches[1] = removeQuotes(matches[1]);

		if (replaceableResourceURL(matches[1]))
		{
			rememberCSSImageURL(matches[1],baseuri,"image/png","",false,framekey);
		}
	}
}

function rememberCSSImageURL(url,baseuri,mimetype,charset,passive,framekey)
{
	var i,location;

	if (page_kind > 0) return -1;  /* saved page - ignore new resources when re-saving */

	if (baseuri != null)
	{
		location = resolveURL(url,baseuri);

		if (location != null)
		{
			baseuri = removeFragment(baseuri);

			location = removeFragment(location);

			if (location == "" || location == baseuri) return -1;

			for (i = 0; i < resource_location_array.length; i++)
			if (resource_location_array[i] == location) break;

			if (i == resource_location_array.length)  /* new resource */
			{
				resource_location_array[i] = location;
				resource_referer_array[i] = baseuri;
				resource_mimetype_array[i] = mimetype;  /* default if load fails */
				resource_charset_array[i] = charset;  /* default if load fails */
				resource_passive_array[i] = passive;
				resource_content_array[i] = "";  /* default if load fails */
				resource_status_array[i] = "pending";
				resource_reason_array[i] = "";
				resource_remembered_array[i] = 1;
				resource_replaced_array[i] = 0;
				resource_cssremembered_array[i] = 1;
				resource_cssframekeys_array[i] = {};
				resource_cssframekeys_array[i][framekey] = true;

				return i;
			}
			else  /* repeated resource */
			{
				resource_remembered_array[i]++;
				resource_cssremembered_array[i]++;
				resource_cssframekeys_array[i][framekey] = true;
			}
		}
	}

	return -1;
}

function rememberURL(url,baseuri,mimetype,charset,passive){
	var i,location;
	if (page_kind > 0) return -1;  /* saved page - ignore new resources when re-saving */
	if (baseuri != null){
		location = resolveURL(url,baseuri);
		if (location != null){
			baseuri = removeFragment(baseuri);
			location = removeFragment(location);
			if (location == "" || location == baseuri) return -1;
			for (i = 0; i < resource_location_array.length; i++)
			if (resource_location_array[i] == location) break;
			if (i == resource_location_array.length){  /* new resource */
				resource_location_array[i] = location;
				resource_referer_array[i] = baseuri;
				resource_mimetype_array[i] = mimetype;  /* default if load fails */
				resource_charset_array[i] = charset;  /* default if load fails */
				resource_passive_array[i] = passive;
				resource_content_array[i] = "";  /* default if load fails */
				resource_status_array[i] = "pending";
				resource_reason_array[i] = "";
				resource_remembered_array[i] = 1;
				resource_replaced_array[i] = 0;
				resource_cssremembered_array[i] = 0;
				resource_cssframekeys_array[i] = {};
				return i;
			}else{  /* repeated resource */
				resource_remembered_array[i]++;
			}
		}
	}
	return -1;
}

/* After first or second pass - load resources */
function loadResources(){
	var i,documentURL,useCORS;
	timeStart[passNumber+3] = performance.now();
	resource_count = 0;
	for (i = 0; i < resource_location_array.length; i++){
		if (resource_status_array[i] == "pending"){
			resource_count++;
			documentURL = new URL(document.baseURI);
			useCORS = (resource_mimetype_array[i] == "application/font-woff");
			chrome.runtime.sendMessage({ type: "loadResource", index: i, location: resource_location_array[i], referer: resource_referer_array[i],
			passive: resource_passive_array[i], pagescheme: documentURL.protocol, usecors: useCORS });
		}
	}
	if (resource_count <= 0){
		timeFinish[passNumber+3] = performance.now();
		if (passNumber == 1) gatherOtherResources();
		else if (passNumber == 2) checkResources();
	}
}

function loadSuccess(index,content,contenttype,alloworigin){
	var i,mimetype,charset,resourceURL,frame_url_array,csstext,baseuri,regex,documentURL;
	var matches = new Array();
	/* Extract file MIME type and character set */
	matches = contenttype.match(/([^;]+)/i);
	if (matches != null) mimetype = matches[1].toLowerCase();
	else mimetype = "";
	matches = contenttype.match(/;charset=([^;]+)/i);
	if (matches != null) charset = matches[1].toLowerCase();
	else charset = "";
	/* Process file based on expected MIME type */
	switch (resource_mimetype_array[index].toLowerCase())  /* expected MIME type */{
		case "application/font-woff":  /* font file */
		/* CORS check required */
		if (alloworigin != "*")  /* restricted origin */{
			resourceURL = new URL(resource_location_array[index]);
			frame_url_array = new URL(resource_referer_array[index]);
			if (resourceURL.origin != frame_url_array.origin &&  /* cross-origin resource */
			(alloworigin == "" || alloworigin != frame_url_array.origin))  /* either no header or no origin match */{
				loadFailure(index,"cors");
				return;
			}
		}

		/* font file - fall through */
		case "image/svg+xml":  /* svg file or image file*/
		case "image/png":  /* image file */
		case "image/vnd.microsoft.icon":  /* icon file */
		case "audio/mpeg":  /* audio file */
		case "video/mp4":  /* video file */
		case "application/octet-stream":  /* data file */
		if (mimetype != "image/svg+xml")  /* not svg file */{
			if (mimetype != "") resource_mimetype_array[index] = mimetype;
			resource_charset_array[index] = "";
			resource_content_array[index] = content;
			break;
		}

		/* svg file - fall through */
		case "application/javascript":  /* javascript file */
		if (mimetype != "image/svg+xml")  /* svg file */{
			if (mimetype != "application/javascript" && mimetype != "application/x-javascript" && mimetype != "application/ecmascript" &&
			mimetype != "application/json" && mimetype != "text/javascript" && mimetype != "text/x-javascript" && mimetype != "text/json")  /* incorrect MIME type */{
				loadFailure(index,"mime");
				return;
			}
		}

		/* svg or javascript file - fall through */
		case "text/vtt":  /* subtitles file */
		if (mimetype != "") resource_mimetype_array[index] = mimetype;
		if (charset != "") resource_charset_array[index] = charset;
		if (content.charCodeAt(0) == 0xEF && content.charCodeAt(1) == 0xBB && content.charCodeAt(2) == 0xBF)  /* BOM */{
			resource_charset_array[index] = "utf-8";
			content = content.substr(3);
		}
		if (resource_charset_array[index].toLowerCase() == "utf-8"){
			try{
				resource_content_array[index] = convertUTF8ToUTF16(content);  /* UTF-8 */
			}catch (e){
				resource_charset_array[index] = "iso-8859-1";  /* assume ISO-8859-1 */
				resource_content_array[index] = content;
			}
		}else{
			resource_content_array[index] = content;  /* ASCII, ANSI, ISO-8859-1, etc */
		}
		break;
		case "text/css":  /* css file */
		if (mimetype != "text/css")  /* incorrect MIME type */{
			loadFailure(index,"mime");
			return;
		}
		matches = content.match(/^@charset "([^"]+)";/i);
		if (matches != null) resource_charset_array[index] = matches[1];
		if (charset != "") resource_charset_array[index] = charset;
		if (content.charCodeAt(0) == 0xEF && content.charCodeAt(1) == 0xBB && content.charCodeAt(2) == 0xBF)  /* BOM */{
			resource_charset_array[index] = "utf-8";
			content = content.substr(3);
		}
		if (resource_charset_array[index].toLowerCase() == "utf-8"){
			try{
				resource_content_array[index] = convertUTF8ToUTF16(content);  /* UTF-8 */
			}catch (e){
				resource_charset_array[index] = "iso-8859-1";  /* assume ISO-8859-1 */
				resource_content_array[index] = content;
			}
		}else{
			resource_content_array[index] = content;  /* ASCII, ANSI, ISO-8859-1, etc */
		}

		/* External style sheets imported in external style sheet */
		csstext = resource_content_array[index];
		baseuri = resource_location_array[index];
		regex = /@import\s*(?:url\(\s*)?((?:"[^"]+")|(?:'[^']+')|(?:[^\s);]+))(?:\s*\))?\s*;/gi;  /* @import url() */
		while ((matches = regex.exec(csstext)) != null)  /* style sheet imported into style sheet */{
			matches[1] = removeQuotes(matches[1]);
			if (replaceableResourceURL(matches[1])){
				i = rememberURL(matches[1],baseuri,"text/css",resource_charset_array[index],false);
				if (i >= 0)  /* style sheet not found */{
					resource_count++;
					documentURL = new URL(document.baseURI);
					chrome.runtime.sendMessage({ type: "loadResource", index: i, location: resource_location_array[i], referer: resource_referer_array[i],
					passive: resource_passive_array[i], pagescheme: documentURL.protocol, useCORS: false });
				}
			}
		}
		break;
	}
	resource_status_array[index] = "success";
	if (--resource_count <= 0){
		timeFinish[passNumber+3] = performance.now();
		if (passNumber == 1){
			gatherOtherResources();
		}else if (passNumber == 2){
			checkResources();
		}
	}
}

function loadFailure(index,reason)
{
	resource_status_array[index] = "failure";

	resource_reason_array[index] = reason;

	if (--resource_count <= 0)
	{
		timeFinish[passNumber+3] = performance.now();

		if (passNumber == 1) gatherOtherResources();
		else if (passNumber == 2) checkResources();
	}
}

function convertUTF8ToUTF16(utf8str)
{
	var i,byte1,byte2,byte3,byte4,codepoint,utf16str;

	/* Convert UTF-8 string to Javascript UTF-16 string */
	/* Each codepoint in UTF-8 string comprises one to four 8-bit values */
	/* Each codepoint in UTF-16 string comprises one or two 16-bit values */

	i = 0;
	utf16str = "";

	while (i < utf8str.length)
	{
		byte1 = utf8str.charCodeAt(i++);

		if ((byte1 & 0x80) == 0x00)
		{
			utf16str += String.fromCharCode(byte1);  /* one 16-bit value */
		}
		else if ((byte1 & 0xE0) == 0xC0)
		{
			byte2 = utf8str.charCodeAt(i++);

			codepoint = ((byte1 & 0x1F) << 6) + (byte2 & 0x3F);

			utf16str += String.fromCodePoint(codepoint);  /* one 16-bit value */
		}
		else if ((byte1 & 0xF0) == 0xE0)
		{
			byte2 = utf8str.charCodeAt(i++);
			byte3 = utf8str.charCodeAt(i++);

			codepoint = ((byte1 & 0x0F) << 12) + ((byte2 & 0x3F) << 6) + (byte3 & 0x3F);

			utf16str += String.fromCodePoint(codepoint);  /* one 16-bit value */
		}
		else if ((byte1 & 0xF8) == 0xF0)
		{
			byte2 = utf8str.charCodeAt(i++);
			byte3 = utf8str.charCodeAt(i++);
			byte4 = utf8str.charCodeAt(i++);

			codepoint = ((byte1 & 0x07) << 18) + ((byte2 & 0x3F) << 12) + ((byte3 & 0x3F) << 6) + (byte4 & 0x3F);

			utf16str += String.fromCodePoint(codepoint);  /* two 16-bit values */
		}
	}

	return utf16str;
}

/* After second pass - check resources */

function checkResources()
{
	var i,dataurisize,skipcount,failcount,count;
	var skipinflist = new Array();
	var skipurllist = new Array();
	var failinflist = new Array();
	var failurllist = new Array();
	/* Check for large resource sizes and failed resource loads */
	if (page_kind == 0)  /* not saved page */
	{
		dataurisize = 0;
		skipcount = 0;
		failcount = 0;
		for (i = 0; i < resource_location_array.length; i++)
		{
			if (resource_charset_array[i] == "")  /* charset not defined - binary data */
			{
				count = merge_css_images ? resource_remembered_array[i]-resource_cssremembered_array[i]+Object.keys(resource_cssframekeys_array[i]).length : resource_remembered_array[i];

				if (resource_content_array[i].length*count > max_resource_size*1024*1024)  /* skip large and/or repeated resource */
				{
					skipcount++;
					skipinflist.push((resource_content_array[i].length*count/(1024*1024)).toFixed(1) + " MB");
					try { skipurllist.push(decodeURIComponent(resource_location_array[i])); }
					catch (e) { skipurllist.push(resource_location_array[i]); }
				}
				else dataurisize += resource_content_array[i].length*count*(4/3);  /* base64 expands by 4/3 */
			}

			if (resource_status_array[i] == "failure")
			{
				if (root_icon_location != "" && resource_location_array[i] == root_icon_location && resource_reason_array[i] == "load:404"){
					root_icon_location = "";
					if (resource_remembered_array[i] == 1){
						resource_location_array.splice(i,1);
						resource_referer_array.splice(i,1);
						resource_mimetype_array.splice(i,1);
						resource_charset_array.splice(i,1);
						resource_passive_array.splice(i,1);
						resource_content_array.splice(i,1);
						resource_status_array.splice(i,1);
						resource_reason_array.splice(i,1);
						resource_remembered_array.splice(i,1);
						resource_replaced_array.splice(i,1);
						resource_cssremembered_array.splice(i,1);
						resource_cssframekeys_array.splice(i,1);
						i--;
					}else{
						resource_remembered_array[i]--;
					}
				}
			}
		}

		if (dataurisize > maxTotalSize*1024*1024)
		{
			showMessage("Total size of resources is too large","Save",
			"Cannot save page because the total size of resources exceeds " + maxTotalSize + "MB.\n\n" +
			"It may be possible to save this page by trying these suggestions:\n\n" +
			"    •  Save Basic Items.\n" +
			"    •  Save Custom Items with some items disabled.\n" +
			"    •  Reduce the 'Maximum size allowed for a resource' option value.",
			null,
			function savecancel()
			{
				chrome.runtime.sendMessage({ type: "saveExit" });
			});
		}
		else if (display_warnings && !(skip_warnings && multipleSaves))
		{
			if (skipcount > 0){
				showMessage("Some resources exceed maximum size","Save",
				skipcount + " of " + resource_location_array.length + " resources exceed maximum size allowed.\n\n" +
				"It may be possible to save these resources by trying these suggestions:\n\n" +
				"    •  Increase the 'Maximum size allowed for a resource' option value.",
				function savecontinue(){
					if (failcount > 0){
						someResourcesNotLoaded();
					}else if (display_resources){
						showUnsavedResources();
					}else{
						finalize_blob();
					}
				},
				function savecancel(){
					chrome.runtime.sendMessage({ type: "saveExit" });
				});
			}else if (failcount > 0){
				someResourcesNotLoaded();
			}else{
				finalize_blob();
			}
		}
		else if (display_resources && !(skip_warnings && multipleSaves))
		{
			if (skipcount > 0 || failcount > 0) showUnsavedResources();
			else finalize_blob();
		}
		else finalize_blob();
	}
	else finalize_blob();

	function someResourcesNotLoaded(){
		finalize_blob();
		/*
		showMessage("Some resources could not be loaded","Save",
		failcount + " of " + resource_location_array.length + " resources could not be loaded.\n\n" +
		"It may be possible to load these resources by trying these suggestions:\n\n" +
		"    •  Scroll to the bottom of the page before saving.\n" +
		"    •  Use normal browsing instead of private browsing.\n" +
		"    •  Disable any ad blockers or inline style editors.\n",
		function savecontinue()
		{
			if (display_resources) showUnsavedResources();
			else finalize_blob();
		},
		function savecancel()
		{
			chrome.runtime.sendMessage({ type: "saveExit" });
		});
		*/
	}

	function showUnsavedResources()
	{
		var i,xhr,parser,unsaveddoc,container,div;

		/* Load unsaved resources panel */

		xhr = new XMLHttpRequest();
		xhr.open("GET",chrome.runtime.getURL("/html/error.html"),true);
		xhr.onload = complete;
		xhr.send();

		function complete()
		{
			if (xhr.status == 200)
			{
				/* Parse unsaved resources document */

				parser = new DOMParser();
				unsaveddoc = parser.parseFromString(xhr.responseText,"text/html");

				/* Create container element */

				container = document.createElement("div");
				container.setAttribute("id","dara-unsaved-panel-container");
				document.documentElement.appendChild(container);

				/* Append unsaved resources elements */

				container.appendChild(unsaveddoc.getElementById("dara-unsaved-panel-style"));
				container.appendChild(unsaveddoc.getElementById("dara-unsaved-panel-overlay"));

				/* Add listeners for buttons */

				document.getElementById("dara-unsaved-panel-continue").addEventListener("click",clickContinueOne,false);
				document.getElementById("dara-unsaved-panel-cancel").addEventListener("click",clickCancel,false);

				/* Focus continue button */

				document.getElementById("dara-unsaved-panel-continue").focus();

				/* Populate skipped resources */

				if (skipurllist.length > 0)
				{
					document.getElementById("dara-unsaved-panel-header").textContent = "Resources that exceed maximum size";

					for (i = 0; i < skipurllist.length; i++)
					{
						div = document.createElement("div");
						div.textContent = (i+1);
						document.getElementById("dara-unsaved-panel-nums").appendChild(div);

						div = document.createElement("div");
						div.textContent = skipinflist[i];
						document.getElementById("dara-unsaved-panel-infs").appendChild(div);

						div = document.createElement("div");
						div.textContent = skipurllist[i];
						document.getElementById("dara-unsaved-panel-urls").appendChild(div);
					}

					/* Select this tab */

					chrome.runtime.sendMessage({ type: "selectTab" });
				}
				else clickContinueOne();
			}
		}

		function clickContinueOne()
		{
			var i,div;

			/* Remove skipped resources */

			if (skipurllist.length > 0)
			{
				for (i = 0; i < skipurllist.length; i++)
				{
					document.getElementById("dara-unsaved-panel-nums").removeChild(document.getElementById("dara-unsaved-panel-nums").children[0]);
					document.getElementById("dara-unsaved-panel-infs").removeChild(document.getElementById("dara-unsaved-panel-infs").children[0]);
					document.getElementById("dara-unsaved-panel-urls").removeChild(document.getElementById("dara-unsaved-panel-urls").children[0]);
				}

				skipurllist.length = 0;
			}

			/* Change listener for continue button */

			document.getElementById("dara-unsaved-panel-continue").removeEventListener("click",clickContinueOne,false);
			document.getElementById("dara-unsaved-panel-continue").addEventListener("click",clickContinueTwo,false);

			/* Change text alignment of information column */

			document.getElementById("dara-unsaved-panel-infs").style.setProperty("text-align","left","important");

			/* Populate failed resources */

			if (failurllist.length > 0)
			{
				document.getElementById("dara-unsaved-panel-header").textContent = "Resources that could not be loaded";

				for (i = 0; i < failurllist.length; i++)
				{
					div = document.createElement("div");
					div.textContent = (i+1);
					document.getElementById("dara-unsaved-panel-nums").appendChild(div);

					div = document.createElement("div");
					div.textContent = failinflist[i];
					document.getElementById("dara-unsaved-panel-infs").appendChild(div);

					div = document.createElement("div");
					div.textContent = failurllist[i];
					document.getElementById("dara-unsaved-panel-urls").appendChild(div);
				}

				failurllist.length = 0;

				/* Select this tab */

				chrome.runtime.sendMessage({ type: "selectTab" });
			}
			else clickContinueTwo();
		}

		function clickContinueTwo()
		{
			document.documentElement.removeChild(document.getElementById("dara-unsaved-panel-container"));

			finalize_blob();
		}

		function clickCancel()
		{
			document.documentElement.removeChild(document.getElementById("dara-unsaved-panel-container"));
			chrome.runtime.sendMessage({ type: "saveExit" });
		}
	}
}

function finalize_blob(){
	chrome.runtime.sendMessage({ type: "delay", milliseconds: 10 },
	function(object){
		generateHTML();
	});
}

function getSavedFileName(url,title,extract)
{
    var i,documentURL,host,hostw,path,pathw,file,filew,query,fragment,date,datestr,pubelem,pubstr,pubdate,pubdatestr,filename,regex,minlength;
    var pubmatches = new Array();
    var mediaextns = new Array( ".jpe",".jpg",".jpeg",".gif",".png",".bmp",".ico",".svg",".svgz",".tif",".tiff",".ai",".drw",".pct",".psp",".xcf",".psd",".raw",".webp",  /* Firefox image extensions */
                                ".aac",".aif",".flac",".iff",".m4a",".m4b",".mid",".midi",".mp3",".mpa",".mpc",".oga",".ogg",".ra",".ram",".snd",".wav",".wma",  /* Firefox audio extensions */
                                ".avi",".divx",".flv",".m4v",".mkv",".mov",".mp4",".mpeg",".mpg",".ogm",".ogv",".ogx",".rm",".rmvb",".smil",".webm",".wmv",".xvid");  /* Firefox video extensions */
    
    documentURL = new URL(url);
    
    host = documentURL.hostname;
    host = decodeURIComponent(host);
    host = sanitizeString(host);
    
    hostw = host.replace(/^www\./,"");
    
    path = documentURL.pathname;
    path = decodeURIComponent(path);
    path = sanitizeString(path);
    path = path.replace(/^\/|\/$/g,"");
    
    pathw = path.replace(/\.[^.\/]+$/,"");
    
    file = path.replace(/[^\/]*\//g,"");
    
    filew = file.replace(/\.[^.]+$/,"");
    
    query = documentURL.search.substr(1);
    
    fragment = documentURL.hash.substr(1);
    
    title = sanitizeString(title);
    title = title.trim();
    if (title == "") title = file;
    
    date = new Date();
    datestr = new Date(date.getTime()-(date.getTimezoneOffset()*60000)).toISOString();
    
    if ((pubelem = document.querySelector("meta[property='article:published_time'][content]")) != null) pubstr = pubelem.getAttribute("content");  /* Open Graph - ISO8601 */
    else if ((pubelem = document.querySelector("meta[property='datePublished'][content]")) != null) pubstr = pubelem.getAttribute("content");  /* Generic RDFa - ISO8601 */
    else if ((pubelem = document.querySelector("meta[itemprop='datePublished'][content]")) != null) pubstr = pubelem.getAttribute("content");  /* Microdata - ISO8601 */
    else if ((pubelem = document.querySelector("script[type='application/ld+json']")) != null)  /* JSON-LD - ISO8601 */
    {
        pubmatches = pubelem.textContent.match(/"datePublished"\s*:\s*"([^"]*)"/);
        pubstr = pubmatches ? pubmatches[1] : null;
    }
    else if ((pubelem = document.querySelector("time[datetime]")) != null) pubstr = pubelem.getAttribute("datetime");  /* HTML5 - ISO8601 and similar formats */
    else pubstr = null;
    
    try 
    {
        if (!pubstr) throw false;
        pubstr = pubstr.replace(/(Z|(-|\+)\d\d:?\d\d)$/,"");  /* remove timezone */
        pubdate = new Date(pubstr);
        pubdatestr = new Date(pubdate.getTime()-(pubdate.getTimezoneOffset()*60000)).toISOString();
    }
    catch (e) { 
			pubdatestr = ""; 
		}
    
    filename = title;
    
    regex = /(%TITLE%|%DATE\((.?)\)%|%TIME\((.?)\)%|%DATEP\((.?)\)%|%TIMEP\((.?)\)%|%DATEPF\((.?)\)%|%TIMEPF\((.?)\)%|%HOST%|%HOSTW%|%PATH%|%PATHW%|%FILE%|%FILEW%|%QUERY\(([^)]*)\)%|%FRAGMENT%)/g;
    
    minlength = filename.replace(regex,"").length;
    
    filename = filename.replace(regex,_replacePredefinedFields);
    
    function _replacePredefinedFields(match,p1,p2,p3,p4,p5,p6,p7,p8,offset,string)
    {
        var date,time,value;
        var params = new Object();
        
        if (p1 == "%TITLE%") return _truncateField(p1,title);
        else if (p1.substr(0,6) == "%DATE(" && p1.substr(-2) == ")%")
        {
            date = datestr.substr(0,10).replace(/-/g,p2);
            return _truncateField(p1,date);
        }
        else if (p1.substr(0,6) == "%TIME(" && p1.substr(-2) == ")%")
        {
            time = datestr.substr(11,8).replace(/:/g,p3);
            return _truncateField(p1,time);
        }
        else if (p1.substr(0,7) == "%DATEP(" && p1.substr(-2) == ")%")
        {
            date = pubdatestr.substr(0,10).replace(/-/g,p4);
            return _truncateField(p1,date);
        }
        else if (p1.substr(0,7) == "%TIMEP(" && p1.substr(-2) == ")%")
        {
            time = pubdatestr.substr(11,8).replace(/:/g,p5);
            return _truncateField(p1,time);
        }
        else if (p1.substr(0,8) == "%DATEPF(" && p1.substr(-2) == ")%")
        {
            date = (pubdatestr != "") ? pubdatestr.substr(0,10).replace(/-/g,p6) : datestr.substr(0,10).replace(/-/g,p6);
            return _truncateField(p1,date);
        }
        else if (p1.substr(0,8) == "%TIMEPF(" && p1.substr(-2) == ")%")
        {
            time = (pubdatestr != "") ? pubdatestr.substr(11,8).replace(/:/g,p7) : datestr.substr(11,8).replace(/:/g,p7);
            return _truncateField(p1,time);
        }
        else if (p1 == "%HOST%") return _truncateField(p1,host);
        else if (p1 == "%HOSTW%") return _truncateField(p1,hostw);
        else if (p1 == "%FILE%") return _truncateField(p1,file);
        else if (p1 == "%FILEW%") return _truncateField(p1,filew);
        else if (p1 == "%PATH%") return _truncateField(p1,path);
        else if (p1 == "%PATHW%") return _truncateField(p1,pathw);
        else if (p1.substr(0,7) == "%QUERY(" && p1.substr(-2) == ")%")
        {
            if (p8 == "") return _truncateField(p1,query);
            params = new URLSearchParams(query);
            value = params.get(p8);
            if (value == null) value = "";
            return _truncateField(p1,value);
        }
        else if (p1 == "%FRAGMENT%") return _truncateField(p1,fragment);
    }
    
    function _truncateField(field,repstr)
    {
        var maxextnlength = 6;
        
        if (repstr.length > maxFileNameLength-maxextnlength-minlength) repstr = repstr.substr(0,maxFileNameLength-maxextnlength-minlength);
        
        minlength += repstr.length;
        
        return repstr;
    }
    
    if (!extract)
    {
        if (filename == "") filename = "html";
        
        if (filename.substr(-4) != ".htm" && filename.substr(-5) != ".html" &&
            filename.substr(-6) != ".shtml" && filename.substr(-6) != ".xhtml") filename += ".html";  /* Firefox HTML extensions */
    }
    else
    {
        if (filename == "") filename = "media";
        
        for (i = 0; i < mediaextns.length; i++)
        {
            if (file.substr(-mediaextns[i].length) == mediaextns[i] &&
                filename.substr(-mediaextns[i].length) != mediaextns[i]) filename += mediaextns[i];
        }
    }

    filename = filename.replace(/(\\|\/|:|\*|\?|"|<|>|\|)/g,"_");
		//chrome.runtime.sendMessage({ method: "consoleLog", message: filename });
    //if (replaceSpaces) filename = filename.replace(/\s/g,replaceChar);
    //filename = filename.trim();
    return filename;
}

/* Third Pass - to generate HTML and save to file */

function epoch (date) {
  return Date.parse(date)
}

function generateHTML(){
	var i,j,totalscans,totalloads,maxstrsize,totalstrsize,count,mimetype,charset,pageurl,htmlString,htmlIndex,filename,htmlBlob,objectURL,link;
	passNumber = 3;
	chrome.runtime.sendMessage({ type: "setSaveState", savestate: 3 });
	timeStart[3] = performance.now();
	extractHTML(0,window,document.documentElement,false,false,"0",0,0);
	timeFinish[3] = performance.now();
	frame_key_array.length = 0;
	frame_url_array.length = 0;
	frame_html_array.length = 0;
	frame_fonts_array.length = 0;
	resource_location_array.length = 0;
	resource_referer_array.length = 0;
	resource_mimetype_array.length = 0;
	resource_charset_array.length = 0;
	resource_passive_array.length = 0;
	resource_content_array.length = 0;
	resource_status_array.length = 0;
	resource_reason_array.length = 0;
	resource_remembered_array.length = 0;
	resource_replaced_array.length = 0;
	resource_cssremembered_array.length = 0;
	resource_cssframekeys_array.length = 0;
	first_icon_location = "";
	root_icon_location = "";
	enteredComments = "";
	if (cancelSave){
		htmlStrings.length = 0;
		chrome.runtime.sendMessage({ type: "saveExit" });
	}else{
		pageurl = document.URL;
		htmlBlob = new Blob(htmlStrings, { type : "text/html" });
		filename = getSavedFileName(pageurl,document.title,true);
		const dateToday = new Date();
		const timestamp = epoch(dateToday);
		chrome.runtime.sendMessage({method: 'uploadBlob', htmlstrings: htmlStrings, filename: filename, pageurl: pageurl, uploaded: timestamp});
		objectURL = window.URL.createObjectURL(htmlBlob);
		htmlBlob = null;
		htmlStrings.length = 0;
		chrome.runtime.sendMessage({ type: "delay", milliseconds: 100 },  /* allow time before revoking object URL */
		function(object){
			window.URL.revokeObjectURL(objectURL);
			chrome.runtime.sendMessage({ type: "setSaveState", savestate: -2 });
			chrome.runtime.sendMessage({ type: "saveDone" });
		});
	}
}

function extractHTML(depth,frame,element,crossframe,nosrcframe,framekey,parentpreserve,indent)
{
	var i,j,startTag,textContent,endTag,inline,preserve,style,display,position,whitespace,displayed,csstext,baseuri,separator,origurl,datauri,origstr,dupelem,dupsheet,location,newurl;
	var visible,width,height,currentsrc,svgstr,parser,svgdoc,svgfrag,svgelem,subframekey,startindex,endindex,htmltext,origsrcdoc,origsandbox,framedoc,prefix,shadowroot;
	var doctype,target,text,asciistring,date,datestr,pubelem,pubstr,pubzone,pubdate,pubdatestr,pageurl,state;
	var pubmatches = new Array();
	var metadataElements = new Array("base","link","meta","noscript","script","style","template","title");  /* HTML Living Standard 3.2.5.2.1 Metadata Content */
	var voidElements = new Array("area","base","br","col","command","embed","frame","hr","img","input","keygen","link","menuitem","meta","param","source","track","wbr");  /* W3C HTML5 4.3 Elements + menuitem */
	var retainElements = new Array("html","head","body","base","command","link","meta","noscript","script","style","template","title");
	var hiddenElements = new Array("area","base","datalist","head","link","meta","param","rp","script","source","style","template","track","title");  /* W3C HTML5 10.3.1 Hidden Elements */

	startTag = "<" + element.localName;
	for (i = 0; i < element.attributes.length; i++)
	{
		if (element.attributes[i].name != "zoompage-fontsize")
		{
			startTag += " " + element.attributes[i].name;
			startTag += "=\"";
			startTag += element.attributes[i].value.replace(/"/g,"&quot;");
			startTag += "\"";
		}
	}
	if (element.parentElement != null && element.parentElement.localName == "head" && metadataElements.indexOf(element.localName) < 0)
	{
		/* Non-metadata element in head will be moved to body when saved page is opened */
		/* Add hidden attribute to keep element hidden */

		startTag += " data-dara-nonmetadata=\"\" hidden=\"\"";
	}
	startTag += ">";

	textContent = "";

	if (voidElements.indexOf(element.localName) >= 0) endTag = "";
	else endTag = "</" + element.localName + ">";

	/* Determine if element is phrasing content - set inline based on CSS display value */

	/* Determine if element format should be preserved - set preserve based on CSS white-space value */
	/*   0 = collapse newlines, collapse spaces (normal or nowrap) */
	/*   1 = preserve newlines, collapse spaces (pre-line)         */
	/*   2 = preserve newlines, preserve spaces (pre or pre-wrap)  */

	if (page_kind == 0 && format_html && depth == 0)
	{
		if (crossframe)
		{
			/* In a cross-origin frame, the document created by DOMParser */
			/* does not have an associated frame window, which means that */
			/* the window.getComputedStyle() function cannot be called.   */

			/* Assume all elements are block with collapsed newlines and spaces */

			inline = false;
			preserve = 0;
		}
		else if ((style = frame.getComputedStyle(element)) == null)  /* should not happen */
		{
			inline = false;
			preserve = 0;
		}
		else
		{
			display = style.getPropertyValue("display");
			position = style.getPropertyValue("position");
			whitespace = style.getPropertyValue("white-space");

			if (display.indexOf("inline") >= 0 || (display == "none" && document.body.contains(element))) inline = true;
			else if (position == "absolute" || position == "fixed") inline = true;
			else inline = false;

			if (whitespace == "pre" || whitespace == "pre-wrap") preserve = 2;
			else if (whitespace == "pre-line") preserve = 1;
			else /* normal or nowrap */ preserve = 0;
		}
	}
	else
	{
		inline = false;
		preserve = 0;
	}

	/* Determine if element is displayed */

	if (crossframe)
	{
		/* In a cross-origin frame, the document created by DOMParser */
		/* does not have an associated frame window, which means that */
		/* the window.getComputedStyle() function cannot be called.   */

		/* Assume all elements are displayed */

		displayed = true;
	}
	else if ((style = frame.getComputedStyle(element)) == null) displayed = true;  /* should not happen */
	else displayed = (style.getPropertyValue("display") != "none");  /* element not collapsed */

	/* Extract HTML from DOM and replace external resources with data URI's */

	/* External images referenced in any element's style attribute */

	if (element.hasAttribute("style"))
	{
		csstext = element.getAttribute("style");

		baseuri = element.ownerDocument.baseURI;

		if (is_firefox) csstext = enumerateCSSInsetProperty(csstext);

		csstext = replaceCSSImageURLs(csstext,baseuri,framekey);

		startTag = startTag.replace(/ style="(?:\\"|[^"])*"/," style=\"" + csstext.replace(/"/g,"&quot;") + "\"");
	}

	/* Remove or Rehide elements */

	if (remove_elements)
	{
		/* Remove elements that have been collapsed by the page, page editors or content blockers - so are not displayed */
		/* Do not remove elements that are essential */
		/* Do not remove <svg> elements because child elements may be referenced by <use> elements in other <svg> elements */

		if (retainElements.indexOf(element.localName) < 0 && !(element instanceof SVGElement) && !displayed)
		{
			htmlStrings[htmlStrings.length] = "<!--dara-" + element.localName + "-remove-->";

			return;
		}
	}
	else if (hide_elements)
	{
		/* Rehide elements that have been collapsed by the page, page editors or content blockers - so are not displayed */
		/* Do not hide elements that are hidden by default */

		if (hiddenElements.indexOf(element.localName) < 0 && !displayed)
		{
			csstext = "/*dara-rehide*/ display: none !important;";

			if (element.hasAttribute("style"))
			{
				if (element.getAttribute("style").trim().substr(-1) != ";") separator = "; ";
				else separator = " ";

				startTag = startTag.replace(/ style="(?:\\"|[^"])*"/," style=\"" + element.getAttribute("style").replace(/"/g,"&quot;") + separator + csstext + "\"");
			}
			else startTag = startTag.replace("<" + element.localName,"<" + element.localName + " style=\"" + csstext + "\"");
		}
	}

	/* Content Security Policy in <meta> element */

	if (element.localName == "meta")
	{
		if (element.httpEquiv.toLowerCase() == "content-security-policy")
		{
			origstr = " data-dara-content=\"" + element.content + "\"";

			startTag = startTag.replace(/ content="(?:\\"|[^"])*"/,origstr + " content=\"\"");
		}
	}

	/* External script referenced in <script> element */
	/* Internal script in <script> element */

	else if (element.localName == "script")
	{
		if ((saved_items == 2 && save_scripts) && !crossframe && !nosrcframe)
		{
			if (element.getAttribute("src"))  /* external script */
			{
				if (replaceableResourceURL(element.src))
				{
					baseuri = element.ownerDocument.baseURI;

					origurl = element.getAttribute("src");

					datauri = replaceURL(origurl,baseuri);

					origstr = (datauri == origurl) ? "" : " data-dara-src=\"" + origurl + "\"";

					startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
				}
			}
			else  /* internal script */
			{
				textContent = element.textContent;
			}
			if (element.hasAttribute("type")) origstr = " data-dara-type=\"" + element.getAttribute("type") + "\"";
			else origstr = " data-dara-type=\"\"";

			if (element.hasAttribute("type")) startTag = startTag.replace(/ type="[^"]*"/,origstr + " type=\"text/plain\"");
			else startTag = startTag.replace(/<script/,"<script" + origstr + " type=\"text/plain\"");
		}
		else
		{
			if (element.getAttribute("src"))  /* external script */
			{
				origurl = element.getAttribute("src");

				origstr = " data-dara-src=\"" + origurl + "\"";

				startTag = startTag.replace(/ src="[^"]*"/,origstr + "");  /* replacing with src="" would be invalid HTML */
			}
		}
	}

	/* External images or fonts referenced in <style> element */

	else if (element.localName == "style")
	{
		if (element.id == "zoompage-pageload-style" || element.id == "zoompage-zoomlevel-style" || element.id == "zoompage-fontsize-style")  /* Zoom Page WE */
		{
			startTag = "";
			endTag = "";
			textContent = "";
		}
		else if (element.hasAttribute("class") && element.getAttribute("class").indexOf("darkreader") >= 0)  /* Dark Reader*/
		{
			startTag = "";
			endTag = "";
			textContent = "";
		}
		else
		{
			if (!element.disabled)
			{
				if (element.hasAttribute("data-dara-sheetrules"))
				{
					csstext = element.getAttribute("data-dara-sheetrules");

					startTag = startTag.replace(/ data-dara-sheetrules="(?:\\"|[^"])*"/," data-dara-sheetrules=\"\"");
				}
				else
				{
					try
					{
						/* Count rules in element.textContent by creating duplicate element */

						dupelem = element.ownerDocument.createElement("style");
						dupelem.textContent = element.textContent;
						element.ownerDocument.body.appendChild(dupelem);
						dupsheet = dupelem.sheet;
						dupelem.remove();

						/* There may be rules in element.sheet.cssRules that are not in element.textContent */
						/* For example if the page uses CSS-in-JS Libraries */

						if (dupsheet.cssRules.length != element.sheet.cssRules.length)
						{
							csstext = "";

							for (i = 0; i < element.sheet.cssRules.length; i++)
							csstext += element.sheet.cssRules[i].cssText + "\n";

							startTag = startTag.replace(/<style/,"<style data-dara-sheetrules=\"\"");
						}
						else csstext = element.textContent;
					}
					catch (e)  /* sheet.cssRules does not exist or cross-origin style sheet */
					{
						csstext = element.textContent;
					}
				}

				baseuri = element.ownerDocument.baseURI;

				if (is_firefox) csstext = enumerateCSSInsetProperty(csstext);

				textContent = replaceCSSURLsInStyleSheet(csstext,baseuri,[],framekey);

			}
			else
			{
				startTag = startTag.replace(/<style/,"<style data-dara-disabled=\"\"");

				textContent = "";
			}
		}
	}

	/* External images or fonts referenced in <link> element */
	/* External icon referenced in <link> element */

	else if (element.localName == "link" && !(element.parentElement instanceof SVGElement))  /* <link> is invalid inside <svg> */
	{
		if (element.rel.toLowerCase().indexOf("stylesheet") >= 0 && element.getAttribute("href"))
		{
			if (!element.disabled)
			{
				if (replaceableResourceURL(element.href))
				{
					baseuri = element.ownerDocument.baseURI;

					if (baseuri != null)
					{
						location = resolveURL(element.href,baseuri);

						if (location != null)
						{
							location = removeFragment(location);

							for (i = 0; i < resource_location_array.length; i++)
							if (resource_location_array[i] == location && resource_status_array[i] == "success") break;

							if (i < resource_location_array.length)  /* style sheet found */
							{
								csstext = resource_content_array[i];

								/* Converting <link> into <style> means that CSS rules are embedded in saved HTML file */
								/* Therefore need to escape any </style> end tags that may appear inside CSS strings */

								csstext = csstext.replace(/<\/style>/gi,"<\\/style>");

								baseuri = element.href;

								textContent = replaceCSSURLsInStyleSheet(csstext,baseuri,[location],framekey);

								startTag = "<style data-dara-href=\"" + element.getAttribute("href") + "\"";
								if (element.type != "") startTag += " type=\"" + element.type + "\"";
								if (element.media != "") startTag += " media=\"" + element.media + "\"";
								startTag += ">";
								endTag = "</style>";

								resource_replaced_array[i]++;
							}
						}
					}
				}
			}
			else
			{
				origurl = element.getAttribute("href");

				origstr = " data-dara-href=\"" + origurl + "\"";

				startTag = startTag.replace(/<link/,"<link data-dara-disabled=\"\"");
				startTag = startTag.replace(/ href="[^"]*"/,origstr + " href=\"\"");
			}
		}
		else if ((element.rel.toLowerCase() == "icon" || element.rel.toLowerCase() == "shortcut icon") && element.getAttribute("href"))
		{
			if (replaceableResourceURL(element.href))
			{
				baseuri = element.ownerDocument.baseURI;

				origurl = element.getAttribute("href");

				datauri = replaceURL(origurl,baseuri);

				origstr = (datauri == origurl) ? "" : " data-dara-href=\"" + origurl + "\"";

				startTag = startTag.replace(/ href="[^"]*"/,origstr + " href=\"" + datauri + "\"");
			}
		}
		else if (element.rel.toLowerCase().indexOf("dns-prefetch") >= 0 || element.rel.toLowerCase().indexOf("preconnect") >= 0 ||
		element.rel.toLowerCase().indexOf("prefetch") >= 0 || element.rel.toLowerCase().indexOf("preload") >= 0 ||
		element.rel.toLowerCase().indexOf("prerender") >= 0)
		{
			origurl = element.getAttribute("href");

			origstr = " data-dara-href=\"" + origurl + "\"";

			startTag = startTag.replace(/ href="[^"]*"/,origstr + " href=\"\"");
		}
		else  /* unsaved url */
		{
			baseuri = element.ownerDocument.baseURI;

			origurl = element.getAttribute("href");

			newurl = unsavedURL(origurl,baseuri);

			origstr = (newurl == origurl) ? "" : " data-dara-href=\"" + origurl + "\"";

			startTag = startTag.replace(/ href="[^"]*"/,origstr + " href=\"" + newurl + "\"");
		}
	}
	else if (element.localName == "link" && (element.parentElement instanceof SVGElement))
	{
		/* Workaround for <link> element inside <svg> fragment which is invalid */

		startTag = "";
		endTag = "";
	}

	/* External location referenced in <a> or <area> element */
	/* Internal location referenced in <a> or <area> element */

	else if ((element.localName == "a" && element instanceof HTMLElement) || element.localName == "area")
	{
		if (element.getAttribute("href"))
		{
			baseuri = element.ownerDocument.baseURI;

			origurl = element.getAttribute("href");

			newurl = adjustURL(origurl,baseuri);

			if (newurl != origurl)
			{
				origstr = " data-dara-href=\"" + origurl + "\"";

				startTag = startTag.replace(/ href="[^"]*"/,origstr + " href=\"" + newurl + "\"");
			}
		}
	}

	/* External image referenced in <body> element */

	else if (element.localName == "body")
	{
		if (element.getAttribute("background"))
		{
			if (replaceableResourceURL(element.background))
			{
				baseuri = element.ownerDocument.baseURI;

				origurl = element.getAttribute("background");

				datauri = replaceURL(origurl,baseuri);

				origstr = (datauri == origurl) ? "" : " data-dara-background=\"" + origurl + "\"";

				startTag = startTag.replace(/ background="[^"]*"/,origstr + " background=\"" + datauri + "\"");
			}
		}
	}

	/* External image referenced in <img> element - can be inside <picture> element */

	else if (element.localName == "img")
	{
		/* Remove src/srcset of images that have been hidden by the page, page editors or content blockers - so are not visible */

		if (remove_elements)
		{
			if (crossframe)
			{
				/* In a cross-origin frame, the document created by DOMParser */
				/* does not have an associated frame window, which means that */
				/* the window.getComputedStyle() function cannot be called.   */

				/* Assume all images are visible */

				visible = true;
			}
			else if ((style = frame.getComputedStyle(element)) == null) visible = true;  /* should not happen */
			else visible = (style.getPropertyValue("visibility") != "hidden" && style.getPropertyValue("opacity") != "0");  /* element hidden */
		}
		else visible = true;

		if (!visible)
		{
			width = style.getPropertyValue("width");
			height = style.getPropertyValue("height");

			csstext = "/*dara-remove*/ width: " + width + " !important; height: " + height + " !important;";

			if (element.hasAttribute("style"))
			{
				if (element.getAttribute("style").trim().substr(-1) != ";") separator = "; ";
				else separator = " ";

				startTag = startTag.replace(/ style="(?:\\"|[^"])*"/," style=\"" + element.getAttribute("style").replace(/"/g,"&quot;") + separator + csstext + "\"");
			}
			else startTag = startTag.replace(/<img/,"<img style=\"" + csstext + "\"");

			startTag = startTag.replace(/ src="[^"]*"/,"");

			startTag = startTag.replace(/ srcset="[^"]*"/,"");
		}
		else
		{
			/* currentSrc is set from src or srcset attributes on this <img> element */
			/* or from srcset attribute on <source> element inside <picture> element */

			/* Firefox - workaround because element.currentSrc may be empty string in cross-origin frames */

			currentsrc = (element.currentSrc != "") ? element.currentSrc : (element.getAttribute("src") ? element.src : "");

			if (currentsrc != "")  /* currentSrc set from src or srcset attribute */
			{
				if (replaceableResourceURL(currentsrc))
				{
					baseuri = element.ownerDocument.baseURI;

					origurl = element.getAttribute("src");

					datauri = replaceURL(currentsrc,baseuri);

					origstr = (currentsrc == origurl) ? "" : " data-dara-currentsrc=\"" + currentsrc + "\"";
					origstr += " data-dara-src=\"" + origurl + "\"";

					if (element.hasAttribute("src")) startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
					else startTag = startTag.replace(/<img/,"<img" + origstr + " src=\"" + datauri + "\"");
				}
				else if (currentsrc.substr(0,5).toLowerCase() == "data:")  /* data uri */
				{
					origurl = element.getAttribute("src");

					datauri = currentsrc;

					origstr = (datauri == origurl) ? " " : " data-dara-src=\"" + origurl + "\"";

					if (element.hasAttribute("src")) startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
					else startTag = startTag.replace(/<img/,"<img" + origstr + " src=\"" + datauri + "\"");
				}
				else if (element.hasAttribute("data-dara-blobdatauri") || currentsrc.substr(0,5) == "blob:")  /* blob url */
				{
					baseuri = element.ownerDocument.baseURI;

					origurl = element.getAttribute("src");

					if (element.hasAttribute("data-dara-blobdatauri")) datauri = element.getAttribute("data-dara-blobdatauri");
					else datauri = createCanvasDataURL(currentsrc,baseuri,element);

					origstr = (currentsrc == origurl) ? "" : " data-dara-currentsrc=\"" + currentsrc + "\"";
					origstr += " data-dara-src=\"" + origurl + "\"";

					if (element.hasAttribute("src")) startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
					else startTag = startTag.replace(/<img/,"<img" + origstr + " src=\"" + datauri + "\"");

					startTag = startTag.replace(/ data-dara-blobdatauri="[^"]*"/,"");
				}
			}

			if (element.getAttribute("srcset"))
			{
				/* Remove srcset URLs - currentSrc may be set to one of these URLs - other URls are unsaved */

				origurl = element.getAttribute("srcset");

				origstr = " data-dara-srcset=\"" + origurl + "\"";

				startTag = startTag.replace(/ srcset="[^"]*"/,origstr + " srcset=\"\"");
			}
		}
	}

	/* External image referenced in <input> element */
	/* Reinstate checked state or text value of <input> element */

	else if (element.localName == "input")
	{
		if (element.type.toLowerCase() == "image" && element.getAttribute("src"))
		{
			if (replaceableResourceURL(element.src))
			{
				baseuri = element.ownerDocument.baseURI;

				origurl = element.getAttribute("src");

				datauri = replaceURL(origurl,baseuri);

				origstr = (datauri == origurl) ? "" : " data-dara-src=\"" + origurl + "\"";

				startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
			}
		}

		if (element.type.toLowerCase() == "file" || element.type.toLowerCase() == "password")
		{
			/* maintain security */

			if (element.hasAttribute("value")) startTag = startTag.replace(/ value="[^"]*"/," value=\"\"");
			else startTag = startTag.replace(/>$/," value=\"\">");
		}
		else if (element.type.toLowerCase() == "checkbox" || element.type.toLowerCase() == "radio")
		{
			if (!element.checked) startTag = startTag.replace(/ checked="[^"]*"/,"");
			else if (!element.hasAttribute("checked")) startTag = startTag.replace(/>$/," checked=\"\">");
		}
		else
		{
			if (element.hasAttribute("value")) startTag = startTag.replace(/ value="[^"]*"/," value=\"" + element.value + "\"");
			else startTag = startTag.replace(/>$/," value=\"" + element.value + "\">");
		}
	}

	/* Reinstate text value of <textarea> element */

	else if (element.localName == "textarea")
	{
		textContent = element.value;
	}

	/* Reinstate selected state of <option> element */

	else if (element.localName == "option")
	{
		if (element.selected) startTag = startTag.replace(/ selected="[^"]*"/," selected=\"\"");
		else startTag = startTag.replace(/ selected="[^"]*"/,"");
	}

	/* Graphics drawn within <canvas> element */

	else if (element.localName == "canvas")
	{
		try
		{
			datauri = element.toDataURL();

			csstext = "/*dara-canvas-image*/ " +
			"background-image: url(" + datauri + ") !important; " +
			"background-attachment: scroll !important; " +
			"background-blend-mode: normal !important; " +
			"background-clip: content-box !important; " +
			"background-color: transparent !important; " +
			"background-origin: content-box !important; " +
			"background-position: center center !important; " +
			"background-repeat: no-repeat !important; " +
			"background-size: 100% 100% !important;";
		}
		catch (e) { csstext = "/*dara-canvas-dirty*/"; }

		if (element.hasAttribute("style"))
		{
			if (element.getAttribute("style").trim().substr(-1) != ";") separator = "; ";
			else separator = " ";

			startTag = startTag.replace(/ style="(?:\\"|[^"])*"/," style=\"" + element.getAttribute("style").replace(/"/g,"&quot;") + separator + csstext + "\"");
		}
		else startTag = startTag.replace(/<canvas/,"<canvas style=\"" + csstext + "\"");
	}

	/* External audio referenced in <audio> element */

	else if (element.localName == "audio")
	{
		if (element.getAttribute("src"))
		{
			if (element.src == element.currentSrc)
			{
				if (replaceableResourceURL(element.src))
				{
					baseuri = element.ownerDocument.baseURI;

					origurl = element.getAttribute("src");

					datauri = replaceURL(origurl,baseuri);

					origstr = (datauri == origurl) ? "" : " data-dara-src=\"" + origurl + "\"";

					startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
				}
			}
			else  /* unsaved url */
			{
				baseuri = element.ownerDocument.baseURI;

				origurl = element.getAttribute("src");

				newurl = unsavedURL(origurl,baseuri);

				origstr = (newurl == origurl) ? "" : " data-dara-src=\"" + origurl + "\"";

				startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + newurl + "\"");
			}
		}
	}

	/* External video referenced in <video> element */

	else if (element.localName == "video")
	{
		if (element.getAttribute("src"))
		{
			if (element.src == element.currentSrc)
			{
				if (replaceableResourceURL(element.src))
				{
					baseuri = element.ownerDocument.baseURI;

					origurl = element.getAttribute("src");

					datauri = replaceURL(origurl,baseuri);

					origstr = (datauri == origurl) ? "" : " data-dara-src=\"" + origurl + "\"";

					startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
				}
			}
			else  /* unsaved url */
			{
				baseuri = element.ownerDocument.baseURI;

				origurl = element.getAttribute("src");

				newurl = unsavedURL(origurl,baseuri);

				origstr = (newurl == origurl) ? "" : " data-dara-src=\"" + origurl + "\"";

				startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + newurl + "\"");
			}
		}

		if (element.getAttribute("poster"))
		{
			if (replaceableResourceURL(element.poster))
			{
				baseuri = element.ownerDocument.baseURI;

				origurl = element.getAttribute("poster");

				datauri = replaceURL(origurl,baseuri);

				origstr = (datauri == origurl) ? "" : " data-dara-poster=\"" + origurl + "\"";

				startTag = startTag.replace(/ poster="[^"]*"/,origstr + " poster=\"" + datauri + "\"");
			}
		}
		else if (element.hasAttribute("data-dara-blobdatauri") || element.src.substr(0,5) == "blob:")
		{
			baseuri = element.ownerDocument.baseURI;

			origurl = element.getAttribute("src");

			if (element.hasAttribute("data-dara-blobdatauri")) datauri = element.getAttribute("data-dara-blobdatauri");
			else datauri = createCanvasDataURL(origurl,baseuri,element);

			origstr = (datauri == origurl) ? "" : " data-dara-poster=\"\"";

			startTag = startTag.replace(/<video/,"<video" + origstr + " poster=\"" + datauri + "\"");

			startTag = startTag.replace(/ data-dara-blobdatauri="[^"]*"/,"");
		}
	}

	/* External audio/video/image referenced in <source> element */

	else if (element.localName == "source")
	{
		if (element.parentElement)
		{
			if (element.parentElement.localName == "audio" || element.parentElement.localName == "video")
			{
				if (element.getAttribute("src"))
				{
					if (element.src == element.parentElement.currentSrc)
					{
						if (replaceableResourceURL(element.src))
						{
							baseuri = element.ownerDocument.baseURI;

							origurl = element.getAttribute("src");

							datauri = replaceURL(origurl,baseuri);

							origstr = (datauri == origurl) ? "" : " data-dara-src=\"" + origurl + "\"";

							startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
						}
					}
					else  /* unsaved url */
					{
						baseuri = element.ownerDocument.baseURI;

						origurl = element.getAttribute("src");

						newurl = unsavedURL(origurl,baseuri);

						origstr = (newurl == origurl) ? "" : " data-dara-src=\"" + origurl + "\"";

						startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + newurl + "\"");
					}
				}
			}
			else if (element.parentElement.localName == "picture")
			{
				/* Remove srcset URLs - currentSrc may be set to one of these URLs - other URls are unsaved */

				if (element.getAttribute("srcset"))
				{
					origurl = element.getAttribute("srcset");

					origstr = " data-dara-srcset=\"" + origurl + "\"";

					startTag = startTag.replace(/ srcset="[^"]*"/,origstr + " srcset=\"\"");
				}
			}
		}
	}

	/* External subtitles referenced in <track> element */

	else if (element.localName == "track")
	{
		if (element.getAttribute("src"))
		{
			if (replaceableResourceURL(element.src))
			{
				baseuri = element.ownerDocument.baseURI;

				origurl = element.getAttribute("src");

				datauri = replaceURL(origurl,baseuri);

				origstr = (datauri == origurl) ? "" : " data-dara-src=\"" + origurl + "\"";

				startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
			}
		}
	}

	/* External data referenced in <object> element */

	else if (element.localName == "object")
	{
		if (element.getAttribute("data"))
		{
			if (replaceableResourceURL(element.data))
			{
				baseuri = element.ownerDocument.baseURI;

				origurl = element.getAttribute("data");

				datauri = replaceURL(origurl,baseuri);

				origstr = (datauri == origurl) ? "" : " data-dara-data=\"" + origurl + "\"";

				startTag = startTag.replace(/ data="[^"]*"/,origstr + " data=\"" + datauri + "\"");
			}
		}
	}

	/* External data referenced in <embed> element */

	else if (element.localName == "embed")
	{
		if (element.getAttribute("src"))
		{
			if (replaceableResourceURL(element.src))
			{
				baseuri = element.ownerDocument.baseURI;

				origurl = element.getAttribute("src");

				datauri = replaceURL(origurl,baseuri);

				origstr = (datauri == origurl) ? "" : " data-dara-src=\"" + origurl + "\"";

				startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
			}
		}
	}

	/* SVG - External location referenced in <a> element */
	/* SVG - Internal location referenced in <a> element */

	else if (element.localName == "a" && element instanceof SVGElement)
	{
		if (element.getAttribute("href") || element.getAttribute("xlink:href"))
		{
			baseuri = element.ownerDocument.baseURI;

			origurl = element.getAttribute("href") || element.getAttribute("xlink:href");

			newurl = adjustURL(origurl,baseuri);

			if (newurl != origurl)
			{
				origstr = " data-dara-href=\"" + origurl + "\"";

				startTag = startTag.replace(/ (?:href|xlink:href)="[^"]*"/,origstr + " href=\"" + newurl + "\"");
			}
		}
	}

	/* SVG - External <symbol> element referenced in <use> element */
	/* SVG - Internal <symbol> element referenced in <use> element */

	else if (element.localName == "use")
	{
		if (element.getAttribute("href") || element.getAttribute("xlink:href"))
		{
			baseuri = element.ownerDocument.baseURI;

			origurl = element.getAttribute("href") || element.getAttribute("xlink:href");

			newurl = adjustURL(origurl,baseuri);

			if (newurl.substr(0,1) != "#")  /* not fragment only */
			{
				if (replaceableResourceURL(element.href.baseVal))
				{
					if (element.href.baseVal.indexOf("#") >= 0)  /* insert symbol */
					{
						svgstr = retrieveContent(origurl,baseuri);

						parser = new DOMParser();
						svgdoc = parser.parseFromString(svgstr,"text/html");

						svgfrag = element.href.baseVal.substr(element.href.baseVal.indexOf("#")+1);
						svgelem = svgdoc.getElementById(svgfrag);

						if (svgelem.localName == "symbol")
						{
							origstr = " data-dara-href=\"" + origurl + "\"";

							startTag = startTag.replace(/ (?:href|xlink:href)="[^"]*"/,origstr + " href=\"#" + svgfrag + "\"");

							endTag = endTag.replace(/>/,"><!--dara-symbol-insert-->" + svgelem.outerHTML);
						}
					}
				}
			}
			else  /* fragment only */
			{
				if (newurl != origurl)
				{
					origstr = " data-dara-href=\"" + origurl + "\"";

					startTag = startTag.replace(/ (?:href|xlink:href)="[^"]*"/,origstr + " href=\"" + newurl + "\"");
				}
			}
		}
	}

	/* SVG - External resource referenced in other SVG elements */
	/* SVG - Internal resource referenced in other SVG elements */

	else if (hrefSVGElements.indexOf(element.localName) >= 0 && element instanceof SVGElement)
	{
		if (element.getAttribute("href") || element.getAttribute("xlink:href"))
		{
			baseuri = element.ownerDocument.baseURI;

			origurl = element.getAttribute("href") || element.getAttribute("xlink:href");

			newurl = adjustURL(origurl,baseuri);

			if (newurl.substr(0,1) != "#")  /* not fragment only */
			{
				if (replaceableResourceURL(element.href.baseVal))
				{
					datauri = replaceURL(origurl,baseuri);

					origstr = (datauri == origurl) ? "" : " data-dara-href=\"" + origurl + "\"";

					startTag = startTag.replace(/ (?:href|xlink:href)="[^"]*"/,origstr + " href=\"" + datauri + "\"");
				}
			}
			else  /* fragment only */
			{
				if (newurl != origurl)
				{
					origstr = " data-dara-href=\"" + origurl + "\"";

					startTag = startTag.replace(/ (?:href|xlink:href)="[^"]*"/,origstr + " href=\"" + newurl + "\"");
				}
			}
		}
	}

	/* Handle nested frames and child elements & text nodes & comment nodes */
	/* Generate HTML into array of strings */

	if (element.localName == "iframe")  /* iframe elements */
	{
		if (page_kind == 0)
		{
			if (depth < max_frame_depth)
			{
				nosrcframe = nosrcframe || (!element.getAttribute("src") && !element.getAttribute("srcdoc"));

				subframekey = element.getAttribute("data-dara-key");

				try
				{
					if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before extracting */
					{
						startindex = htmlStrings.length;

						extractHTML(depth+1,element.contentWindow,element.contentDocument.documentElement,crossframe,nosrcframe,subframekey,preserve,indent+2);

						endindex = htmlStrings.length;

						htmltext = "";

						for (j = startindex; j < endindex; j++)
						{
							htmltext += htmlStrings[j];
							htmlStrings[j] = "";
						}

						htmltext = htmltext.replace(/&/g,"&amp;");
						htmltext = htmltext.replace(/"/g,"&quot;");

						if (page_kind == 0 && format_html && depth == 0)
						{
							htmltext = htmltext.replace(/\n/g,newlineIndent(indent+2));
							htmltext = newlineIndent(indent+2) + "<!--dara-srcdoc-begin-->" + newlineIndent(indent+2) + htmltext;
							htmltext += newlineIndent(indent+2) + "<!--dara-srcdoc-end-->";
						}

						startTag = startTag.replace(/<iframe/,"<iframe data-dara-sameorigin=\"\"");

						if (element.hasAttribute("srcdoc"))
						{
							origsrcdoc = element.getAttribute("srcdoc");

							origstr = " data-dara-srcdoc=\"" + origsrcdoc + "\"";

							startTag = startTag.replace(/ srcdoc="[^"]*"/,origstr + " srcdoc=\"" + htmltext + "\"");
						}
						else startTag = startTag.replace(/<iframe/,"<iframe srcdoc=\"" + htmltext + "\"");
					}
				}
				catch (e)  /* attempting cross-domain web page access */
				{
					for (i = 0; i < frame_key_array.length; i++)
					{
						if (frame_key_array[i] == subframekey) break;
					}

					if (i != frame_key_array.length)
					{
						parser = new DOMParser();
						framedoc = parser.parseFromString(frame_html_array[i],"text/html");

						startindex = htmlStrings.length;

						extractHTML(depth+1,null,framedoc.documentElement,true,nosrcframe,subframekey,preserve,indent+2);

						endindex = htmlStrings.length;

						htmltext = "";

						for (j = startindex; j < endindex; j++)
						{
							htmltext += htmlStrings[j];
							htmlStrings[j] = "";
						}

						htmltext = htmltext.replace(/&/g,"&amp;");
						htmltext = htmltext.replace(/"/g,"&quot;");

						if (page_kind == 0 && format_html && depth == 0)
						{
							htmltext = htmltext.replace(/\n/g,newlineIndent(indent+2));
							htmltext = newlineIndent(indent+2) + "<!--dara-srcdoc-begin-->" + newlineIndent(indent+2) + htmltext;
							htmltext += newlineIndent(indent+2) + "<!--dara-srcdoc-end-->";
						}

						startTag = startTag.replace(/<iframe/,"<iframe data-dara-crossorigin=\"\"");

						if (element.hasAttribute("srcdoc"))
						{
							origsrcdoc = element.getAttribute("srcdoc");

							origstr = " data-dara-srcdoc=\"" + origsrcdoc + "\"";

							startTag = startTag.replace(/ srcdoc="[^"]*"/,origstr + " srcdoc=\"" + htmltext + "\"");
						}
						else startTag = startTag.replace(/<iframe/,"<iframe srcdoc=\"" + htmltext + "\"");

						if (element.hasAttribute("sandbox"))  /* prevent scripts executing in cross-origin frames */
						{
							origsandbox = element.getAttribute("sandbox");

							origstr = " data-dara-sandbox=\"" + origsandbox + "\"";

							startTag = startTag.replace(/ sandbox="[^"]*"/,origstr + " sandbox=\"\"");
						}
						else startTag = startTag.replace(/<iframe/,"<iframe sandbox=\"\"");
					}
				}
			}

			if (element.hasAttribute("src"))
			{
				origurl = element.getAttribute("src");

				origstr = " data-dara-src=\"" + origurl + "\"";

				startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"\"");
			}

			if (page_kind == 0 && format_html && depth == 0 && !inline && parentpreserve == 0) htmlStrings[htmlStrings.length] = newlineIndent(indent);
		}

		htmlStrings[htmlStrings.length] = startTag;
		htmlStrings[htmlStrings.length] = endTag;
	}
	else if (element.localName == "frame")  /* frame elements */
	{
		if (page_kind == 0)
		{
			datauri = null;

			if (depth < max_frame_depth)
			{
				nosrcframe = nosrcframe || !element.getAttribute("src");

				subframekey = element.getAttribute("data-dara-key");

				try
				{
					if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before extracting */
					{
						startindex = htmlStrings.length;

						extractHTML(depth+1,element.contentWindow,element.contentDocument.documentElement,crossframe,nosrcframe,subframekey,preserve,indent+2);

						endindex = htmlStrings.length;

						htmltext = "";

						for (j = startindex; j < endindex; j++)
						{
							htmltext += htmlStrings[j];
							htmlStrings[j] = "";
						}

						datauri = "data:text/html;charset=utf-8," + encodeURIComponent(htmltext);

						startTag = startTag.replace(/<frame/,"<frame data-dara-sameorigin=\"\"");

						if (element.hasAttribute("src"))
						{
							origurl = element.getAttribute("src");

							origstr = " data-dara-src=\"" + origurl + "\"";

							startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
						}
						else startTag = startTag.replace(/<frame/,"<frame src=\"" + datauri + "\"");
					}
				}
				catch (e)  /* attempting cross-domain web page access */
				{
					for (i = 0; i < frame_key_array.length; i++)
					{
						if (frame_key_array[i] == subframekey) break;
					}

					if (i != frame_key_array.length)
					{
						parser = new DOMParser();
						framedoc = parser.parseFromString(frame_html_array[i],"text/html");

						startindex = htmlStrings.length;

						extractHTML(depth+1,null,framedoc.documentElement,true,nosrcframe,subframekey,preserve,indent+2);

						endindex = htmlStrings.length;

						htmltext = "";

						for (j = startindex; j < endindex; j++)
						{
							htmltext += htmlStrings[j];
							htmlStrings[j] = "";
						}

						datauri = "data:text/html;charset=utf-8," + encodeURIComponent(htmltext);

						startTag = startTag.replace(/<frame/,"<frame data-dara-crossorigin=\"\"");

						if (element.hasAttribute("src"))
						{
							origurl = element.getAttribute("src");

							origstr = " data-dara-src=\"" + origurl + "\"";

							startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
						}
						else startTag = startTag.replace(/<frame/,"<frame src=\"" + datauri + "\"");
					}

				}
			}

			if (datauri == null)
			{
				if (element.getAttribute("src"))  /* unsaved url */
				{
					baseuri = element.ownerDocument.baseURI;

					origurl = element.getAttribute("src");

					newurl = unsavedURL(origurl,baseuri);

					origstr = (newurl == origurl) ? "" : " data-dara-src=\"" + origurl + "\"";

					startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + newurl + "\"");
				}
			}

			if (page_kind == 0 && format_html && depth == 0 && !inline && parentpreserve == 0) htmlStrings[htmlStrings.length] = newlineIndent(indent);
		}

		htmlStrings[htmlStrings.length] = startTag;
	}
	else
	{
		if (element.localName == "html")
		{
			/* Add !DOCTYPE declaration */

			doctype = element.ownerDocument.doctype;

			if (doctype != null)
			{
				htmltext = '<!DOCTYPE ' + doctype.name + (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '') +
				((doctype.systemId && !doctype.publicId) ? ' SYSTEM' : '') + (doctype.systemId ? ' "' + doctype.systemId + '"' : '') + '>';

				htmlStrings[htmlStrings.length] = htmltext;
			}

			htmlStrings[htmlStrings.length] = startTag;
		}
		else if (element.localName == "head")
		{
			if (format_html && depth == 0) htmlStrings[htmlStrings.length] = newlineIndent(indent);
			htmlStrings[htmlStrings.length] = startTag;

			prefix = (format_html && depth == 0) ? "\n    " : "\n";

			/* Add first favicon from document head or if none add favicon from website root */

			if (depth == 0 && (first_icon_location != "" || root_icon_location != ""))
			{
				baseuri = element.ownerDocument.baseURI;

				location = (first_icon_location != "") ? first_icon_location : root_icon_location;

				datauri = replaceURL(location,baseuri);

				htmltext = prefix + "<link rel=\"icon\" data-dara-href=\"" + location + "\" href=\"" + datauri + "\">";

				htmlStrings[htmlStrings.length] = htmltext;
			}
		}
		else if (startTag != "")
		{
			if (page_kind == 0 && format_html && depth == 0 && !inline && parentpreserve == 0) htmlStrings[htmlStrings.length] = newlineIndent(indent);
			htmlStrings[htmlStrings.length] = startTag;
		}

		if (element.localName == "style" ||  /* <style> element */
		element.localName == "script" ||  /* <script> element */
		(element.localName == "link" && !(element.parentElement instanceof SVGElement) &&  /* <link> is invalid inside <svg> */
		element.rel.toLowerCase().indexOf("stylesheet") >= 0 && element.getAttribute("href")))  /* <link rel="stylesheet" href="..."> element */
		{
			if (format_html && depth == 0)
			{
				textContent = textContent.trim();
				if (page_kind == 0) textContent = textContent.replace(/\n/g,newlineIndent(indent+2));
				if (textContent != "") textContent = newlineIndent(indent+2) + textContent;
				textContent += newlineIndent(indent);
			}

			htmlStrings[htmlStrings.length] = textContent;
		}
		else if (element.localName == "textarea")  /* <textarea> element */
		{
			textContent = textContent.replace(/&/g,"&amp;");
			textContent = textContent.replace(/</g,"&lt;");
			textContent = textContent.replace(/>/g,"&gt;");

			htmlStrings[htmlStrings.length] = textContent;
		}
		else if (voidElements.indexOf(element.localName) >= 0) ;  /* void element */
		else
		{
			/* Handle shadow child nodes */

			if (is_firefox) shadowroot = element.shadowRoot || element.openOrClosedShadowRoot;
			else shadowroot = element.shadowRoot || ((chrome.dom && element instanceof HTMLElement) ? chrome.dom.openOrClosedShadowRoot(element) : null);

			if (shadowroot != null)
			{
				if (shadowElements.indexOf(element.localName) < 0)  /* ignore elements with built-in Shadow DOM */
				{
					if (page_kind == 0 && format_html && depth == 0)
					{
						htmlStrings[htmlStrings.length] = newlineIndent(indent);
						indent += 2;
					}

					htmlStrings[htmlStrings.length] = "<template data-dara-shadowroot=\"\">";

					for (i = 0; i < shadowroot.childNodes.length; i++)
					{
						if (shadowroot.childNodes[i] != null)  /* in case web page not fully loaded before extracting */
						{
							if (shadowroot.childNodes[i].nodeType == 1)  /* element node */
							{
								extractHTML(depth,frame,shadowroot.childNodes[i],crossframe,nosrcframe,framekey,preserve,indent+2);
							}
							else if (shadowroot.childNodes[i].nodeType == 3)  /* text node */
							{
								text = shadowroot.childNodes[i].textContent;

								if (shadowroot.localName != "noscript")
								{
									text = text.replace(/&/g,"&amp;");
									text = text.replace(/</g,"&lt;");
									text = text.replace(/>/g,"&gt;");
								}

								if (page_kind == 0 && format_html && depth == 0)
								{
									/* HTML whitespace == HTML space characters == spaces + newlines */
									/* HTML spaces: space (U+0020), tab (U+0009), form feed (U+000C) */
									/* HTML newlines: line feed (U+000A) or carriage return (U+000D) */

									if (preserve == 0) text = text.replace(/[\u0020\u0009\u000C\u000A\u000D]+/g," ");
									else if (preserve == 1) text = text.replace(/[\u0020\u0009\u000C]+/g," ");
								}

								htmlStrings[htmlStrings.length] = text;
							}
							else if (shadowroot.childNodes[i].nodeType == 8)  /* comment node */
							{
								text = shadowroot.childNodes[i].textContent;

								if (page_kind == 0 && format_html && depth == 0 && !inline && preserve == 0)
								{
									text = text.replace(/\n/g,newlineIndent(indent+2));

									htmlStrings[htmlStrings.length] = newlineIndent(indent+2);
								}

								htmlStrings[htmlStrings.length] = "<!--" + text + "-->";
							}
						}
					}

					if (page_kind == 0 && format_html && depth == 0)
					{
						indent -= 2;
						htmlStrings[htmlStrings.length] = newlineIndent(indent);
					}

					htmlStrings[htmlStrings.length] = "</template>";
				}
			}

			/* Handle normal child nodes */

			for (i = 0; i < element.childNodes.length; i++)
			{
				if (element.childNodes[i] != null)  /* in case web page not fully loaded before extracting */
				{
					if (element.childNodes[i].nodeType == 1)  /* element node */
					{
						if (depth == 0)
						{
							if (element.childNodes[i].localName == "script" && element.childNodes[i].id.substr(0,8) == "dara") continue;
							if (element.childNodes[i].localName == "meta" && element.childNodes[i].name.substr(0,8) == "dara") continue;
						}

						/* Handle other element nodes */

						extractHTML(depth,frame,element.childNodes[i],crossframe,nosrcframe,framekey,preserve,indent+2);
					}
					else if (element.childNodes[i].nodeType == 3)  /* text node */
					{
						text = element.childNodes[i].textContent;

						/* Skip text nodes before skipped elements/comments and at end of <head>/<body> elements */

						if (page_kind > 0 && format_html && depth == 0)
						{
							if (text.trim() == "" && (i+1) < element.childNodes.length && element.childNodes[i+1].nodeType == 1)
							{
								if (element.childNodes[i+1].localName == "base") continue;
								if (element.childNodes[i+1].localName == "script" && element.childNodes[i+1].id.substr(0,8) == "dara") continue;
								if (element.childNodes[i+1].localName == "meta" && element.childNodes[i+1].name.substr(0,8) == "dara") continue;
							}

							if (text.trim() == "" && (i+1) < element.childNodes.length && element.childNodes[i+1].nodeType == 8)
							{
								if (element.childNodes[i+1].textContent.indexOf("DARA") >= 0) continue;
							}

							if (text.trim() == "" && i == element.childNodes.length-1)
							{
								if (element.localName == "head") continue;
								if (element.localName == "body") continue;
							}
						}

						/* Handle other text nodes */

						if (element.localName != "noscript")
						{
							text = text.replace(/&/g,"&amp;");
							text = text.replace(/</g,"&lt;");
							text = text.replace(/>/g,"&gt;");
						}

						if (page_kind == 0 && format_html && depth == 0)
						{
							/* HTML whitespace == HTML space characters == spaces + newlines */
							/* HTML spaces: space (U+0020), tab (U+0009), form feed (U+000C) */
							/* HTML newlines: line feed (U+000A) or carriage return (U+000D) */

							if (preserve == 0) text = text.replace(/[\u0020\u0009\u000C\u000A\u000D]+/g," ");
							else if (preserve == 1) text = text.replace(/[\u0020\u0009\u000C]+/g," ");
						}

						htmlStrings[htmlStrings.length] = text;
					}
					else if (element.childNodes[i].nodeType == 8)  /* comment node */
					{
						text = element.childNodes[i].textContent;

						/* Skip existing DARA metrics and resource summary comment */

						if (text.indexOf("DARA") >= 0) continue;

						/* Handle other comment nodes */

						if (page_kind == 0 && format_html && depth == 0 && !inline && preserve == 0)
						{
							text = text.replace(/\n/g,newlineIndent(indent+2));

							htmlStrings[htmlStrings.length] = newlineIndent(indent+2);
						}

						htmlStrings[htmlStrings.length] = "<!--" + text + "-->";
					}
				}
			}
		}

		if (element.localName == "html" || element.localName == "body")
		{
			if (format_html && depth == 0) htmlStrings[htmlStrings.length] = newlineIndent(indent);
			htmlStrings[htmlStrings.length] = endTag;
		}
		else if (element.localName == "head")
		{
			prefix = (format_html && depth == 0) ? "\n    " : "\n";

			/* Add <style> element containing CSS URL variables */

			if (page_kind == 0 && merge_css_images)
			{
				htmltext = prefix + "<style id=\"dara-cssvariables\">";
				htmltext += prefix + "  :root {";

				for (i = 0; i < resource_location_array.length; i++)
				{
					if (resource_cssframekeys_array[i][framekey] == true)
					{
						try { asciistring = btoa(resource_content_array[i]); }
						catch (e) { asciistring = ""; }  /* resource content not a binary string */

						htmltext += prefix + "    --dara-url-" + i + ": url(data:" + resource_mimetype_array[i] + ";base64," + asciistring + ");";   /* binary data encoded as Base64 ASCII string */
					}
				}

				htmltext += prefix + "  }";
				htmltext += prefix + "</style>";

				htmlStrings[htmlStrings.length] = htmltext;
			}

			if (depth == 0)
			{
				/* Add saved page information */

				date = new Date();
				datestr = date.toString();

				if ((pubelem = document.querySelector("meta[property='article:published_time'][content]")) != null) pubstr = pubelem.getAttribute("content");  /* Open Graph - ISO8601 */
				else if ((pubelem = document.querySelector("meta[property='datePublished'][content]")) != null) pubstr = pubelem.getAttribute("content");  /* Generic RDFa - ISO8601 */
				else if ((pubelem = document.querySelector("meta[itemprop='datePublished'][content]")) != null) pubstr = pubelem.getAttribute("content");  /* Microdata - ISO8601 */
				else if ((pubelem = document.querySelector("script[type='application/ld+json']")) != null)  /* JSON-LD - ISO8601 */
				{
					pubmatches = pubelem.textContent.match(/"datePublished"\s*:\s*"([^"]*)"/);
					pubstr = pubmatches ? pubmatches[1] : null;
				}
				else if ((pubelem = document.querySelector("time[datetime]")) != null) pubstr = pubelem.getAttribute("datetime");  /* HTML5 - ISO8601 and similar formats */
				else pubstr = null;

				try
				{
					if (!pubstr) throw false;
					pubmatches = pubstr.match(/(Z|(-|\+)\d\d:?\d\d)$/);
					pubzone = pubmatches ? (pubmatches[1] == "Z" ? " GMT+0000" : " GMT" + pubmatches[1].replace(":","")) : "";  /* extract timezone */
					pubstr = pubstr.replace(/(Z|(-|\+)\d\d:?\d\d)$/,"");  /* remove timezone */
					pubdate = new Date(pubstr);
					pubdatestr = pubdate.toString();
					pubdatestr = pubdatestr.substr(0,24) + pubzone;
				}
				catch (e) { pubdatestr = "Unknown"; }
				pageurl = (page_kind == 0) ? document.URL : document.querySelector("meta[name='dara-url']").content;
				htmltext = prefix + "<meta name=\"dara-url\" content=\"" + decodeURIComponent(pageurl) + "\">";
				htmltext += prefix + "<meta name=\"dara-title\" content=\"" + document.title + "\">";
				htmltext += prefix + "<meta name=\"dara-pubdate\" content=\"" + pubdatestr + "\">";
				htmltext += prefix + "<meta name=\"dara-from\" content=\"" + decodeURIComponent(document.URL) + "\">";
				htmltext += prefix + "<meta name=\"dara-archdate\" content=\"" + datestr + "\">";
				htmltext += prefix + "<meta name=\"dara-version\" content=\"" + chrome.runtime.getManifest().version + "\">";
				htmlStrings[htmlStrings.length] = htmltext;
			}

			htmlStrings[htmlStrings.length] = newlineIndent(indent);
			htmlStrings[htmlStrings.length] = endTag;
		}
		else if (endTag != "")
		{
			if (page_kind == 0 && format_html && depth == 0 && !inline && preserve == 0 && element.children.length > 0)
			{
				htmlStrings[htmlStrings.length] = newlineIndent(indent);
			}

			htmlStrings[htmlStrings.length] = endTag;
		}
	}
}

function enumerateCSSInsetProperty(csstext)
{
	/* CSS inset property is supported by Firefox but not by Chrome */
	/* So enumerate inset property as top/right/bottom/left properties */

	csstext = csstext.replace(/inset\s*:\s*([^\s]+)\s*;/gi,"top: $1; right: $1; bottom: $1; left: $1;");
	csstext = csstext.replace(/inset\s*:\s*([^\s]+)\s+([^\s]+)\s*;/gi,"top: $1; right: $2; bottom: $1; left: $2;");
	csstext = csstext.replace(/inset\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s*;/gi,"top: $1; right: $2; bottom: $3; left: $2;");
	csstext = csstext.replace(/inset\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s*;/gi,"top: $1; right: $2; bottom: $3; left: $4;");

	return csstext;
}

function replaceCSSURLsInStyleSheet(csstext,baseuri,importstack,framekey)
{
	var regex;
	var matches = new Array();

	/* @import url() or */
	/* @font-face rule with font url()'s or */
	/* image url() or */
	/* avoid matches inside double-quote strings or */
	/* avoid matches inside single-quote strings or */
	/* avoid matches inside comments */

	regex = new RegExp(/(?:( ?)@import\s*(?:url\(\s*)?((?:"[^"]+")|(?:'[^']+')|(?:[^\s);]+))(?:\s*\))?\s*;)|/.source +  /* p1 & p2 */
/(?:( ?)@font-face\s*({[^}]*}))|/.source +  /* p3 & p4 */
	/(?:( ?)url\(\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s)]+))\s*\))|/.source +  /* p5 & p6 */
	/(?:"(?:\\"|[^"])*")|/.source +
	/(?:'(?:\\'|[^'])*')|/.source +
	/(?:\/\*(?:\*[^\/]|[^\*])*?\*\/)/.source,
	"gi");

	csstext = csstext.replace(regex,_replaceCSSURLOrImportStyleSheet);

	return csstext;

	function _replaceCSSURLOrImportStyleSheet(match,p1,p2,p3,p4,p5,p6,offset,string)
	{
		var i,location,csstext,newurl,datauriorcssvar,origstr,urlorvar;

		if (match.trim().substr(0,7).toLowerCase() == "@import")  /* @import url() */
		{
			p2 = removeQuotes(p2);

			if (replaceableResourceURL(p2))
			{
				if (baseuri != null)
				{
					location = resolveURL(p2,baseuri);

					if (location != null)
					{
						location = removeFragment(location);

						for (i = 0; i < resource_location_array.length; i++)
						if (resource_location_array[i] == location && resource_status_array[i] == "success") break;

						if (i < resource_location_array.length)  /* style sheet found */
						{
							if (importstack.indexOf(location) < 0)
							{
								importstack.push(location);

								csstext = replaceCSSURLsInStyleSheet(resource_content_array[i],resource_location_array[i],importstack,framekey);

								importstack.pop();

								return p1 + "/*dara-import-url=" + p2 + "*/" + p1 + csstext;
							}
						}
					}
				}

				if (remove_unsaved_urls) return p1 + "/*dara-import-url=" + p2 + "*/" + p1;
				else
				{
					newurl = adjustURL(p2,baseuri);

					if (newurl != p2)
					{
						match = match.replace(p2,newurl);
						match = match.replace(/(@import)/i,"/*dara-import-url=" + p2 + "*/" + p1 + "$1");
						return match;
					}
					else return match;  /* original @import rule */
				}
			}
		}
		else if (match.trim().substr(0,10).toLowerCase() == "@font-face")  /* @font-face rule */
		{
		match = match.replace(/font-display\s*:\s*([^\s;}]*)\s*;?/gi,"/*dara-font-display=$1*/");  /* remove font-display to avoid Chrome using fallback font */

		regex = /( ?)url\(\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s)]+))\s*\)/gi;  /* font url() */

		return match.replace(regex,_replaceURL);

		function _replaceURL(match,p1,p2,offset,string)
		{
			var cssvar,datauri,origstr;

			p2 = removeQuotes(p2);

			if (replaceableResourceURL(p2))
			{
				datauri = replaceURL(p2,baseuri);

				origstr = (datauri == p2) ? p1 : p1 + "/*dara-url=" + p2 + "*/" + p1;

				return origstr + "url(" + datauri + ")";
			}
			else return match;  /* unreplaceable - original font url() */
		}
	}
	else if (match.trim().substr(0,4).toLowerCase() == "url(")  /* image url() */
	{
		p6 = removeQuotes(p6);

		if (replaceableResourceURL(p6))
		{
			datauriorcssvar = replaceCSSImageURL(p6,baseuri,framekey);

			origstr = (datauriorcssvar == p6) ? p5 : p5 + "/*dara-url=" + p6 + "*/" + p5;

			urlorvar = (datauriorcssvar.substr(0,2) == "--") ? "var" : "url";

			return origstr + urlorvar + "(" + datauriorcssvar + ")";
		}
		else return match;  /* unreplaceable - original image url() */
	}
	else if (match.substr(0,1) == "\"") return match;  /* double-quote string */
	else if (match.substr(0,1) == "'") return match;  /* single-quote string */
	else if (match.substr(0,2) == "/*") return match;  /* comment */
}
}

function replaceCSSImageURLs(csstext,baseuri,framekey)
{
	var regex;

	regex = /( ?)url\(\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s)]+))\s*\)/gi;  /* image url() */

	csstext = csstext.replace(regex,_replaceCSSImageURL);

	return csstext;

	function _replaceCSSImageURL(match,p1,p2,offset,string)
	{
		var datauriorcssvar,origstr,urlorvar;

		p2 = removeQuotes(p2);

		if (replaceableResourceURL(p2))
		{
			datauriorcssvar = replaceCSSImageURL(p2,baseuri,framekey);

			origstr = (datauriorcssvar == p2) ? p1 : p1 + "/*dara-url=" + p2 + "*/" + p1;

			urlorvar = (datauriorcssvar.substr(0,2) == "--") ? "var" : "url";

			return origstr + urlorvar + "(" + datauriorcssvar + ")";
		}
		else return match;  /* unreplaceable - original image url() */
	}
}

function replaceCSSImageURL(url,baseuri,framekey)
{
	var i,location,count,asciistring;

	if (page_kind > 0) return url;  /* saved page - ignore new resources when re-saving */

	if (baseuri != null)
	{
		location = resolveURL(url,baseuri);

		if (location != null)
		{
			location = removeFragment(location);

			for (i = 0; i < resource_location_array.length; i++)
			if (resource_location_array[i] == location && resource_status_array[i] == "success") break;

			if (i < resource_location_array.length)
			{
				if (resource_charset_array[i] == "")  /* charset not defined - binary data */
				{
					count = merge_css_images ? resource_remembered_array[i]-resource_cssremembered_array[i]+Object.keys(resource_cssframekeys_array[i]).length : resource_remembered_array[i];

					if (resource_content_array[i].length*count <= max_resource_size*1024*1024)  /* skip large and/or repeated resource */
					{
						if (merge_css_images)
						{
							if (resource_cssframekeys_array[i][framekey] == true)
							{
								resource_replaced_array[i]++;

								return "--dara-url-" + i;
							}
						}
						else
						{
							resource_replaced_array[i]++;

							try { asciistring = btoa(resource_content_array[i]); }
							catch (e) { asciistring = ""; }  /* resource content not a binary string */

							return "data:" + resource_mimetype_array[i] + ";base64," + asciistring;  /* binary data encoded as Base64 ASCII string */
						}
					}
				}
			}
		}
	}
	return unsavedURL(url,baseuri);  /* unsaved url */
}

function replaceURL(url,baseuri)
{
	var i,location,fragment,count,asciistring;

	if (page_kind > 0) return url;  /* saved page - ignore new resources when re-saving */

	if (baseuri != null)
	{
		location = resolveURL(url,baseuri);

		if (location != null)
		{
			i = location.indexOf("#");

			fragment = (i >= 0) ? location.substr(i) : "";

			location = removeFragment(location);

			for (i = 0; i < resource_location_array.length; i++)
			if (resource_location_array[i] == location && resource_status_array[i] == "success") break;

			if (i < resource_location_array.length)
			{
				if (resource_charset_array[i] == "")  /* charset not defined - binary data */
				{
					count = resource_remembered_array[i];

					if (resource_content_array[i].length*count <= max_resource_size*1024*1024)  /* skip large and/or repeated resource */
					{
						resource_replaced_array[i]++;

						try { asciistring = btoa(resource_content_array[i]); }
						catch (e) { asciistring = ""; }  /* resource content not a binary string */

						return "data:" + resource_mimetype_array[i] + ";base64," + asciistring  + fragment;  /* binary data encoded as Base64 ASCII string */
					}
				}
				else  /* charset defined - character data */
				{
					resource_replaced_array[i]++;

					return "data:" + resource_mimetype_array[i] + ";charset=utf-8," + encodeURIComponent(resource_content_array[i]) + fragment;  /* characters encoded as UTF-8 %escaped string */
				}
			}
		}
	}

	return unsavedURL(url,baseuri);  /* unsaved url */
}

function retrieveContent(url,baseuri)
{
	var i,location;

	if (page_kind > 0) return "";  /* saved page - ignore new resources when re-saving */

	if (baseuri != null)
	{
		location = resolveURL(url,baseuri);

		if (location != null)
		{
			location = removeFragment(location);

			for (i = 0; i < resource_location_array.length; i++)
			if (resource_location_array[i] == location && resource_status_array[i] == "success") break;

			if (i < resource_location_array.length)
			{
				if (resource_charset_array[i] != "")  /* charset defined - character data */
				{
					resource_replaced_array[i]++;

					return resource_content_array[i];
				}
			}
		}
	}

	return "";  /* empty string */
}

function adjustURL(url,baseuri)
{
	var i,location;

	if (baseuri != null)
	{
		location = resolveURL(url,baseuri);

		if (location != null)
		{
			i = location.indexOf("#");

			if (i < 0)  /* without fragment */
			{
				return location;  /* same or different page - make absolute */
			}
			else  /* with fragment */
			{
				if (location.substr(0,i) == baseuri) return location.substr(i);  /* same page - make fragment only */
				else return location;  /* different page - make absolute */
			}
		}
	}

	return url;
}

function unsavedURL(url,baseuri)
{
	if (remove_unsaved_urls) return "";  /* empty string */
	else return adjustURL(url,baseuri);  /* original or adjusted url */
}

function createCanvasDataURL(url,baseuri,element)
{
	var canvas,context;

	canvas = document.createElement("canvas");
	canvas.width = element.clientWidth;
	canvas.height = element.clientHeight;

	try
	{
		context = canvas.getContext("2d");
		context.drawImage(element,0,0,canvas.width,canvas.height);
		return canvas.toDataURL("image/png","");
	}
	catch (e) {}

	return unsavedURL(url,baseuri);  /* unsaved url */
}

function newlineIndent(indent)
{
	var i,str;

	str = "\n";

	for (i = 0; i < indent; i++) str += " ";

	return str;
}

	/* Save utility functions */

	function showMessage(messagetitle,buttonsuffix,messagetext,continuefunction,cancelfunction)
	{
		var xhr,parser,messagedoc,container;

		xhr = new XMLHttpRequest();
		xhr.open("GET",chrome.runtime.getURL("/html/popup.html"),true);
		xhr.onload = complete;
		xhr.send();

		function complete()
		{
			if (xhr.status == 200)
			{
				/* Parse message document */

				parser = new DOMParser();
				messagedoc = parser.parseFromString(xhr.responseText,"text/html");

				/* Create container element */

				container = document.createElement("div");
				container.setAttribute("id","dara-message-panel-container");
				document.documentElement.appendChild(container);

				/* Append message elements */

				container.appendChild(messagedoc.getElementById("dara-message-panel-style"));
				container.appendChild(messagedoc.getElementById("dara-message-panel-overlay"));

				/* Set title, button names and contents */

				document.getElementById("dara-message-panel-header").textContent = messagetitle;
				document.getElementById("dara-message-panel-continue").textContent = "Continue";
				document.getElementById("dara-message-panel-cancel").textContent = "Cancel";
				document.getElementById("dara-message-panel-text").textContent = messagetext;

				/* Add listeners for buttons */

				document.getElementById("dara-message-panel-cancel").addEventListener("click",clickCancel,false);
				document.getElementById("dara-message-panel-continue").addEventListener("click",clickContinue,false);

				/* Configure for one or two buttons */

				if (continuefunction != null)
				{
					/* Focus continue button */

					document.getElementById("dara-message-panel-continue").focus();
				}
				else
				{
					/* Hide continue button */

					document.getElementById("dara-message-panel-continue").style.setProperty("display","none","important");

					/* Focus cancel button */

					document.getElementById("dara-message-panel-cancel").focus();
				}

				/* Select this tab */

				chrome.runtime.sendMessage({ type: "selectTab" });
			}
		}

		function clickContinue()
		{
			document.documentElement.removeChild(document.getElementById("dara-message-panel-container"));

			continuefunction();
		}

		function clickCancel()
		{
			document.documentElement.removeChild(document.getElementById("dara-message-panel-container"));

			cancelfunction();
		}
	}

	function removeQuotes(url){
		if (url.substr(0,1) == "\"" || url.substr(0,1) == "'") url = url.substr(1);
		if (url.substr(-1) == "\"" || url.substr(-1) == "'") url = url.substr(0,url.length-1);
		return url;
	}

	function replaceableResourceURL(url){
		/* Exclude data: urls, blob: urls, moz-extension: urls, fragment-only urls and empty urls */
		if (url.substr(0,5).toLowerCase() == "data:" || url.substr(0,5).toLowerCase() == "blob:" ||
		url.substr(0,14).toLowerCase() == "moz-extension:" || url.substr(0,1) == "#" || url == "") return false;
		return true;
	}

	function resolveURL(url,baseuri){
		var resolvedURL;
		try{
			resolvedURL = new URL(url,baseuri);
		}catch (e){
			return null;  /* baseuri invalid or null */
		}
		return resolvedURL.href;
	}

	function removeFragment(url){
		var i;
		i = url.indexOf("#");
		if (i >= 0) return url.substr(0,i);
		return url;
	}

	function sanitizeString(string)
	{
		var i,charcode;

		/* Remove control characters: 0-31 and 255 */
		/* Remove other line break characters: 133, 8232, 8233 */
		/* Remove zero-width characters: 6158, 8203, 8204, 8205, 8288, 65279 */
		/* Change all space characters to normal spaces: 160, 5760, 8192-8202, 8239, 8287, 12288 */
		/* Change all hyphen characters to normal hyphens: 173, 1470, 6150, 8208-8213, 8315, 8331, 8722, 11834, 11835, 65112, 65123, 65293 */

		for (i = 0; i < string.length; i++){
			charcode = string.charCodeAt(i);
			if (charcode <= 31 || charcode == 255 ||
			charcode == 133 || charcode == 8232 || charcode == 8233 ||
			charcode == 6158 || charcode == 8203 || charcode == 8204 || charcode == 8205 || charcode == 8288 || charcode == 65279)
			{
				string = string.substr(0,i) + string.substr(i+1);
			}

			if (charcode == 160 || charcode == 5760 || (charcode >= 8192 && charcode <= 8202) || charcode == 8239 || charcode == 8287 || charcode == 12288)
			{
				string = string.substr(0,i) + " " + string.substr(i+1);
			}

			if (charcode == 173 || charcode == 1470 || charcode == 6150 || (charcode >= 8208 && charcode <= 8213) ||
			charcode == 8315 || charcode == 8331 || charcode == 8722 || charcode == 11834 || charcode == 11835 ||
			charcode == 65112 || charcode == 65123 || charcode == 65293)
			{
				string = string.substr(0,i) + "-" + string.substr(i+1);
			}
		}
		return string;
	}

	
