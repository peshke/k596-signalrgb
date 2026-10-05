// SignalRGB plugin - Redragon K596 Vishnu (wired, MosArt 062a:8519, firmware 01.04)
// Uses the firmware's direct RGB mode (found by disassembling the firmware):
//   08 91                      enter direct mode
//   08 92 00 00 00 R G B       fill all LEDs
//   08 93 group col 00 R G B   one LED (group = (index-1)/13, col = (index-1)%13)
//   08 90                      leave direct mode (back to onboard lighting)
// Side lights: 08 93 FF n 00 R G B (n 0-7 left, 8-15 right, top to bottom).
// The firmware handles about one command per ~8 ms, so each frame sends a fill when it helps
// and then corrects the keys with the largest error, verified against the frame buffer (feature 0x13).
// Nothing is written to flash.

export function Name() { return "Redragon K596 Vishnu"; }
export function VendorId() { return 0x062a; }
export function ProductId() { return 0x8519; }
export function Publisher() { return "Custom"; }
export function Size() { return [19, 6]; }
export function DefaultPosition() { return [10, 100]; }
export function DefaultScale() { return 8.0; }
export function DeviceType() { return "keyboard"; }

/* global
shutdownMode:readonly
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
updatesPerFrame:readonly
sideLights:readonly
*/
export function ControllableParameters() {
	return [
		{ property: "shutdownMode", group: "lighting", label: "On Shutdown", type: "combobox", values: ["Restore onboard lighting", "Shutdown Color"], default: "Restore onboard lighting" },
		{ property: "shutdownColor", group: "lighting", label: "Shutdown Color", type: "color", default: "#000000" },
		{ property: "LightingMode", group: "lighting", label: "Lighting Mode", type: "combobox", values: ["Canvas", "Forced"], default: "Canvas" },
		{ property: "forcedColor", group: "lighting", label: "Forced Color", type: "color", default: "#009bde" },
		{ property: "sideLights", group: "lighting", label: "Side Lights", type: "combobox", values: ["Canvas", "Off"], default: "Canvas" },
		{ property: "updatesPerFrame", group: "lighting", label: "Key updates per frame", type: "number", min: "1", max: "30", default: "6" },
	];
}

// [name, x, y, LED index (1-104)]
const vKeys = [
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

// Side lights: 16 slots after the 104 key slots, set with 08 93 FF n 00 R G B.
// Slots 0-7 = left side top to bottom, 8-15 = right side top to bottom.
// Each side is its own subdevice, so it can be placed, resized or removed on the canvas.
const SIDES = [
	{ id: "K596LeftSide", name: "Left Side Light", base: 0 },
	{ id: "K596RightSide", name: "Right Side Light", base: 8 },
];
let sidesActive = false;
let sideState = new Array(16).fill(null).map(() => [0, 0, 0]); // cannot be read back: track what was sent

function createSides() {
	for (const s of SIDES) {
		device.createSubdevice(s.id);
		device.setSubdeviceName(s.id, s.name);
		device.setSubdeviceSize(s.id, 1, 8);
		device.setSubdeviceLeds(s.id, [...Array(8).keys()].map(n => `${s.name} ${n + 1}`), [...Array(8).keys()].map(n => [0, n]));
	}
	sidesActive = true;
}

function removeSides() {
	for (const s of SIDES) { device.removeSubdevice(s.id); }
	sidesActive = false; // Render turns them off (target black) within the normal update budget
}

export function onsideLightsChanged() {
	if (sideLights === "Canvas" && !sidesActive) { createSides(); }
	if (sideLights !== "Canvas" && sidesActive) { removeSides(); }
}

function setSide(n, c) {
	cmd([0x93, 0xff, n, 0, c[0], c[1], c[2]]);
	sideState[n] = c.slice();
}

// Unified list: keys (read back from the keyboard) + the 16 side lights (black while disabled)
const vLeds = vKeys.map(k => ({ side: false, slot: k[3], x: k[1], y: k[2] }))
	.concat(SIDES.flatMap(s => [...Array(8).keys()].map(n => ({ side: true, slot: s.base + n, sub: s.id, y: n }))));

export function LedNames() { return vKeys.map(k => k[0]); }
export function LedPositions() { return vKeys.map(k => [k[1], k[2]]); }

export function Validate(endpoint) {
	return endpoint.interface === 0 && endpoint.usage_page === 0xff19 && endpoint.collection === 0x0005;
}

const MIN_ERROR = 12;      // ignore differences smaller than this (sum of |dR|+|dG|+|dB|)

export function Initialize() {
	device.set_endpoint(0, 0xff19, 0xff19, 0x0005);
	cmd([0x91]);
	cmd([0x92, 0, 0, 0, 0, 0, 0]); // known state: everything off, incl. side lights
	sideState = sideState.map(() => [0, 0, 0]);
	if (sideLights === "Canvas") { createSides(); }
	device.log("K596 direct mode on");
}

export function Render() {
	const want = vLeds.map(l => {
		if (l.side && !sidesActive) { return [0, 0, 0]; }
		if (LightingMode === "Forced") { return hexToRgb(forcedColor); }
		return l.side ? device.subdeviceColor(l.sub, 0, l.y) : device.color(l.x, l.y);
	});
	const keys = readFrame();
	if (!keys) { return; }
	let k = 0;
	const have = vLeds.map(l => (l.side ? sideState[l.slot] : keys[k++]));

	let errNow = 0;
	const sum = [0, 0, 0];
	want.forEach((c, i) => {
		errNow += dist(c, have[i]);
		sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2];
	});
	const mean = sum.map(v => Math.round(v / want.length));
	const errFill = want.reduce((a, c) => a + dist(c, mean), 0);

	let budget = Math.max(1, Number(updatesPerFrame));
	if (errNow > MIN_ERROR * 4 && errFill < errNow * 0.5) {
		cmd([0x92, 0, 0, 0, mean[0], mean[1], mean[2]]);
		for (let i = 0; i < have.length; i++) { have[i] = mean; }
		sideState = sideState.map(() => mean.slice()); // the fill also sets the side lights
		budget--;
	}

	const order = want.map((c, i) => [dist(c, have[i]), i])
		.filter(e => e[0] >= MIN_ERROR)
		.sort((a, b) => b[0] - a[0]);
	for (let n = 0; n < order.length && n < budget; n++) {
		const i = order[n][1];
		const l = vLeds[i];
		const c = want[i];
		if (l.side) {
			setSide(l.slot, c);
		} else {
			const idx = l.slot - 1;
			cmd([0x93, Math.floor(idx / 13), idx % 13, 0, c[0], c[1], c[2]]);
		}
	}
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

function cmd(bytes) {
	const pkt = [0x08].concat(bytes);
	while (pkt.length < 64) { pkt.push(0); }
	device.write(pkt, 64);
	// wait for the echo: the firmware drops commands sent before it finished the previous one
	for (let t = 0; t < 4; t++) {
		const r = device.read([0x08], 64, 10);
		if (r && r.length > 1 && ((r[0] === 0x08 && r[1] === bytes[0]) || r[0] === bytes[0])) { return; }
	}
}

function readFrame() {
	const rep = device.get_report([0x13], 366);
	if (!rep || rep.length < 313) { return null; }
	return vKeys.map(k => [rep[k[3]], rep[k[3] + 104], rep[k[3] + 208]]);
}

// ---------- helpers ----------

function dist(a, b) {
	return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function hexToRgb(hex) {
	const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0];
}

export function ImageUrl() { return ""; }
