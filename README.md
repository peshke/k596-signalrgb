# Redragon K596 Vishnu - SignalRGB plugin, protocol and firmware fix

Full per-key RGB control of the **Redragon K596 Vishnu (MosArt version, USB `062A:8519`)** in
SignalRGB, using a hidden direct RGB mode in the keyboard's firmware that the official software
never uses. Plus a one-byte firmware fix and complete protocol documentation.

## What works

| Feature | Status |
|---|---|
| SignalRGB per-key RGB (any color) | ✅ wired |
| Side lights (16, left and right) | ✅ as two separate canvas components, can be removed or switched off |
| Smooth fades / solid colors | ✅ (one fill command per frame) |
| Complex per-key effects | ✅ with limited speed (~130 key updates/s, firmware limit) |
| No flash writes during effects | ✅ |
| Held keys turning white in direct mode | fixed by firmware 1.06 (optional) |
| Num/Caps/Scroll Lock indicators off in direct mode | fixed by firmware 1.06 (optional) |
| 2.4 GHz dongle | planned, see [docs/WIRELESS.md](docs/WIRELESS.md) |
| OpenRGB | planned, see [docs/OPENRGB.md](docs/OPENRGB.md) |

## Check your keyboard first

Redragon has sold several different boards as "K596". This project is **only** for the version
with:

* USB ID `062A:8519` when wired (Device Manager -> keyboard -> Details -> Hardware Ids)
* Official software `Redragon Gaming Software K596RGB 1.0.0.3`, showing `FW: 1.04`

The official software is on Redragon's software page <https://redragonshop.com/pages/software>:
search for `vishnu`, open **VISHNU K596 Pro Wireless Keyboard** and download **Software (Dual Mode)**.
Direct link: <https://cdn.shopify.com/s/files/1/0012/4957/4961/files/Redragon_K596RGB_Keyboard_Software_99614b56-7986-4aa2-b062-beae835d5d03.zip?v=1727257837>
The zip contains `Redragon Gaming Software K596RGB 1.0.0.3 Setup.exe`. It is not included in this repository.

## SignalRGB plugin

1. Close the Redragon software (including the tray icon).
2. Copy [`signalrgb/Redragon_K596_Vishnu.js`](signalrgb/Redragon_K596_Vishnu.js) to
   `%USERPROFILE%\Documents\WhirlwindFX\Plugins\`.
3. Connect the keyboard by cable and restart SignalRGB.

Device settings:

| Setting | Meaning |
|---|---|
| Key updates per frame | per-key corrections per frame (default 6). Higher = faster catch-up, more time per frame |
| Lighting Mode | Canvas / Forced color |
| Side Lights | Canvas = left/right side lights as separate components on the canvas, Off = side lights dark |
| On Shutdown | restore onboard lighting, or a fixed color |

How it works: each frame the plugin reads the real LED colors back from the keyboard, sends one
fill command when that gets the whole keyboard closer to the target, then corrects the keys with
the largest error. On stock firmware 1.04, held keys flash white and are repainted after release;
with firmware 1.06 they keep their color. Stock firmware also turns the lock indicators off
while SignalRGB is running; firmware 1.06 keeps them working.

## Firmware 1.06 (optional)

Fixes two stock-firmware behaviours in direct mode: held keys painted white, and the
Num/Caps/Scroll Lock indicators switched off. Built locally from your own copy of the
official software, nothing from Redragon is redistributed here. Read
[docs/FLASHING.md](docs/FLASHING.md) before doing anything.

## Repository

| Path | Content |
|---|---|
| `signalrgb/Redragon_K596_Vishnu.js` | SignalRGB plugin |
| `tools/patch_software.py` | builds the flashing programs (original 1.04 / patched 1.06) from your official exe |
| `tools/k596_tool.py` | diagnostics: settings, dumps, direct-mode fill / rainbow test |
| `docs/PROTOCOL.md` | USB protocol, commands, reports, timing, LED map |
| `captures/` | cleaned USB capture of the official software (Wireshark) + decoded request list |
| `docs/FIRMWARE.md` | firmware layout, checksums, patch details, official software internals |
| `docs/FLASHING.md` | flashing guide |
| `docs/WIRELESS.md` | notes for 2.4 GHz support |
| `docs/OPENRGB.md` | plan for native OpenRGB support |

## Roadmap

1. 2.4 GHz dongle support in the SignalRGB plugin ([docs/WIRELESS.md](docs/WIRELESS.md))
2. Native OpenRGB controller, submitted upstream ([docs/OPENRGB.md](docs/OPENRGB.md))

## Safety

* Never send HID feature report `0x06`: it is the firmware update unlock sequence.
* Do not use `KB-UPDATE-0105.exe` (Sonix) or the K596RGB-PRO `Update.exe` (Sinowealth) on this
  keyboard, they are for different chips.
* Flashing firmware is at your own risk.

## License

Code and documentation: MIT, see [LICENSE](LICENSE). Redragon software and firmware are not
included and remain the property of their owners. Not affiliated with Redragon or SignalRGB.
