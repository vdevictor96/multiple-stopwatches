// Add and manage multiple stopwatches with persistent state.

const allStopwatches = document.getElementById('all-stopwatches');
const template = document.getElementById('template');
const addStopwatchBtn = document.getElementById('add-stopwatch');
const removeAll = document.getElementById('remove-all');
const clearAll = document.getElementById('clear-all');
const finalBlock = document.getElementById('0');
const summaryRows = document.getElementById('summary-rows');
const summaryTotal = document.getElementById('summary-total');
let stopwatchArray = [];
let numStopwatches = 0;
let numIds = 1;
let dragged;
const STORAGE_KEY = 'multiple-stopwatches-state';
const FOOTER_STYLE_KEY = 'multiple-stopwatches-footer-style';
const FOOTER_RAPID_CLICK_WINDOW_MS = 1800;
const FOOTER_RAPID_CLICK_COUNT = 5;
const FOOTER_BURST_COOLDOWN_MS = 1200;
const HEART_BURST_COUNT = 48;
const HEART_BURST_COLORS = ['#ff4f8a', '#ff6ca7', '#ff9f45', '#ffd166', '#8bd3ff', '#8e9bff', '#c27bff', '#7bd88f'];
let saveThrottleTimer = null;
let saveBatchDepth = 0;
let lastSummaryUpdate = 0;
let footerClickTimestamps = [];
let lastFooterBurstAt = 0;

addStopwatchBtn.addEventListener('click', addStopwatch);
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

	let newStopwatchObj = {id: numIds.toString(),
						name: newName.value,
						stopwatch: newStopwatch,
						timeButton: newTimeButton,
						prevTime: 0,
						startTime: 0,
						dropCount: 0,
						};
	stopwatchArray.push(newStopwatchObj);
	allStopwatches.insertBefore(newStopwatch, finalBlock);
	numIds++;
	numStopwatches++;
	saveState();
	updateSummary(true);
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
	updateSummary(true);
}

function removeStopwatch(toRemove) {
	let swIndex = stopwatchArray.findIndex(sw => toRemove.id === sw.id)
	stopwatchArray.splice(swIndex, 1);
	allStopwatches.removeChild(toRemove);
	numStopwatches--;
	saveState();
	updateSummary(true);
}

function removeStopwatchUsingEvent(e) {
	removeStopwatch(getParentStopwatch(e.target));
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
	updateSummary();
}

function updateSummary(force) {
	let now = Date.now();
	if (!force && now - lastSummaryUpdate < 250) return;
	lastSummaryUpdate = now;

	let entries = [];
	let totalSeconds = 0;

	stopwatchArray.forEach(sw => {
		if (!sw.stopwatch) return; // skip finalBlock entry
		let elapsed;
		if (sw.timeButton.classList.contains('going')) {
			elapsed = sw.prevTime + (new Date() - sw.startTime) / 1000;
		} else {
			elapsed = parseTimeToSeconds(sw.timeButton.textContent);
		}
		if (elapsed <= 0) return; // skip zero-time timers
		entries.push({ name: sw.name, seconds: elapsed });
		totalSeconds += elapsed;
	});

	if (entries.length === 0) {
		summaryRows.innerHTML = '';
		summaryTotal.innerHTML = '';
		return;
	}

	// Build individual rows
	let rowsHtml = '';
	entries.forEach(entry => {
		rowsHtml += '<div class="summary-row">' +
			'<span class="summary-name">' + escapeHtml(entry.name) + '</span>' +
			'<span class="summary-time">' + formatTime(entry.seconds) + '</span>' +
			'</div>';
	});
	summaryRows.innerHTML = rowsHtml;

	// Format total using same format as individual timers
	let formattedTotal = formatTime(totalSeconds);

	// Format total as human-readable "Xh Ym"
	let totalHours = Math.floor(totalSeconds / 3600);
	let totalMinutes = Math.floor((totalSeconds % 3600) / 60);
	let humanParts = [];
	if (totalHours > 0) humanParts.push(totalHours + 'h');
	if (totalMinutes > 0 || totalHours === 0) humanParts.push(totalMinutes + 'm');
	let humanReadable = humanParts.join(' ');

	summaryTotal.innerHTML =
		'<div class="summary-row summary-total-row">' +
			'<span class="summary-name">Total</span>' +
			'<span class="summary-time">' + formattedTotal + '</span>' +
		'</div>' +
		'<div class="summary-human-total">' + humanReadable + '</div>';
}

function escapeHtml(str) {
	let div = document.createElement('div');
	div.textContent = str;
	return div.innerHTML;
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
		maybeTriggerFooterHeartBurst(footer);
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
	footer.title = activeStyleName + ' style active. Click to switch to ' + nextStyleName + '. Rapid-click 5x for a rainbow heart burst.';
}

function spawnFooterHeart(footer, activeStyle) {
	let rect = footer.getBoundingClientRect();
	let color = activeStyle === 'footer-style-classic' ? '#be3b67' : '#db4f80';
	spawnFloatingHeart({
		x: Math.round(rect.left + (rect.width / 2)),
		y: Math.round(rect.top + 4),
		color: color,
		sizeRem: 1.35,
		driftX: (Math.random() * 90) - 75,
		rise: Math.max(Math.floor(window.innerHeight * 0.65), 320),
		rotate: (Math.random() * 28) - 14,
		durationMs: 1400,
	});
}

function maybeTriggerFooterHeartBurst(footer) {
	let now = Date.now();
	footerClickTimestamps.push(now);
	footerClickTimestamps = footerClickTimestamps.filter(ts => now - ts <= FOOTER_RAPID_CLICK_WINDOW_MS);
	if (footerClickTimestamps.length < FOOTER_RAPID_CLICK_COUNT) return;
	if (now - lastFooterBurstAt < FOOTER_BURST_COOLDOWN_MS) return;

	lastFooterBurstAt = now;
	footerClickTimestamps = [];
	launchHeartBurst(footer);
}

function launchHeartBurst(footer) {
	let rect = footer.getBoundingClientRect();
	for (let i = 0; i < HEART_BURST_COUNT; i++) {
		let delay = Math.floor(Math.random() * 420);
		setTimeout(() => {
			let x = Math.random() * window.innerWidth;
			if (i < 16) {
				x = rect.left + (rect.width / 2) + ((Math.random() * 240) - 120);
			}
			x = Math.max(10, Math.min(window.innerWidth - 10, x));

			spawnFloatingHeart({
				x: Math.round(x),
				y: Math.round(window.innerHeight - (Math.random() * 70 + 8)),
				color: HEART_BURST_COLORS[Math.floor(Math.random() * HEART_BURST_COLORS.length)],
				sizeRem: 0.8 + (Math.random() * 1.1),
				driftX: (Math.random() * 220) - 110,
				rise: Math.floor(window.innerHeight * (0.55 + (Math.random() * 0.45))),
				rotate: (Math.random() * 50) - 25,
				durationMs: 1000 + Math.floor(Math.random() * 900),
			});
		}, delay);
	}
}

function spawnFloatingHeart(options) {
	let heart = document.createElement('div');
	heart.className = 'floating-heart';
	heart.textContent = '\u2665';
	heart.style.left = options.x + 'px';
	heart.style.top = options.y + 'px';
	heart.style.color = options.color;
	heart.style.fontSize = options.sizeRem + 'rem';
	heart.style.animationDuration = options.durationMs + 'ms';
	heart.style.setProperty('--heart-dx', options.driftX + 'px');
	heart.style.setProperty('--heart-rise', options.rise + 'px');
	heart.style.setProperty('--heart-rot', options.rotate + 'deg');
	heart.addEventListener('animationend', () => {
		heart.remove();
	});
	document.body.appendChild(heart);
}

function nameChangeEvent(e) {
	let stopwatchChanged = stopwatchArray.find(sw => getParentStopwatch(e.target).id === sw.id);
	if (stopwatchChanged) {
		stopwatchChanged.name = e.target.value;
	}
	saveState();
	updateSummary(true);
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
		stopwatches.push({
			id: sw.id,
			name: sw.name,
			elapsedTime: elapsedTime
		});
	});
	return { version: 1, stopwatches: stopwatches, keybindMap: {}, order: order, numIds: numIds };
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
		if (!data || !Array.isArray(data.stopwatches) || typeof data.numIds !== 'number') {
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
			timeButton: newTimeButton,
			prevTime: sw.elapsedTime || 0,
			startTime: 0,
			dropCount: 0,
		};
		stopwatchArray.push(newStopwatchObj);
		allStopwatches.insertBefore(newStopwatch, finalBlock);
		numStopwatches++;
	});

	numIds = data.numIds;
	updateSummary(true);
}
