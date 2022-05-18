/*

This file contains code from SavePage WE, used under GPL license

*/

"use strict";

var backendURL = 'https://dara.theimmutable.net/upload.php';
var dashboardURL = 'https://dara.theimmutable.net/dashboard.php';

var is_firefox;
var firefox_version;
var chrome_version;
var platform_os;
var platform_arch;
var lazy_load_content,lazy_load_kind;
var max_resource_size;
var max_resource_time;
var current_tab_id;
var notificationColour = "#3077b5";
var tab_id_array = new Array();
var tab_param_array = new Array();
var tab_types_array = new Array();
var tab_states_array = new Array();
var tab_texts_array = new Array("4","3","2","1","1","1","");
var cancel_saving = false;

const readLocalStorage = async (key) => {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get([key], function (result) {
			if (result[key] === undefined) {
				reject(result);
			} else {
				resolve(result[key]);
			}
		});
	});
};

chrome.runtime.onInstalled.addListener(function(details){
	if(details.reason == "install"){
		chrome.storage.local.set({ "dark-mode": true });
		chrome.storage.local.set({ "confirm-upload": true });
		chrome.storage.local.set({ "show-dash": true });
		chrome.storage.local.set({ "ui-sound": 0 });
	}else if(details.reason == "update"){

	}
});

/* Initialize on browser startup */
chrome.runtime.getPlatformInfo(
function(PlatformInfo) {
	platform_os = PlatformInfo.os;
	chrome.storage.local.set({ "environment-platformos": platform_os });
	platform_arch = PlatformInfo.arch;
	chrome.storage.local.set({ "environment-platformarch": platform_arch });
	is_firefox = (navigator.userAgent.indexOf("Firefox") >= 0);
	chrome.storage.local.set({ "environment-isfirefox": is_firefox });
	if (is_firefox) {
		chrome.runtime.getBrowserInfo(
		function(info) {
			firefox_version = info.version.substr(0,info.version.indexOf("."));
			chrome.storage.local.set({ "environment-ffversion": firefox_version });
			initialize();
		});
	} else {
		chrome_version = navigator.userAgent.match(/Chrom(?:e|ium)\/([0-9]+)/)[1];
		chrome.management.getSelf(
		function(extensionInfo) {
			initialize();
		});
	}
});

function sendPage(currentTab){
	performAction(currentTab,false,false);
}

function initialize() {
	lazy_load_content = false;
	lazy_load_kind = 1;
	max_resource_size = 50;
	max_resource_time = 120;
	chrome.tabs.query({lastFocusedWindow: true, active: true},
	function(tabs) {
		if (tabs[0]){
			tab_types_array[tabs[0].id] = 0;
			tab_states_array[tabs[0].id] = -4;
		}
	});
	addListeners();
}

/* Add listeners */
function addListeners() {
	var extra_info;

	/* Web navigation listeners */
	
	chrome.webNavigation.onCommitted.addListener(
	function(details) {
		if (details.frameId == 0) {
			tab_types_array[details.tabId] = 0;
			tab_states_array[details.tabId] = -4;
		}
	});
  
	chrome.webNavigation.onCompleted.addListener(
	function(details) {
		chrome.tabs.get(details.tabId,
		function(tab) {
			if (tab){
				if (chrome.runtime.lastError == null){
					if (details.frameId == 0 && details.url != tab.url) return;
					if (details.frameId == 0) {
						tab_types_array[details.tabId] = 0;
						tab_states_array[details.tabId] = -4;
					}
				}
			}
		});
	});
	
	/* Web request listeners */

	extra_info = (is_firefox || chrome_version < 72) ? ["requestHeaders"] : ["requestHeaders","extraHeaders"];
	chrome.webRequest.onBeforeSendHeaders.addListener(
	function(details) {
		var i,j;
		for (i = 0; i < details.requestHeaders.length; i++) {
			if (details.requestHeaders[i].name == "dara-referer") details.requestHeaders[i].name = "Referer";
			if (details.requestHeaders[i].name == "dara-origin") details.requestHeaders[i].name = "Origin";
		}
		return { requestHeaders: details.requestHeaders };
	}, { urls: ["<all_urls>"], types: ["xmlhttprequest"] },extra_info);

	/* Message received listener */
	chrome.runtime.onMessage.addListener(
	function(message,sender,sendResponse) {
		var is_safe_content,is_mixed_content,refererURL;
		var xhr = new Object();
		switch (message.type) {
			/* Messages from content script */
			case "delay":
				window.setTimeout(function() { sendResponse(); },message.milliseconds);
				return true;  /* asynchronous response */
			case "scriptLoaded":
				tab_states_array[sender.tab.id] = -1;
				chrome.tabs.sendMessage(sender.tab.id,{ type: "performAction",
					extractsrcurl: tab_param_array[sender.tab.id].extractsrcurl,
					multiplesaves: tab_param_array[sender.tab.id].multiplesaves },checkError);
				break;
			case "setSaveState":
				tab_states_array[sender.tab.id] = message.savestate;
				break;
			case "requestFrames":
				chrome.tabs.sendMessage(sender.tab.id,{ type: "requestFrames" },checkError);
				break;
			case "replyFrame":
				chrome.tabs.sendMessage(sender.tab.id,{ type: "replyFrame", key: message.key, url: message.url, html: message.html, fonts: message.fonts },checkError);
				break;
			case "loadResource":
				is_safe_content = (message.location.substr(0,6) == "https:" ||
				(message.location.substr(0,5) == "http:" && message.referer.substr(0,5) == "http:" && message.pagescheme == "http:"));
				is_mixed_content = (message.location.substr(0,5) == "http:" && (message.referer.substr(0,6) == "https:" || message.pagescheme == "https:"));
				if (is_safe_content || (is_mixed_content && message.passive)) {
					/* Load same-origin resource - or cross-origin with or without CORS - and add Referer Header */
					try {
						xhr = new XMLHttpRequest();
						xhr.open("GET",message.location,true);
						refererURL = new URL(message.referer);
						/* Origin Header must be set for CORS to operate */
						if (message.usecors) {
							xhr.setRequestHeader("dara-origin",refererURL.origin);
						}
						xhr.responseType = "arraybuffer";
						xhr.timeout = max_resource_time*1000;
						xhr.onload = onloadResource;
						xhr.onerror = onerrorResource;
						xhr.ontimeout = ontimeoutResource;
						xhr.onprogress = onprogressResource;
						xhr._tabId = sender.tab.id;
						xhr._index = message.index;
						xhr.send();  /* throws exception if url is invalid */
					}
					catch(e) {
						chrome.tabs.sendMessage(sender.tab.id,{ type: "loadFailure", index: message.index, reason: "send" },checkError);
					}
				}
				else chrome.tabs.sendMessage(sender.tab.id,{ type: "loadFailure", index: message.index, reason: "mixed" },checkError);

				function onloadResource() {
					var i,binaryString,contentType,allowOrigin;
					var byteArray = new Uint8Array(this.response);

					if (this.status == 200) {
						binaryString = "";
						for (i = 0; i < byteArray.byteLength; i++) binaryString += String.fromCharCode(byteArray[i]);
						contentType = this.getResponseHeader("Content-Type");
						if (contentType == null) contentType = "";
						allowOrigin = this.getResponseHeader("Access-Control-Allow-Origin");
						if (allowOrigin == null) allowOrigin = "";
						chrome.tabs.sendMessage(this._tabId,{ type: "loadSuccess", index: this._index,
						content: binaryString, contenttype: contentType, alloworigin: allowOrigin },checkError);
					}
					else chrome.tabs.sendMessage(this._tabId,{ type: "loadFailure", index: this._index, reason: "load:" + this.status },checkError);
				}
				function onerrorResource() {
					chrome.tabs.sendMessage(this._tabId,{ type: "loadFailure", index: this._index, reason: "network" },checkError);
				}
				function ontimeoutResource() {
					chrome.tabs.sendMessage(this._tabId,{ type: "loadFailure", index: this._index, reason: "maxtime" },checkError);
				}
				function onprogressResource(event) {
					if (event.lengthComputable && event.total > max_resource_size*1024*1024) {
						this.abort();
						chrome.tabs.sendMessage(this._tabId,{ type: "loadFailure", index: this._index, reason: "maxsize" },checkError);
					}
				}
				break;
			case "selectTab":
				chrome.tabs.update(sender.tab.id,{ active: true });
				break;
			case "saveExit":
				tab_states_array[sender.tab.id] = -2;
				finalizeAction(sender.tab.id,false);
				break;
			case "waitBeforeRevoke":
				window.setTimeout(
				function(tabId) {
					chrome.tabs.sendMessage(tabId,{ type: "nowRevokeObject" },checkError);
				},100,sender.tab.id);
				break;
			case "saveDone":
				tab_states_array[sender.tab.id] = -2;
				finalizeAction(sender.tab.id,true);
				break;
		}
	});
}

function nextAction(extractsrcurl,multiplesaves) {
	if (tab_id_array.length > 0) {
		current_tab_id = tab_id_array.shift();
		chrome.tabs.update(current_tab_id,{ active: lazy_load_content },
		function (tab) {
			if (tab){
				performAction(current_tab_id,extractsrcurl,multiplesaves);
			}
		});
	}
}

function performAction(tabId,extractsrcurl,multiplesaves) {
	chrome.tabs.get(tabId,
	function (tab) {
		if (tab){
			if (typeof tab != "undefined"){
				if (tab.url){
					if (chrome.runtime.lastError == null)  /* in case tab does not exist */ {
						if (specialPage(tab.url)) {
							alertNotify("Cannot be used with this page:\n > " + tab.title);
							nextAction(extractsrcurl,multiplesaves);
						} else if (tab.status != "complete") {
							alertNotify("Page is not ready:\n > " + tab.title);
							nextAction(extractsrcurl,multiplesaves);
						} else if (0 >= 2 && (typeof tab_types_array[tab.id] == "undefined" || tab_types_array[tab.id] == 0))  /* not saved page */ {
							alertNotify("Page is not a saved page:\n > " + tab.title);
							nextAction(extractsrcurl,multiplesaves);
						} else {
							tab_param_array[tab.id] = new Object();
							tab_param_array[tab.id].extractsrcurl = extractsrcurl;
							tab_param_array[tab.id].multiplesaves = multiplesaves;
							if (typeof tab_states_array[tab.id] == "undefined" || tab_states_array[tab.id] <= -4 )  /* script not loading or loaded */ {
								tab_states_array[tab.id] = -3;
								chrome.tabs.executeScript(tab.id,{ file: "/js/content.js" });
								chrome.tabs.executeScript(tab.id,{ file: "/js/frames.js", allFrames: true });
							} else if (tab_states_array[tab.id] == -2){
								tab_states_array[tab.id] = -1;
								chrome.tabs.sendMessage(tab.id,{ type: "performAction",
									extractsrcurl: extractsrcurl,
									multiplesaves: multiplesaves },checkError);
							} else if (tab_states_array[tab.id] >= -1 && tab_states_array[tab.id] <= 5)  /* operation in progress */ {
								alertNotify("Operation already in progress:\n > " + tab.title);
								nextAction(extractsrcurl,multiplesaves);
							}
						}
					}
				}
			}
		}
	});
}

function finalizeAction(tabId,success) {
	if (cancel_saving) {
		cancel_saving = false;
	} else {
		nextAction(tab_param_array[tabId].extractsrcurl,
		tab_param_array[tabId].multiplesaves);
	}
}

function cancelAction() {
	cancel_saving = true;
	chrome.tabs.sendMessage(current_tab_id,{ type: "cancel_saving" },checkError);
}

/* Special page function */
function specialPage(url) {
	if (url.substr(0,25) == "https://ipfs.theimmutable"){
		return true;
	}else if (url.substr(0,25) == "https://dara.theimmutable"){
		return true;
	}else if (url.substr(0,5) == "http:"){
		return false;
	}else if (url.substr(0,6) == "https:"){
		return false;
	}else{
		return true;
	}
}

/* Check for sendMessage errors */
function checkError() {
	if (chrome.runtime.lastError == null) ;
	else if (chrome.runtime.lastError.message == "Could not establish connection. Receiving end does not exist.") ;  /* Chrome & Firefox - ignore */
	else if (chrome.runtime.lastError.message == "The message port closed before a response was received.") ;  /* Chrome - ignore */
	else if (chrome.runtime.lastError.message == "Message manager disconnected") ;  /* Firefox - ignore */
	else console.log(chrome.runtime.lastError.message);
}

/* Display alert notification */
function alertNotify(message) {
	alert(message);
}

chrome.runtime.onMessage.addListener(async function(request) {
	if (request.method == 'uploadBlob') {
		var formData = new FormData();
		formData.append("request", 'uploadpage');
		formData.append("pagename", request.filename);
		formData.append("pageurl", request.pageurl);
		formData.append("uploaded", request.uploaded);
		formData.append("data", request.htmlstrings.join(''));
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function () {
			if (this.readyState != 4) return;
			if (this.status == 200) {
				var data = this.responseText;
				chrome.runtime.sendMessage({ 
					method: "uploadSuccess", 
					url: dashboardURL + '?fid=' + data
				});
			}else{
				chrome.runtime.sendMessage({
					method: "uploadFailure"
				});
			}
		};
		xhr.open("POST", backendURL, true);
		xhr.send(formData);
	}else if (request.method == 'consoleLog') {
		console.log(request.message);
	}
});
