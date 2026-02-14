//add multiple stopwatches at once, add macro keybinds, automatically fill in keyboard shortcuts

const allStopwatches = document.getElementById('all-stopwatches');
const template = document.getElementById('template');
const addStopwatchBtn = document.getElementById('add-stopwatch');
const removeAll = document.getElementById('remove-all');
const clearAll = document.getElementById('clear-all');
const addMacroDiv = document.getElementById('add-macro-div');
const addMacroBtn = document.getElementById('add-macro');
const addMacroInput = document.getElementById('add-macro-input');
const finalBlock = document.getElementById('0');
const sidebarList = document.querySelector('#sidebar div')
const macroListItemTemplate = document.getElementById('macro-li-template');
const deleteMacroBtn = document.getElementById('delete-macro-button');
let stopwatchArray = [];
let checkedObj = {};
let keybindObj = {};
let numStopwatches = 0;
let numIds = 1;
let dragged;
const STORAGE_KEY = 'multiple-stopwatches-state';
const FOOTER_STYLE_KEY = 'multiple-stopwatches-footer-style';
let saveThrottleTimer = null;
let saveBatchDepth = 0;

addStopwatchBtn.addEventListener('click', addStopwatch);
window.addEventListener('keydown', keyDownEvent);
removeAll.addEventListener('click', () => {
	batchSaves(() => {
		let i = 0;
		while (i < stopwatchArray.length) {
			if (stopwatchArray[i].stopwatch) {
				removeStopwatch(stopwatchArray[i].stopwatch);
			} else {
				i++;
			}
		}
		numIds = 1; //reset IDs, since there is no chance of conflict
	});
});
clearAll.addEventListener('click', () => {
	batchSaves(() => {
		stopwatchArray.forEach(sw => {
			if (sw.stopwatch) {
				clear(sw.stopwatch);
			}
		});
	});
});
addMacroBtn.addEventListener('click', e => {
	if (addMacroDiv.classList.toggle('active')) {
		clearAll.disabled = 'true';
		removeAll.disabled = 'true';
		addStopwatchBtn.disabled = 'true';
	} else {
		clearAll.disabled = '';
		removeAll.disabled = '';
		addStopwatchBtn.disabled = '';
		addMacroKeybind();
		checkedObj = {};
		addMacroInput.value = '';
	}
	stopwatchArray.forEach(sw => {
		if (sw.stopwatch) {	
			let delButton = sw.stopwatch.querySelector('.remove');
			toggleMacroMode(delButton);
		}
	});
});
deleteMacroBtn.addEventListener('click', e => {
	batchSaves(() => {
		let listOfMacros = Array.from(sidebarList.querySelectorAll('.macro-list-item'));
		listOfMacros.forEach(li => {
			if (li.querySelector('input').checked) {
				removeKeybind(li.querySelector('input').value);
			}
		});
	});
});

addDragEvents(finalBlock);
stopwatchArray.push({id: "0", dropCount: 0});

const savedState = loadState();
if (savedState && savedState.stopwatches.length > 0) {
	try {
		restoreFromState(savedState);
	} catch (e) {
		localStorage.removeItem(STORAGE_KEY);
		addStopwatch();
	}
} else {
	addStopwatch();
}

setInterval(updateStopwatches, 10);
setupFooterStyleToggle();

function addStopwatch() {
	let newStopwatch = template.cloneNode(true);
	newStopwatch.id = numIds.toString();

	let newKeybind = newStopwatch.querySelector('.keybind input');
	newKeybind.addEventListener('change', keybindChangeEvent);
	newKeybind.addEventListener('focus', saveOldKeybind)
	newKeybind.addEventListener('focus', () => disableDrag(newStopwatch));
	newKeybind.addEventListener('focusout', () => enableDrag(newStopwatch));

	let newTimeButton = newStopwatch.querySelector('.time button');
	newTimeButton.addEventListener('click', clickTimeButtonEvent);

	let newName = newStopwatch.querySelector('.name');
	newName.value = 'Stopwatch ' + (numIds);
	newName.addEventListener('change', nameChangeEvent);
	newName.addEventListener('focus', e => disableDrag(newStopwatch));
	newName.addEventListener('focusout', e => enableDrag(newStopwatch));

	let newDelButton = newStopwatch.querySelector('.remove');
	newDelButton.addEventListener('click', removeStopwatchUsingEvent);

	let newClearButton = newStopwatch.querySelector('.clear');
	newClearButton.addEventListener('click', e => clear(e.target.parentNode));

	addDragEvents(newStopwatch);

	let autoKeybind = numIds <= 10 ? (numIds % 10).toString() : '';
	newKeybind.value = autoKeybind;

	let newStopwatchObj = {id: numIds.toString(),
						name: newName.value,
						stopwatch: newStopwatch,
						keybind: autoKeybind,
						timeButton: newTimeButton,
						prevTime: 0,
						startTime: 0,
						dropCount: 0,
						};
	stopwatchArray.push(newStopwatchObj);
	if (autoKeybind) {
		keybindObj[autoKeybind] = [newStopwatchObj];
	}
	allStopwatches.insertBefore(newStopwatch, finalBlock);
	numIds++;
	numStopwatches++;
	saveState();
}

function disableDrag(newStopwatch) {
	newStopwatch.setAttribute('draggable', false);
}

function enableDrag(newStopwatch) {
	newStopwatch.setAttribute('draggable', true);
}

function addDragEvents(newStopwatch) {
	newStopwatch.addEventListener('dragover', e => {
		e.preventDefault();
	});
	newStopwatch.addEventListener('dragenter', () => {
		let dividerParent = newStopwatch;
		swObj = stopwatchArray.find(sw => sw.id === dividerParent.id);
		swObj.dropCount++;
		dividerParent.querySelector('.divider').style.visibility = 'visible';
	});
	newStopwatch.addEventListener('dragleave', () => {
		let dividerParent = newStopwatch;
		swObj = stopwatchArray.find(sw => sw.id === dividerParent.id);
		swObj.dropCount--;
		if (swObj.dropCount === 0) {
			dividerParent.querySelector('.divider').style.visibility = '';
		}
	})
	newStopwatch.addEventListener('dragstart', () => {
		let dividerParent = newStopwatch;
		finalBlock.style.visibility = 'visible';
		dragged = dividerParent;
	});
	newStopwatch.addEventListener('drop', e => {
		e.preventDefault();
		let dividerParent = newStopwatch;
		swObj = stopwatchArray.find(sw => sw.id === dividerParent.id);
		swObj.dropCount = 0;
		dividerParent.querySelector('.divider').style.visibility = '';
		finalBlock.style.visibility = '';
		if (dragged.id !== dividerParent.id) {
			dividerParent.parentNode.removeChild(dragged);
			dividerParent.parentNode.insertBefore(dragged, dividerParent);
			saveState();
		}
	});
}

function getParentStopwatch(child) {
	let parent = child;
	while (!parent.id) {
		parent = parent.parentNode;
	}
	return parent;
}

function clear(sw) {
	let tb = sw.querySelector('.time button');
	tb.classList.remove('going');
	tb.textContent = '0.00';
	saveState();
}

function removeStopwatch(toRemove) {
	let swIndex = stopwatchArray.findIndex(sw => toRemove.id === sw.id)
	let sw = stopwatchArray[swIndex];
	stopwatchArray.splice(swIndex, 1);
	allStopwatches.removeChild(toRemove);
	for (let key in keybindObj) {
		let index = keybindObj[key].indexOf(sw);
		if (index >= 0) {
			keybindObj[key].splice(index, 1);
			if (keybindObj[key].length === 0) {
				removeKeybind(key);
			} else {
				updateMacroString(key);
			}
		}
	}
	numStopwatches--;
	saveState();
}

function updateMacroString(key) {
	let str = '';
	keybindObj[key].forEach(sw => str += sw.name + ', ');
	let sidebarItem = sidebarList.querySelector('label[for=cb-keybind-' + key + ']')
	if (sidebarItem) {
		sidebarItem.textContent = key + ': ' + str.slice(0, -2);
	}
}

function removeStopwatchUsingEvent(e) {
	removeStopwatch(getParentStopwatch(e.target));
}

function toggleCheckForMacro(e) {
	let id = getParentStopwatch(e.target).id;
	let val = checkedObj[id];
	if (val) {
		delete checkedObj[id];
		e.target.style.color = '';
	} else {
		checkedObj[id] = true;
		e.target.style.color = 'black';
	}
}

function toggleMacroMode(button) {
	if (button.classList.toggle('check')) { // returns true if 'check' is added to classList
		button.removeEventListener('click', removeStopwatchUsingEvent);
		button.addEventListener('click', toggleCheckForMacro);
		button.textContent = '\u2714';
	} else {
		button.removeEventListener('click', toggleCheckForMacro);
		button.addEventListener('click', removeStopwatchUsingEvent);
		button.textContent = '\u2715';
		button.style.color = '';
	}
}

function clickTimeButtonEvent(e) {
	e.target.classList.toggle('going');
	let stopwatchObj = stopwatchArray.find(sw => e.target === sw.timeButton);
	if (stopwatchObj) {
		stopwatchObj.startTime = new Date();
		stopwatchObj.prevTime = parseTimeToSeconds(stopwatchObj.timeButton.textContent);
	}
	saveState();
}

function formatTime(totalSeconds) {
	totalSeconds = Math.max(0, totalSeconds);
	if (totalSeconds < 60) {
		return totalSeconds.toFixed(2);
	} else if (totalSeconds < 3600) {
		let minutes = Math.floor(totalSeconds / 60);
		let seconds = Math.floor(totalSeconds % 60);
		return minutes + ':' + seconds.toString().padStart(2, '0');
	} else {
		let hours = Math.floor(totalSeconds / 3600);
		let minutes = Math.floor((totalSeconds % 3600) / 60);
		let seconds = Math.floor(totalSeconds % 60);
		return hours + ':' + minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
	}
}

function parseTimeToSeconds(timeStr) {
	let parts = timeStr.split(':');
	if (parts.length === 1) {
		return parseFloat(timeStr) || 0;
	} else if (parts.length === 2) {
		return (parseFloat(parts[0]) * 60 + parseFloat(parts[1])) || 0;
	} else {
		return (parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])) || 0;
	}
}

function updateStopwatches() {
	//get array of stopwatches that are currently going
	let going = stopwatchArray.filter(sw => sw.timeButton && sw.timeButton.classList.contains('going'));
	for (let i = 0; i < going.length; i++) { //update each stopwatch in array
		let dur = (new Date() - going[i].startTime) / 1000;
		let totalSeconds = going[i].prevTime + dur;
		going[i].timeButton.textContent = formatTime(totalSeconds);
	}
	// Throttled save while any stopwatch is running
	if (going.length > 0 && !saveThrottleTimer) {
		saveThrottleTimer = setTimeout(() => {
			saveState();
			saveThrottleTimer = null;
		}, 500);
	}
}

function keyDownEvent(e) {
	if (e.target.nodeName !== 'INPUT') { //do nothing if currently in a textbox
		//go through array to see if there is a stopwatch with this keybind
		let swArray = keybindObj[e.key];
		if (swArray) {
			swArray.forEach(sw => sw.timeButton.click());
		}
	}
}

function setupFooterStyleToggle() {
	let footer = document.getElementById('love-footer');
	if (!footer) return;

	let styles = ['footer-style-classic', 'footer-style-romantic'];
	let activeStyle = localStorage.getItem(FOOTER_STYLE_KEY);
	if (!styles.includes(activeStyle)) {
		activeStyle = styles[0];
	}

	footer.classList.remove(styles[0], styles[1]);
	footer.classList.add(activeStyle);
	updateFooterTitle(footer, activeStyle);

	footer.addEventListener('click', () => {
		spawnFooterHeart(footer, activeStyle);
		let currentIdx = styles.indexOf(activeStyle);
		activeStyle = styles[(currentIdx + 1) % styles.length];
		footer.classList.remove(styles[0], styles[1]);
		footer.classList.add(activeStyle);
		updateFooterTitle(footer, activeStyle);
		localStorage.setItem(FOOTER_STYLE_KEY, activeStyle);
	});
}

function updateFooterTitle(footer, activeStyle) {
	let nextStyleName = activeStyle === 'footer-style-classic' ? 'romantic' : 'classic';
	let activeStyleName = activeStyle === 'footer-style-classic' ? 'Classic' : 'Romantic';
	footer.title = activeStyleName + ' style active. Click to switch to ' + nextStyleName + ' and launch a heart.';
}

function spawnFooterHeart(footer, activeStyle) {
	let rect = footer.getBoundingClientRect();
	let heart = document.createElement('div');
	let driftX = (Math.random() * 90) - 75;
	let rise = Math.max(Math.floor(window.innerHeight * 0.65), 320);
	let rotate = (Math.random() * 28) - 14;
	heart.className = 'floating-heart';
	heart.textContent = '\u2665';
	heart.style.left = Math.round(rect.left + (rect.width / 2)) + 'px';
	heart.style.top = Math.round(rect.top + 4) + 'px';
	heart.style.setProperty('--heart-dx', driftX + 'px');
	heart.style.setProperty('--heart-rise', rise + 'px');
	heart.style.setProperty('--heart-rot', rotate + 'deg');
	if (activeStyle === 'footer-style-classic') {
		heart.style.color = '#be3b67';
	} else {
		heart.style.color = '#db4f80';
	}
	heart.addEventListener('animationend', () => {
		heart.remove();
	});
	document.body.appendChild(heart);
}

function saveOldKeybind(e) {
	e.target.oldValue = e.target.value
}

function keybindChangeEvent(e) {
	if (e.target.value !== '') {
		if (!checkKeybindAvailable(e.target.value)) return;
		keybindObj[e.target.value] = [stopwatchArray.find(sw => getParentStopwatch(e.target).id === sw.id)];
	} else {
		removeKeybind(e.target.oldValue)
	}
	saveState();
}

function checkKeybindAvailable(kb) {
	let swArray = keybindObj[kb];
	if (swArray && swArray.length > 0) {
		if (confirm('The stopwatch(es) ' + swArray.map(sw => sw.name).join(', ') + ' already has this keybind. Replace?')) {
			removeKeybind(kb);
		} else {
			return false;
		}
	}
	return true;
}

function removeKeybind(key) {
	let identifier = 'keybind-' + key;
	let child = document.getElementById('keybind-' + key);
	if (child) { //macro
		sidebarList.removeChild(child);
	} else if (keybindObj[key].length > 0) { //individual
		keybindObj[key][0].stopwatch.querySelector('.keybind input').value = '';
	}
	delete keybindObj[key];
	saveState();
}

function nameChangeEvent(e) {
	let stopwatchChanged = stopwatchArray.find(sw => getParentStopwatch(e.target).id === sw.id);
	if (stopwatchChanged) {
		stopwatchChanged.name = e.target.value;
	}
	for (let key in keybindObj) {
		if (keybindObj[key].indexOf(stopwatchChanged) >= 0) {
			updateMacroString(key);
		}
	}
	saveState();
}

function addMacroKeybind() {
	if (Object.keys(checkedObj).length > 1 && addMacroInput.value.length > 0) {
		if (!checkKeybindAvailable(addMacroInput.value)) return;
		let listItem = macroListItemTemplate.cloneNode(true);
		let checkbox = listItem.querySelector('input');
		let label = listItem.querySelector('label');
		let identifier = 'keybind-' + addMacroInput.value;
		let str = '';
		keybindObj[addMacroInput.value] = [];
		for (let key in checkedObj) {
			let sw = stopwatchArray.find(sw => key === sw.id);
			str += sw.name + ', ';
			keybindObj[addMacroInput.value].push(sw);
		}
		label.textContent = addMacroInput.value + ': ' + str.slice(0, -2);
		label.htmlFor = 'cb-' + identifier;
		checkbox.value = addMacroInput.value;
		checkbox.id = 'cb-' + identifier;
		listItem.id = identifier;
		sidebarList.appendChild(listItem);
		saveState();
	} else if (Object.keys(checkedObj).length == 1) {
		alert("Only 1 stopwatch checked - use an individual keybind instead");
	}
}

function getSerializableState() {
	let stopwatches = [];
	let order = [];
	let children = allStopwatches.children;
	for (let i = 0; i < children.length; i++) {
		let child = children[i];
		if (child.id === '0' || child.id === 'template') continue;
		order.push(child.id);
	}
	stopwatchArray.forEach(sw => {
		if (!sw.stopwatch) return; // skip finalBlock entry
		let elapsedTime = parseTimeToSeconds(sw.timeButton.textContent);
		let keybind = sw.stopwatch.querySelector('.keybind input').value;
		stopwatches.push({
			id: sw.id,
			name: sw.name,
			keybind: keybind,
			elapsedTime: elapsedTime
		});
	});
	let keybindMap = {};
	for (let key in keybindObj) {
		keybindMap[key] = keybindObj[key].map(sw => sw.id);
	}
	return { version: 1, stopwatches: stopwatches, keybindMap: keybindMap, order: order, numIds: numIds };
}

function saveState() {
	if (saveBatchDepth > 0) return; // skip saves during batch operations
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(getSerializableState()));
	} catch (e) {
		// Silently degrade — app continues working without persistence
	}
}

function batchSaves(fn) {
	saveBatchDepth++;
	try {
		fn();
	} finally {
		saveBatchDepth--;
	}
	saveState();
}

function loadState() {
	try {
		let raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		let data = JSON.parse(raw);
		if (!data || !Array.isArray(data.stopwatches) || typeof data.keybindMap !== 'object' || typeof data.numIds !== 'number') {
			return null;
		}
		return data;
	} catch (e) {
		return null;
	}
}

function restoreFromState(data) {
	let orderMap = {};
	if (data.order) {
		data.order.forEach((id, idx) => { orderMap[id] = idx; });
	}
	let sorted = data.stopwatches.slice().sort((a, b) => {
		let oa = orderMap[a.id] !== undefined ? orderMap[a.id] : 9999;
		let ob = orderMap[b.id] !== undefined ? orderMap[b.id] : 9999;
		return oa - ob;
	});

	sorted.forEach(sw => {
		let newStopwatch = template.cloneNode(true);
		newStopwatch.id = sw.id;

		let newKeybind = newStopwatch.querySelector('.keybind input');
		newKeybind.addEventListener('change', keybindChangeEvent);
		newKeybind.addEventListener('focus', saveOldKeybind);
		newKeybind.addEventListener('focus', () => disableDrag(newStopwatch));
		newKeybind.addEventListener('focusout', () => enableDrag(newStopwatch));
		newKeybind.value = sw.keybind || '';

		let newTimeButton = newStopwatch.querySelector('.time button');
		newTimeButton.addEventListener('click', clickTimeButtonEvent);
		newTimeButton.textContent = sw.elapsedTime > 0 ? formatTime(sw.elapsedTime) : '0.00';

		let newName = newStopwatch.querySelector('.name');
		newName.value = sw.name || 'Stopwatch';
		newName.addEventListener('change', nameChangeEvent);
		newName.addEventListener('focus', () => disableDrag(newStopwatch));
		newName.addEventListener('focusout', () => enableDrag(newStopwatch));

		let newDelButton = newStopwatch.querySelector('.remove');
		newDelButton.addEventListener('click', removeStopwatchUsingEvent);

		let newClearButton = newStopwatch.querySelector('.clear');
		newClearButton.addEventListener('click', e => clear(e.target.parentNode));

		addDragEvents(newStopwatch);

		let newStopwatchObj = {
			id: sw.id,
			name: sw.name || 'Stopwatch',
			stopwatch: newStopwatch,
			keybind: sw.keybind || '',
			timeButton: newTimeButton,
			prevTime: sw.elapsedTime || 0,
			startTime: 0,
			dropCount: 0,
		};
		stopwatchArray.push(newStopwatchObj);
		allStopwatches.insertBefore(newStopwatch, finalBlock);
		numStopwatches++;
	});

	// Restore keybinds from keybindMap
	for (let key in data.keybindMap) {
		let ids = data.keybindMap[key];
		let swObjs = [];
		ids.forEach(id => {
			let found = stopwatchArray.find(sw => sw.id === id);
			if (found) swObjs.push(found);
		});
		if (swObjs.length === 0) continue;
		if (swObjs.length >= 2) {
			// Macro keybind — populate keybindObj and create sidebar item
			keybindObj[key] = swObjs;
			let listItem = macroListItemTemplate.cloneNode(true);
			let checkbox = listItem.querySelector('input');
			let label = listItem.querySelector('label');
			let identifier = 'keybind-' + key;
			let str = '';
			swObjs.forEach(sw => { str += sw.name + ', '; });
			label.textContent = key + ': ' + str.slice(0, -2);
			label.htmlFor = 'cb-' + identifier;
			checkbox.value = key;
			checkbox.id = 'cb-' + identifier;
			listItem.id = identifier;
			sidebarList.appendChild(listItem);
		} else {
			// Individual keybind
			keybindObj[key] = swObjs;
		}
	}

	numIds = data.numIds;
}
