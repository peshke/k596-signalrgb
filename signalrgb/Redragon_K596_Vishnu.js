// SignalRGB plugin - Redragon K596 Vishnu (wired, MosArt 062a:8519, firmware 1.04-1.07)
// Uses the firmware's direct RGB mode (found by disassembling the firmware):
//   08 91                      enter direct mode
//   08 92 00 00 00 R G B       fill all LEDs
//   08 93 group col 00 R G B   one key LED (group = (index-1)/13, col = (index-1)%13)
//   08 93 FF n   00 R G B      one side light (n = 0-7 left top->bottom, 8-15 right top->bottom)
//   08 90                      leave direct mode (back to onboard lighting)
// Each command is echo-confirmed before the next is sent, so nothing is dropped on either stock or
// patched firmware; the plugin sends only the keys whose colour changed. Stock firmware runs a full
// LED refresh on every per-key command (~8 ms each, so fast full-screen effects are limited);
// firmware 1.07 removes that refresh and is several times faster. "Key updates per frame" = Auto
// times a few commands at start-up and picks the budget to match. Nothing is written to flash.

export function Name() { return "Redragon K596 Vishnu"; }
export function VendorId() { return 0x062a; }
export function ProductId() { return 0x8519; }
export function Publisher() { return "peshke"; }
export function Size() { return [21, 8]; }
export function DefaultPosition() { return [10, 100]; }
export function DefaultScale() { return 8.0; }
export function DeviceType() { return "keyboard"; }

/* global
shutdownMode:readonly
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
sideLights:readonly
updatesPerFrame:readonly
*/
export function ControllableParameters() {
	return [
		{ property: "shutdownMode", group: "lighting", label: "On Shutdown", type: "combobox", values: ["Restore onboard lighting", "Shutdown Color"], default: "Restore onboard lighting" },
		{ property: "shutdownColor", group: "lighting", label: "Shutdown Color", type: "color", default: "#000000" },
		{ property: "LightingMode", group: "lighting", label: "Lighting Mode", type: "combobox", values: ["Canvas", "Forced"], default: "Canvas" },
		{ property: "forcedColor", group: "lighting", label: "Forced Color", type: "color", default: "#009bde" },
		{ property: "sideLights", group: "lighting", label: "Side Lights", type: "combobox", values: ["On", "Off"], default: "On" },
		{ property: "updatesPerFrame", group: "lighting", label: "Key updates per frame", type: "combobox", values: ["Auto", "6", "10", "20", "40", "80", "120"], default: "Auto" },
	];
}

// Keys: [name, x, y, LED index 1-104]. Keys are shifted +1,+1 to leave room for the side columns.
const vKeysRaw = [
	["Esc", 1, 0, 92], ["F1", 3, 0, 68], ["F2", 4, 0, 81], ["F3", 5, 0, 82], ["F4", 6, 0, 95],
	["F5", 8, 0, 96], ["F6", 9, 0, 84], ["F7", 10, 0, 97], ["F8", 11, 0, 98],
	["F9", 12, 0, 86], ["F10", 13, 0, 99], ["F11", 14, 0, 87], ["F12", 15, 0, 100],
	["Print Screen", 16, 0, 76], ["Scroll Lock", 17, 0, 89], ["Pause", 18, 0, 102],
	["`", 1, 1, 79], ["1", 2, 1, 80], ["2", 3, 1, 93], ["3", 4, 1, 55], ["4", 5, 1, 56], ["5", 6, 1, 69],
	["6", 7, 1, 70], ["7", 8, 1, 83], ["8", 9, 1, 58], ["9", 10, 1, 71], ["0", 11, 1, 85],
	["-", 12, 1, 73], ["=", 13, 1, 74], ["Backspace", 14, 1, 101],
	["Insert", 16, 1, 37], ["Home", 17, 1, 50], ["Page Up", 18, 1, 63],
	["Tab", 1, 2, 66], ["Q", 2, 2, 54], ["W", 3, 2, 67], ["E", 4, 2, 42], ["R", 5, 2, 30], ["T", 6, 2, 43],
	["Y", 7, 2, 57], ["U", 8, 2, 32], ["I", 9, 2, 45], ["O", 10, 2, 72], ["P", 11, 2, 60],
	["[", 12, 2, 48], ["]", 13, 2, 61], ["\\", 14, 2, 75],
	["Del", 16, 2, 88], ["End", 17, 2, 11], ["Page Down", 18, 2, 24],
	["CapsLock", 1, 3, 53], ["A", 2, 3, 28], ["S", 3, 3, 41], ["D", 4, 3, 29], ["F", 5, 3, 4], ["G", 6, 3, 17],
	["H", 7, 3, 44], ["J", 8, 3, 19], ["K", 9, 3, 46], ["L", 10, 3, 59], [";", 11, 3, 47], ["'", 12, 3, 35],
	["Enter", 14, 3, 62],
	["Left Shift", 1, 4, 40], ["Z", 3, 4, 2], ["X", 4, 4, 15], ["C", 5, 4, 3], ["V", 6, 4, 16], ["B", 7, 4, 18],
	["N", 8, 4, 31], ["M", 9, 4, 6], [",", 10, 4, 20], [".", 11, 4, 33], ["/", 12, 4, 34],
	["Right Shift", 14, 4, 22], ["Up Arrow", 17, 4, 49],
	["Left Ctrl", 1, 5, 1], ["Left Win", 2, 5, 14], ["Left Alt", 3, 5, 27], ["Space", 7, 5, 5],
	["Right Alt", 11, 5, 7], ["Fn", 12, 5, 8], ["Menu", 13, 5, 21], ["Right Ctrl", 14, 5, 9],
	["Left Arrow", 16, 5, 10], ["Down Arrow", 17, 5, 23], ["Right Arrow", 18, 5, 36],
	["G1", 0, 1, 26], ["G2", 0, 2, 39], ["G3", 0, 3, 52], ["G4", 0, 4, 65], ["G5", 0, 5, 78],
];

// Build the full LED list: keys (offset into the grid) + 16 side lights.
// Side slot via 0x93 FF n; key slot via 0x93 group col.
const vLeds = [];
for (const k of vKeysRaw) {
	vLeds.push({ name: k[0], x: k[1] + 1, y: k[2] + 1, side: false, slot: k[3] });
}
for (let n = 0; n < 8; n++) { vLeds.push({ name: `Left Side ${n + 1}`, x: 0, y: n, side: true, slot: n }); }
for (let n = 0; n < 8; n++) { vLeds.push({ name: `Right Side ${n + 1}`, x: 20, y: n, side: true, slot: n + 8 }); }

export function LedNames() { return vLeds.map(l => l.name); }
export function LedPositions() { return vLeds.map(l => [l.x, l.y]); }

// We never read the keyboard back to decide what to resend: the frame buffer (0x13) does not
// reliably reflect which per-LED writes physically landed, and under load the read can fail. Instead
// we keep a shadow of what we last SENT (lastSent) and send only the LEDs whose target changed.
// Every write is echo-confirmed before the next, so nothing is dropped on either stock or patched
// firmware and the shadow stays accurate - static content therefore sends nothing and never
// "reloads". A near-uniform target is painted with a single fill packet (instant, no sweep).
const CHANGE_THRESHOLD = 10;   // treat a colour as changed if any channel moves more than this
const SCRUB_PER_FRAME = 2;     // LEDs re-sent every frame as insurance (usually same colour)
let lastSent = null;           // shadow of the last colour sent per LED (null = unknown)
let scrubPos = 0;

// "Auto" key budget: Initialize times a few per-key commands. Stock firmware takes ~8 ms each (full
// LED refresh per command), 1.07 ~1-2 ms. The firmware version itself is not readable from a plugin
// (getHidInfo() only has report lengths, report 0x10 is a fixed layout table).
const PROBE_COUNT = 16;
const PROBE_STOCK_MS = 4;      // average above this = stock firmware
const BUDGET_FAST = 40;        // firmware 1.07
const BUDGET_STOCK = 6;        // stock firmware: ~50 ms of commands per frame
let autoBudget = BUDGET_STOCK;

export function Validate(endpoint) {
	return endpoint.interface === 0 && endpoint.usage_page === 0xff19 && endpoint.collection === 0x0005;
}

export function Initialize() {
	device.set_endpoint(0, 0xff19, 0xff19, 0x0005);
	cmd([0x91]);
	cmd([0x92, 0, 0, 0, 0, 0, 0]); // known state: everything off
	lastSent = vLeds.map(() => [0, 0, 0]); // matches the black fill above
	scrubPos = 0;
	autoBudget = probeBudget();
	device.log("K596 direct mode on");
}

// Repaint the first keys black (they already are, so nothing visible) and time the echoes.
function probeBudget() {
	const start = Date.now();
	let acked = 0;
	for (let n = 0; n < PROBE_COUNT; n++) {
		if (cmd([0x93, Math.floor(n / 13), n % 13, 0, 0, 0, 0])) { acked++; }
	}
	const ms = (Date.now() - start) / PROBE_COUNT;
	const fast = acked === PROBE_COUNT && ms < PROBE_STOCK_MS;
	device.log(`K596 probe: ${ms.toFixed(1)} ms/command, ${acked}/${PROBE_COUNT} acked -> ` +
		(fast ? `firmware 1.07, auto budget ${BUDGET_FAST}` : `stock firmware, auto budget ${BUDGET_STOCK}`));
	return fast ? BUDGET_FAST : BUDGET_STOCK;
}

export function Render() {
	if (!lastSent) { lastSent = vLeds.map(() => [0, 0, 0]); }
	const sideOn = sideLights !== "Off";
	const want = vLeds.map(l => {
		if (l.side && !sideOn) { return [0, 0, 0]; }
		if (LightingMode === "Forced") { return hexToRgb(forcedColor); }
		return device.color(l.x, l.y);
	});

	let budget = updatesPerFrame === "Auto" ? autoBudget : Math.max(1, Number(updatesPerFrame) || BUDGET_STOCK);

	// Near-uniform KEYS (e.g. a solid colour): one fill paints all keys in a single packet, so a
	// solid-colour change is instant with no visible per-key sweep. The fill (0x92) also sets the 16
	// side lights; the diff below then corrects them if they differ (e.g. side lights off). Uniformity
	// is judged on the keys only, since they are the bulk and the side lights are handled per-LED.
	const sum = [0, 0, 0];
	let nKeys = 0;
	want.forEach((c, i) => { if (!vLeds[i].side) { sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2]; nKeys++; } });
	const mean = sum.map(v => Math.round(v / nKeys));
	let keyErr = 0;
	want.forEach((c, i) => { if (!vLeds[i].side) { keyErr += dist(c, mean); } });
	if (keyErr < nKeys * CHANGE_THRESHOLD) {
		let needFill = false;
		for (let i = 0; i < lastSent.length; i++) { if (!vLeds[i].side && dist(mean, lastSent[i]) > CHANGE_THRESHOLD) { needFill = true; break; } }
		if (needFill) {
			cmd([0x92, 0, 0, 0, mean[0], mean[1], mean[2]]);
			lastSent = lastSent.map(() => mean.slice());
			budget--;
		}
	}

	// Send only the LEDs whose target changed, biggest differences first. Writes are echo-confirmed,
	// so nothing is dropped and lastSent stays accurate - static content sends nothing and never
	// "reloads". Anything over the per-frame budget carries to the next frame.
	const todo = [];
	for (let i = 0; i < want.length; i++) {
		if (dist(want[i], lastSent[i]) > CHANGE_THRESHOLD) { todo.push(i); }
	}
	todo.sort((a, b) => dist(want[b], lastSent[b]) - dist(want[a], lastSent[a]));
	for (let n = 0; n < todo.length && n < budget; n++) { sendLed(todo[n], want[todo[n]]); }

	// Insurance scrub: always re-send a couple of LEDs per frame, cycling through all of them. Usually
	// same-colour (invisible); it repaints anything the keyboard changed on its own, e.g. a held key
	// painted white by stock firmware, which lastSent cannot know about.
	for (let sc = 0; sc < SCRUB_PER_FRAME; sc++) {
		const i = scrubPos;
		scrubPos = (scrubPos + 1) % want.length;
		sendLed(i, want[i]);
	}
}

// lastSent is only updated once the keyboard echoes the command, so a missed write is retried.
function sendLed(i, c) {
	const l = vLeds[i];
	let ok;
	if (l.side) {
		ok = cmd([0x93, 0xff, l.slot, 0, c[0], c[1], c[2]]);
	} else {
		const idx = l.slot - 1;
		ok = cmd([0x93, Math.floor(idx / 13), idx % 13, 0, c[0], c[1], c[2]]);
	}
	if (ok) { lastSent[i] = c.slice(); }
}

export function Shutdown(SystemSuspending) {
	if (SystemSuspending) {
		cmd([0x92, 0, 0, 0, 0, 0, 0]);
	} else if (shutdownMode === "Shutdown Color") {
		const c = hexToRgb(shutdownColor);
		cmd([0x92, 0, 0, 0, c[0], c[1], c[2]]);
	} else {
		cmd([0x90]);
	}
}

// ---------- protocol ----------

// Send and wait for the echo (the firmware drops a command sent before it finished the previous
// one). Returns true if the echo arrived.
function cmd(bytes) {
	const pkt = [0x08].concat(bytes);
	while (pkt.length < 64) { pkt.push(0); }
	device.write(pkt, 64);
	for (let t = 0; t < 4; t++) {
		const r = device.read([0x08], 64, 10);
		if (r && r.length > 1 && ((r[0] === 0x08 && r[1] === bytes[0]) || r[0] === bytes[0])) { return true; }
	}
	return false;
}


// ---------- helpers ----------

function dist(a, b) {
	return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function hexToRgb(hex) {
	const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0];
}

export function ImageUrl() { return "https://raw.githubusercontent.com/peshke/k596-signalrgb/main/signalrgb/k596-rgb.jpeg"; }
