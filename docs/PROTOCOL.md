# K596 USB protocol (wired, 062a:8519, firmware 1.04/1.06)

Everything below was reverse engineered from USB captures of the official software and from a
disassembly of the firmware. Tested on firmware 1.04 and the patched 1.05/1.06.

## Device

| Item | Value |
|---|---|
| VID / PID (wired) | `062A` / `8519` |
| VID / PID (2.4 GHz dongle) | `062A` / `38B3` (not supported yet, see [WIRELESS.md](WIRELESS.md)) |
| MCU | MosArt MA0850 (65C02 core), firmware ID `ET-8408-MA0850T` |
| Vendor interface | interface 0, usage page `0xFF19`, usage `0xFF19`, **collection 5** (Windows `Col05`, SignalRGB `0x0005`) |
| Command report | output report `0x08`, 64 bytes incl. report ID; every command is echoed on interrupt IN (report `0x08`, same command byte) |

Collection 6 (`0xFF19`, report `0x09`) is not used by the lighting code.

## Timing (important)

The firmware keeps a single command buffer and processes roughly **one command every ~8 ms**.
Commands sent before the previous one has been processed are silently lost. Always wait for the
echo of a command before sending the next one. This limits per-key updates to about 130 LEDs/s
(a full 101-LED frame takes ~775 ms).

## Output report 0x08 - command table

Dispatcher at firmware `0x9762` (`$1075` = command byte = packet byte 1).

| Cmd | Packet (bytes after `08`) | Function |
|---|---|---|
| `01` | `01` | status / settings readback in the echo |
| `02` | `02` | begin flash write session |
| `03` | `03 lo hi len` | read flash (`len` = `0x3B`) |
| `04`, `05` | `05 lo hi len data...` | write data block at address (settings at `0x0000`, per-key table at `0x0100`) |
| `07` | `07` | end flash write session (keyboard reinitialises, next command may fail once) |
| `21` / `22` | `21` ... `22 00 00 02` | live-update bracket used by the official software |
| `23`, `71` | | not analysed |
| **`90`** | `90` | **leave direct mode** (back to onboard lighting) |
| **`91`** | `91` | **enter direct mode** (effects stopped, frame buffer cleared) |
| **`92`** | `92 00 00 00 R G B` | **fill** all LEDs with one RGB color (skips keys currently flagged as pressed) |
| **`93`** | `93 group col 00 R G B` | **set one LED** to any RGB color, `group = (index-1)/13`, `col = (index-1)%13` |
| `93` | `93 FF n 00 R G B` | set **side light** `n` (0-7 left side top to bottom, 8-15 right side top to bottom; LED outputs 104-119, not affected by the brightness setting) |
| `A0` | `A0` | not analysed |

Direct mode (`0x91`-`0x93`) is never used by the official software. On stock firmware 1.04 it
paints any key that is held down white (see [FIRMWARE.md](FIRMWARE.md)); firmware 1.06 (patched)
removes that.

## Feature reports

| ID | Size (incl. ID) | Direction | Content |
|---|---|---|---|
| `0x10` | 8 | read | device info |
| `0x11` | 257 | read | key matrix map |
| `0x12` | 109 | read | key matrix map |
| `0x13` | 366 | read | **live frame buffer**: R = byte `i`, G = byte `i+104`, B = byte `i+208`, `i` = LED index 1-104 |
| `0x14` | 25 | read | settings (24 bytes, see below) |
| `0x15` | 107 | read | per-key palette table (custom mode), bytes 105-106 = checksum |
| `0x16` | 2 | read | `01` = ready (polled by the software after writing `0x20`) |
| `0x17` | 2 | read/write | flag |
| `0x18` | 6 | write | direct mode only (stock firmware): the 5 indicator LEDs (Num, Caps, Scroll, 2 more), `0x80` = on. Ignored with firmware 1.06, which shows the real lock state |
| `0x20` | 105 | write | per-key palette values (custom mode), inside the `21`/`22` bracket |
| `0x05` | 135 | - | not analysed |
| **`0x06`** | 8 | write | **firmware update unlock (8-step password). Never send this.** |

SET_FEATURE on `0x13` is rejected (STALL).

## Settings (report 0x14 / flash address 0x0000)

24 bytes = 22 data bytes + 16-bit little-endian checksum `0x8032 + sum(data)`.

| Byte | Meaning |
|---|---|
| 2 | brightness 1-5 |
| 5 | custom profile (`07` = per-key custom) |
| 15 | per-key custom mode flag |
| 3, 17 | checked by the key-press effect code |

Settings writes (`21` / `05 00 00 18 ...` / `22 00 00 02`) stall the keyboard for a moment and
appear to be stored in flash. Do not use them for animation.

## Custom (palette) mode

The palette is a fixed table in firmware (`0xE69C`): `1` red, `2` orange `FF5500`, `3` yellow,
`4` green, `5` cyan, `6` blue, `7` magenta, `8` white, `0` off. Live per-key updates in this mode:
`08 21` -> SET_FEATURE `0x20` -> poll `0x16` until `01` -> `08 22 00 00 02`.
Direct mode replaces all of this and supports full RGB.

## LED index map

Indices 91, 94, 104 have no LED. `group`/`col` are the values used by command `0x93`.

| Index | Group | Col | Key |
|---|---|---|---|
| 1 | 0 | 0 | `Left Ctrl` |
| 2 | 0 | 1 | `Z` |
| 3 | 0 | 2 | `C` |
| 4 | 0 | 3 | `F` |
| 5 | 0 | 4 | `Space` |
| 6 | 0 | 5 | `M` |
| 7 | 0 | 6 | `Right Alt` |
| 8 | 0 | 7 | `Fn` |
| 9 | 0 | 8 | `Right Ctrl` |
| 10 | 0 | 9 | `Left Arrow` |
| 11 | 0 | 10 | `End` |
| 14 | 1 | 0 | `Left Win` |
| 15 | 1 | 1 | `X` |
| 16 | 1 | 2 | `V` |
| 17 | 1 | 3 | `G` |
| 18 | 1 | 4 | `B` |
| 19 | 1 | 5 | `J` |
| 20 | 1 | 6 | `,` |
| 21 | 1 | 7 | `Menu` |
| 22 | 1 | 8 | `Right Shift` |
| 23 | 1 | 9 | `Down Arrow` |
| 24 | 1 | 10 | `Page Down` |
| 26 | 1 | 12 | `G1` |
| 27 | 2 | 0 | `Left Alt` |
| 28 | 2 | 1 | `A` |
| 29 | 2 | 2 | `D` |
| 30 | 2 | 3 | `R` |
| 31 | 2 | 4 | `N` |
| 32 | 2 | 5 | `U` |
| 33 | 2 | 6 | `.` |
| 34 | 2 | 7 | `/` |
| 35 | 2 | 8 | `'` |
| 36 | 2 | 9 | `Right Arrow` |
| 37 | 2 | 10 | `Insert` |
| 39 | 2 | 12 | `G2` |
| 40 | 3 | 0 | `Left Shift` |
| 41 | 3 | 1 | `S` |
| 42 | 3 | 2 | `E` |
| 43 | 3 | 3 | `T` |
| 44 | 3 | 4 | `H` |
| 45 | 3 | 5 | `I` |
| 46 | 3 | 6 | `K` |
| 47 | 3 | 7 | `;` |
| 48 | 3 | 8 | `[` |
| 49 | 3 | 9 | `Up Arrow` |
| 50 | 3 | 10 | `Home` |
| 52 | 3 | 12 | `G3` |
| 53 | 4 | 0 | `CapsLock` |
| 54 | 4 | 1 | `Q` |
| 55 | 4 | 2 | `3` |
| 56 | 4 | 3 | `4` |
| 57 | 4 | 4 | `Y` |
| 58 | 4 | 5 | `8` |
| 59 | 4 | 6 | `L` |
| 60 | 4 | 7 | `P` |
| 61 | 4 | 8 | `]` |
| 62 | 4 | 9 | `Enter` |
| 63 | 4 | 10 | `Page Up` |
| 65 | 4 | 12 | `G4` |
| 66 | 5 | 0 | `Tab` |
| 67 | 5 | 1 | `W` |
| 68 | 5 | 2 | `F1` |
| 69 | 5 | 3 | `5` |
| 70 | 5 | 4 | `6` |
| 71 | 5 | 5 | `9` |
| 72 | 5 | 6 | `O` |
| 73 | 5 | 7 | `-` |
| 74 | 5 | 8 | `=` |
| 75 | 5 | 9 | `\` |
| 76 | 5 | 10 | `Print Screen` |
| 78 | 5 | 12 | `G5` |
| 79 | 6 | 0 | ``` |
| 80 | 6 | 1 | `1` |
| 81 | 6 | 2 | `F2` |
| 82 | 6 | 3 | `F3` |
| 83 | 6 | 4 | `7` |
| 84 | 6 | 5 | `F6` |
| 85 | 6 | 6 | `0` |
| 86 | 6 | 7 | `F9` |
| 87 | 6 | 8 | `F11` |
| 88 | 6 | 9 | `Del` |
| 89 | 6 | 10 | `Scroll Lock` |
| 92 | 7 | 0 | `Esc` |
| 93 | 7 | 1 | `2` |
| 95 | 7 | 3 | `F4` |
| 96 | 7 | 4 | `F5` |
| 97 | 7 | 5 | `F7` |
| 98 | 7 | 6 | `F8` |
| 99 | 7 | 7 | `F10` |
| 100 | 7 | 8 | `F12` |
| 101 | 7 | 9 | `Backspace` |
| 102 | 7 | 10 | `Pause` |
