#!/usr/bin/env python3
"""
Diagnostic tool for the Redragon K596 Vishnu (wired, 062a:8519, MosArt MA0850).
Requires: Python 3, pip install hidapi. Close the Redragon software and SignalRGB first.

  python k596_tool.py info              firmware / settings / per-key table (read-only)
  python k596_tool.py dump NAME         save readable feature reports to k596_NAME.json (read-only)
  python k596_tool.py diff A B          compare two dumps
  python k596_tool.py fill RRGGBB       direct mode, fill all keys with one color
  python k596_tool.py rainbow           direct mode, per-key rainbow + speed measurement
  python k596_tool.py side              direct mode, light the 16 side-LED slots one by one
  python k596_tool.py exit              leave direct mode (back to onboard lighting)

Never send feature report 0x06: it is the firmware-update unlock sequence.
"""
import json
import sys
import time

import hid

VID, PID = 0x062A, 0x8519
EMPTY_SLOTS = {91, 94, 104}
KEY_SLOTS = [i for i in range(1, 105) if i not in EMPTY_SLOTS]


def connect():
    d = next((x for x in hid.enumerate(VID, PID) if b"&Col05" in x["path"] or b"&col05" in x["path"]), None)
    if d is None:
        sys.exit("K596 (wired) not found. Is it connected by cable?")
    h = hid.device()
    h.open_path(d["path"])
    h.set_nonblocking(1)
    return h


def cmd(h, *b, timeout=0.05):
    """Output report 0x08 (64 bytes), then wait for the echo. The firmware drops commands
    sent before it has finished the previous one (~8 ms each)."""
    pkt = [0x08] + list(b)
    h.write(pkt + [0] * (64 - len(pkt)))
    end = time.time() + timeout
    while time.time() < end:
        rep = h.read(64)
        if rep and len(rep) > 1 and rep[0] == 0x08 and rep[1] == b[0]:
            return True
        time.sleep(0.0005)
    return False


def led(h, index, r, g, b):
    return cmd(h, 0x93, (index - 1) // 13, (index - 1) % 13, 0, r, g, b)


def read_frame(h):
    rep = h.get_feature_report(0x13, 520)
    return {i: (rep[i], rep[i + 104], rep[i + 208]) for i in KEY_SLOTS}


def info():
    h = connect()
    st = list(h.get_feature_report(0x14, 520))[1:25]
    print("settings 0x14 :", bytes(st).hex(" "))
    print("  brightness  :", st[2], "(1-5)")
    print("  checksum ok :", int.from_bytes(bytes(st[22:24]), "little") == 0x8032 + sum(st[:22]))
    print("report 0x10   :", bytes(h.get_feature_report(0x10, 520)).hex(" "))
    esc = read_frame(h)[92]
    print("Esc RGB now   :", "%02x%02x%02x" % esc)
    h.close()


def dump(name):
    h = connect()
    out = {f"{r:02x}": bytes(h.get_feature_report(r, 520)).hex() for r in range(0x10, 0x18)}
    h.close()
    json.dump(out, open(f"k596_{name}.json", "w"), indent=1)
    print(f"saved k596_{name}.json")


def diff(a, b):
    A, B = json.load(open(f"k596_{a}.json")), json.load(open(f"k596_{b}.json"))
    for r in A:
        x, y = bytes.fromhex(A[r]), bytes.fromhex(B[r])
        for i in range(min(len(x), len(y))):
            if x[i] != y[i]:
                print(f"report 0x{r} byte {i}: {x[i]:02x} -> {y[i]:02x}")


def fill(hexcolor):
    r, g, b = bytes.fromhex(hexcolor)
    h = connect()
    cmd(h, 0x91)
    cmd(h, 0x92, 0, 0, 0, r, g, b)
    h.close()
    print("direct mode on; run 'exit' to return to onboard lighting")


def rainbow():
    import colorsys
    h = connect()
    cmd(h, 0x91)
    t = time.time()
    missed = 0
    for n, i in enumerate(KEY_SLOTS):
        r, g, b = (int(c * 255) for c in colorsys.hsv_to_rgb(n / len(KEY_SLOTS), 1, 1))
        if not led(h, i, r, g, b):
            missed += 1
    dt = time.time() - t
    time.sleep(0.05)
    frame = read_frame(h)
    print(f"{len(KEY_SLOTS)} LEDs in {dt * 1000:.0f} ms ({1 / dt:.1f} full frames/s), no echo: {missed}")
    print("Esc readback:", "%02x%02x%02x" % frame[92])
    h.close()


def side():
    """Side LEDs are 16 extra slots after the 104 key slots, set with 08 93 FF n 00 R G B."""
    h = connect()
    cmd(h, 0x91)
    cmd(h, 0x92, 0, 0, 0, 0, 0, 0)  # everything off
    for n in range(16):
        for m in range(16):
            cmd(h, 0x93, 0xFF, m, 0, *((255, 0, 0) if m == n else (0, 0, 0)))
        input(f"side LED {n:2d} lit red - which light is it? (Enter for next) ")
    for m in range(16):
        cmd(h, 0x93, 0xFF, m, 0, 0, 0, 255)
    input("all 16 side slots blue - Enter to exit direct mode ")
    cmd(h, 0x90)
    h.close()


def leave():
    h = connect()
    cmd(h, 0x90)
    h.close()


COMMANDS = {"info": info, "dump": dump, "diff": diff, "fill": fill, "rainbow": rainbow, "side": side, "exit": leave}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        sys.exit(__doc__)
    COMMANDS[sys.argv[1]](*sys.argv[2:])
