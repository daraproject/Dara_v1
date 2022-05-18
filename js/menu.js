"use strict";

window.onload = async function() {
	document.getElementById("daraLogo").addEventListener("click", imageClickFunction);
	document.getElementById("upload").addEventListener("click", uploadFunction);
	document.getElementById("dashboard").addEventListener("click", dashFunction);
	document.getElementById("settings").addEventListener("click", settingsFunction);
	document.getElementById("checkbox1").addEventListener("click", checkFunction);
	var darkMode = await readLocalStorage('dark-mode');
	document.getElementById("checkbox1").checked = darkMode;
	document.getElementById("checkbox2").addEventListener("click", checkFunction);
	var confirmUploads = await readLocalStorage('confirm-upload');
	document.getElementById("checkbox2").checked = confirmUploads;
	document.getElementById("checkbox3").addEventListener("click", checkFunction);
	var showDash = await readLocalStorage('show-dash');
	document.getElementById("checkbox3").checked = showDash;
	document.getElementById("selectbox1").addEventListener("change", selectFunction);
	var uiSound = await readLocalStorage('ui-sound');
	document.getElementById("selectbox1").selectedIndex = uiSound;
	switchTheme(darkMode);
}

function switchTheme(darkMode){
	var labelColor = '#ffffff';
	if (darkMode == true){
		document.getElementById("settingsBox").style.borderColor = "#333333";
		document.getElementById("settingsBox").style.backgroundColor = "#333333";
		document.getElementById("selectbox1").style.backgroundColor = "#222222";
		document.getElementById("selectbox1").style.borderColor = "#444444";
		document.getElementById("selectbox1").style.color = "#ffffff";
		document.getElementById("selectbox1").style.borderRadius = "4px";
		document.getElementById("versionString").style.color = "#444444";
		document.getElementById("popupBody").style.backgroundColor = "#222222";
		document.getElementById("popupBody").style.borderColor = "#ffb80a";
		document.getElementById("popupBody").style.borderWidth = "1px";
	}else{
		document.getElementById("settingsBox").style.borderColor = "#eeeeee";
		document.getElementById("settingsBox").style.backgroundColor = "#eeeeee";
		document.getElementById("selectbox1").style.backgroundColor = "#ffffff";
		document.getElementById("selectbox1").style.borderColor = "#dddddd";
		document.getElementById("selectbox1").style.color = "#000000";
		document.getElementById("selectbox1").style.borderRadius = "4px";
		document.getElementById("versionString").style.color = "#bbbbbb";
		document.getElementById("popupBody").style.backgroundColor = "#ffffff";
		document.getElementById("popupBody").style.borderColor = "#bbbbbb";
		document.getElementById("popupBody").style.borderWidth = "1.5px";
		labelColor = "#000000"
	}
	var labels = document.getElementsByClassName("dara-check-label");
	var i;
	for (i = 0;i < labels.length; i++){
		labels[i].style.color = labelColor;
	}
	if (navigator.userAgent.indexOf("Firefox") > 0) {
		document.getElementById("settingsBox").style.height = '97px';
		document.getElementById("settingsBox").style.width = '223px';
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

chrome.runtime.onMessage.addListener(async function(request) {
	if (request.method == 'uploadSuccess') {
		const daraLogo = document.getElementById("daraLogo");
		daraLogo.classList.remove("logo");
		daraLogo.classList.add("bounce");
		document.getElementById("upload").innerText = 'Upload Complete!';
		await sleep(500);
		daraLogo.classList.remove("bounce");
		await sleep(700);
		chrome.tabs.query({currentWindow: true},async function(tabs){
			var i;
			var daraTab = null;
			for (i = 0;i < tabs.length; i++){
				let domain = (new URL(tabs[i].url));
				if (domain.hostname == 'dara.theimmutable.net'){
					daraTab = tabs[i];
					break;
				}
			}
			if (daraTab == null){
				chrome.tabs.create({url: request.url});
			}else{
				chrome.tabs.update(daraTab.id, { url: request.url});
				var showDash = await readLocalStorage('show-dash');
				if (showDash == true){
					chrome.tabs.highlight({'tabs': daraTab.index}, function() {});
				}
			}
		});
	}else if (request.method == 'uploadFailure') {
		const daraLogo = document.getElementById("daraLogo");
		daraLogo.classList.remove("logo");
		daraLogo.classList.add("bounce");
		document.getElementById("upload").innerText = 'Upload Failed!';
		await sleep(500);
		daraLogo.classList.remove("bounce");
		await sleep(700);
	}
});

async function imageClickFunction(){
	const daraLogo = document.getElementById("daraLogo");
	daraLogo.classList.add("bounce");
	await sleep(500);
	daraLogo.classList.remove("bounce");
	var uiSound = await readLocalStorage('ui-sound');
	if (uiSound != 0){
		var uiSounds = ["none", "/sounds/click.mp3", "/sounds/harp.mp3", "/sounds/pop.mp3", "/sounds/tinkle.mp3", "/sounds/woosh.mp3"];
		var soundPath = uiSounds[uiSound];
		var audio = new Audio(chrome.extension.getURL(soundPath));
		audio.loop = false;
		await audio.play(); 
	}
	await uploadFunction();
}

async function uploadFunction(){
	chrome.tabs.query({active:true, lastFocusedWindow: true},async function(tab){
    var url = tab[0].url;
		var title = tab[0].title;
		await sleep(200);
		let domain = (new URL(url));
		var checkURL = 'https://daraapi.theimmutable.net/dc.php?domain='+domain.hostname;
		var result = await fetch(checkURL);
		var domainStatus = await result.json();
		var supported = false;
		if (domainStatus['d'] == domain.hostname){
			if (domainStatus['r'] == 'PASS' && domainStatus['p'] == 'PASS' && domainStatus['m'] == 'PASS'){
				supported = true;
			}
		}
		if (supported == true){
			if (domain.hostname != 'dara.theimmutable.net'){
				var confirmUploads = await readLocalStorage('confirm-upload');
				if (confirmUploads == true){
					if (confirm('Are you sure you want to upload this page?\n\n'+title)) {
						document.getElementById("upload").disabled = true;
						document.getElementById("upload").innerText = 'Uploading, please wait...';
						const daraLogo = document.getElementById("daraLogo");
						daraLogo.classList.add("logo");
						var bgPage = chrome.extension.getBackgroundPage();
						bgPage.sendPage(tab[0].id);
						await new Promise(r => setTimeout(r, 10000));
					}
				}else{
					document.getElementById("upload").disabled = true;
					document.getElementById("upload").innerText = 'Uploading, please wait...';
					const daraLogo = document.getElementById("daraLogo");
					daraLogo.classList.add("logo");
					var bgPage = chrome.extension.getBackgroundPage();
					bgPage.sendPage(tab[0].id);
					await new Promise(r => setTimeout(r, 10000));
				}
			}else{
				alert('Sorry, this domain is not currently supported!');
			}
		}else{
			alert('Sorry, this domain is not currently supported!');
		}
		document.getElementById("upload").innerText = 'Upload This Page';
		document.getElementById("upload").disabled = false;
	});
}

async function dashFunction(){
	chrome.tabs.query({currentWindow: true},function(tabs){
		var i;
		var daraTab = null;
		for (i = 0;i < tabs.length; i++){
			let domain = (new URL(tabs[i].url));
			if (domain.hostname == 'dara.theimmutable.net'){
				daraTab = tabs[i];
				break;
			}
		}
		if (daraTab == null){
			chrome.tabs.create({url: 'https://dara.theimmutable.net/dashboard.php'});
		}else{
			chrome.tabs.update(daraTab.id, { url: 'https://dara.theimmutable.net/dashboard.php'});
			chrome.tabs.highlight({'tabs': daraTab.index}, function() {});
		}
	});
}

async function settingsFunction(){
	if (document.getElementById("settingsBox").hidden == false){
		document.getElementById("settingsBox").hidden = true;
		document.getElementById("upload").hidden = false;
		document.getElementById("dashboard").hidden = false;
		document.getElementById("settings").innerText = "Settings";
		document.getElementById("versionString").hidden = false;
	}else{
		document.getElementById("settingsBox").hidden = false;
		document.getElementById("upload").hidden = true;
		document.getElementById("dashboard").hidden = true;
		document.getElementById("settings").innerText = "Done";
		document.getElementById("versionString").hidden = true;
	}
}

async function checkFunction(){
	var checkBox1 = document.getElementById("checkbox1");
	if (checkBox1.checked == true){
		chrome.storage.local.set({ "dark-mode": true });
		switchTheme(true);
	}else{
		chrome.storage.local.set({ "dark-mode": false });
		switchTheme(false);
	}
	var checkBox2 = document.getElementById("checkbox2");
	if (checkBox2.checked == true){
		chrome.storage.local.set({ "confirm-upload": true });
	}else{
		chrome.storage.local.set({ "confirm-upload": false });
	}
	var checkBox3 = document.getElementById("checkbox3");
	if (checkBox3.checked == true){
		chrome.storage.local.set({ "show-dash": true });
	}else{
		chrome.storage.local.set({ "show-dash": false });
	}
}

async function selectFunction(){
	var selectBox = document.getElementById("selectbox1");
	chrome.storage.local.set({ "ui-sound": selectBox.selectedIndex });
}

const readLocalStorage = async (key) => {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get([key], function (result) {
			if (result[key] === undefined) {
				reject();
			} else {
				resolve(result[key]);
			}
		});
	});
};