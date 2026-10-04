# Firmware notes

## Image

| Item | Value |
|---|---|
| File | `ET-8408-MA0850T-200317-1.00-0104-01EB.hex` (shipped next to the K596RGB 1.0.0.3 installer, also embedded in `Redragon Gaming Software.exe`) |
| CPU | 65C02 (MosArt MA0850) |
| Address range | `0x8000`-`0xE97F` (the region above, incl. vectors and bootloader, is not part of the update) |
| Header `0x8000`-`0x8003` | 32-bit little-endian sum of all bytes `0x8004`..end |
| Header `0x8004`-`0x8005` | end address (`0xE97F`) |
| `0x802B` | chip ID string `ET-8408-MA0850T` |
| `0x803C` | version string `01.04` |
| `0xDFBD` | USB device descriptor `bcdDevice` (`04 01` = 1.04) |
| File name `...-VVVV-CCCC.hex` | `VVVV` = version, `CCCC` = 16-bit sum over the full 64 KB space with unprogrammed bytes as `0xFF` |

## Useful locations

| Address | What |
|---|---|
| `0x9762` | output report `0x08` command dispatcher (jump table at `0x9765`) |
| `0x98A5` / `0x98B2` | `0x91` / `0x90` direct mode on / off (`$3D` = direct mode flag) |
| `0x98BA` | `0x92` fill |
| `0x9919` | `0x93` set LED / color table entry |
| `0xA304` | USB SET_REPORT handling (feature `0x06` password check at `0xA3B1`) |
| `0xC85C` | write one LED into the frame buffer (`$13E0` R / `$1448` G / `$14B0` B, 104 bytes each) |
| `0xCB59` | in direct mode, jump to `0xCDA1` |
| `0xCDA1` | in direct mode: paint every currently pressed key (`$17CA`..`$17D6` bitmap) white |
| `0xE69C` | custom-mode palette (planar R / G / B tables) |

## Patch (firmware 1.05)

```
0xCB59  A5 3D     LDA $3D        ; direct mode flag
0xCB5B  D0 0D     BNE $CB6A      ; -> JMP $CDA1 (paint held keys white)
        D0 2C     BNE $CB89      ; patched: -> RTS
```

`$CB6A` is a tail jump (`JMP $CDA1`, which ends in `RTS`), so branching straight to the function's
own `RTS` at `$CB89` leaves the stack balanced. Outside direct mode nothing changes.

Changed bytes compared with 1.04:

| Address | 1.04 | 1.05 | Reason |
|---|---|---|---|
| `0xCB5C` | `0D` | `2C` | the fix |
| `0x8040` | `34` ('4') | `35` ('5') | version string |
| `0xDFBD` | `04` | `05` | USB `bcdDevice` |
| `0x8000` | `95 17 2A 00` | `B6 17 2A 00` | header checksum |

## Official software (Redragon Gaming Software 1.0.0.3)

* The firmware it flashes is **embedded in the exe** (file offset `0x2A6518`, `0xE980` bytes, CPU
  addresses `0x0000`-`0xE97F`). The separate `.hex` in the download is not read.
* Its version comes from a built-in file name string (3 copies).
* UPDATE is only enabled when the device version is lower than the built-in version
  (VA `0x427CF8`: `cmp` / `jge`), and the built-in version is within `0x100`-`0x199`.
* Before flashing it checks the image: chip ID, version string = version in the name, header
  checksum, end address range (routine at VA `0x436C80`).
* The flash process is: initialise, write, **verify**, reboot.

[`tools/patch_software.py`](../tools/patch_software.py) builds the flashing programs from your own
copy of the exe: it replaces the `jge` at file offset `0x272FA` with `NOP NOP` (UPDATE always
offered), replaces the embedded image and updates the 3 name strings.

## Other K596 hardware

Redragon has sold several boards under the K596 name. This project only applies to the MosArt
MA0850 version (`062A:8519`, software shows `FW: 1.04`). The updaters found in other Redragon
packages are for different chips: `KB-UPDATE-0105.exe` (Sonix SN8F2250) and the K596RGB-PRO
`Update.exe` (Sinowealth SH68F073). **Do not use them on this keyboard.**
