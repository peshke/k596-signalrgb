# 2.4 GHz wireless (planned for v2)

Not supported yet. What is known so far:

| Item | Wired | 2.4 GHz dongle |
|---|---|---|
| VID / PID | `062A` / `8519` | `062A` / `38B3` |
| Vendor interface | interface 0, Col05 | interface 1, Col04 (`MI_01&Col04`) |
| Usage page / usage | `0xFF19` / `0xFF19` | `0xFF41` / `0xFF41` |

## Open questions

1. Does the dongle forward output report `0x08` (and its echo) to the keyboard, and with which
   report ID and length? Capture the official software with the keyboard on the dongle.
2. Are the direct-mode commands `0x90`-`0x93` passed through, and what is the round-trip time per
   command over the radio? Over the cable it is ~8 ms; if wireless is much slower, the plugin will
   need a lower update budget (fill-heavy, fewer per-key updates).
3. Does the dongle have its own firmware (a second MosArt chip) that filters commands?
4. Power: does direct mode keep the radio or LEDs awake and affect battery life?

## Suggested first steps

1. List the dongle's HID collections (`hid.enumerate(0x062A, 0x38B3)`) and their report
   descriptors (Wireshark/USBPcap, re-plug the dongle while capturing).
2. Capture the official software changing a key color over the dongle.
3. Try `08 91` / `08 92 00 00 00 R G B` on the vendor collection and check the echo.
