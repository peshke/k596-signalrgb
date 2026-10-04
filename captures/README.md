# Captures

`official-app-esc-red-green.pcapng` - USBPcap capture of the official Redragon Gaming Software
1.0.0.3 talking to the K596 (wired, `062A:8519`, firmware 1.04). Open it in Wireshark.

Cleaned before publishing: only the keyboard's traffic is kept (control transfers and the `0x08`
command echoes on interrupt IN); key input reports, other USB devices and host/OS metadata were
removed. `official-app-esc-red-green.txt` is a decoded list of all HID SET/GET_REPORT requests.

Note: the official software never uses direct mode (`0x90`-`0x93`); those commands come from the
firmware analysis, see [../docs/PROTOCOL.md](../docs/PROTOCOL.md).

## Timeline (seconds from the start of the file)

| Time | What happens |
|---|---|
| 0.00 | keyboard re-plugged: USB enumeration incl. HID report descriptor |
| 0.16 - 1.08 | software start: reads feature `0x10`, `0x11`, `0x12`, `0x14`, `0x15`, reads flash (`08 03 ...`), writes settings (`08 21` / `08 05 00 00 18 ...` / `08 22 00 00 02`) |
| 6.11 | settings write again (mode selected in the software) |
| 15.90 | **Esc set to red** in custom mode: `08 21` -> SET_FEATURE `0x20` (Esc = byte 92 = `01`) -> GET_FEATURE `0x16` -> `08 22 00 00 02` |
| 17.04 | **Apply**: flash write of the per-key table (`08 01`, `08 02`, `08 05 00 01 3b ...`, `08 05 3b 01 2f ...`, `08 07`) |
| 24.86 | preview with Esc off |
| 26.13 | **Esc set to green** (`04`) |
| 26.90 | **Apply**: flash write again |
| whole capture | GET_FEATURE `0x13` (live frame buffer) about 16 times per second for the on-screen preview |
