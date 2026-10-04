#!/usr/bin/env python3
"""
Builds modified copies of the official Redragon K596RGB software (v1.0.0.3) that can
flash the patched firmware. Nothing from Redragon is redistributed: you supply your own
copy of "Redragon Gaming Software.exe" and this script patches it locally.

Outputs (written next to the input file):
  K596 FLASH original 1.04.exe   original firmware 1.04, UPDATE always enabled (dry run / restore)
  K596 FLASH patch 1.05.exe      firmware 1.05 = 1.04 + direct-mode key-press fix, UPDATE always enabled

Usage:
  python patch_software.py "C:\\Redragon Gaming Software\\Redragon Gaming Software.exe"
"""
import hashlib
import sys
from pathlib import Path

SRC_SHA256 = "25e3053139b19cf4c3e9b49266a1033c1f4a1d553671f8d854183df3bb78347f"
OUT_SHA256 = {
    "K596 FLASH original 1.04.exe": "20e2f59c1de4067a95150f16b0e747605531c8543d8535091fc0e487b2938926",
    "K596 FLASH patch 1.05.exe": "010db22caf67a8313225777e39e98b572e5695d91ebd955a1cd40e3b7312c1a6",
}

IMG_OFF = 0x2A6518   # file offset of the embedded firmware buffer (CPU address 0x0000-0xE97F)
IMG_LEN = 0xE980
JGE_OFF = 0x272FA    # "device version >= built-in version -> no update" (VA 0x427CFA)
OLD_NAME = b"ET-8408-MA0850T-200317-1.00-0104-01EB.hex"


def build_image(orig: bytes, version: int, fix: bool) -> bytearray:
    img = bytearray(orig)
    assert img[0x803C:0x8041] == b"01.04" and img[0xDFBD:0xDFBF] == b"\x04\x01"
    assert img[0xCB5B:0xCB5D] == b"\xD0\x0D"
    if version != 0x0104 or fix:
        img[0x803C:0x8041] = f"{version >> 8:02X}.{version & 0xFF:02X}".encode()  # version text
        img[0xDFBD:0xDFBF] = version.to_bytes(2, "little")                    # USB bcdDevice
        if fix:
            img[0xCB5C] = 0x2C  # BNE $CB6A (paint held keys white) -> BNE $CB89 (RTS)
        img[0x8000:0x8004] = sum(img[0x8004:IMG_LEN]).to_bytes(4, "little")    # header checksum
    return img


def name_checksum(img: bytes) -> int:
    # 16-bit sum over the full 64 KB address space, unprogrammed bytes counted as 0xFF
    return (sum(img) + 0xFF * (0x10000 - IMG_LEN)) & 0xFFFF


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    raw = src.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SRC_SHA256:
        sys.exit("Unexpected input file. Only 'Redragon Gaming Software.exe' from the "
                 "K596RGB 1.0.0.3 installer is supported.")
    assert raw.count(OLD_NAME) == 3 and raw[JGE_OFF:JGE_OFF + 2] == b"\x7D\x07"

    orig = raw[IMG_OFF:IMG_OFF + IMG_LEN]
    for out_name, version, fix in (("K596 FLASH original 1.04.exe", 0x0104, False),
                                   ("K596 FLASH patch 1.05.exe", 0x0105, True)):
        img = build_image(orig, version, fix)
        new_name = f"ET-8408-MA0850T-200317-1.00-{version:04X}-{name_checksum(img):04X}.hex".encode()
        out = bytearray(raw.replace(OLD_NAME, new_name))
        out[IMG_OFF:IMG_OFF + IMG_LEN] = img
        out[JGE_OFF:JGE_OFF + 2] = b"\x90\x90"  # always offer UPDATE
        digest = hashlib.sha256(out).hexdigest()
        if digest != OUT_SHA256[out_name]:
            sys.exit(f"Self-check failed for {out_name}, nothing written.")
        (src.parent / out_name).write_bytes(out)
        print(f"wrote {src.parent / out_name}  sha256 {digest}")


if __name__ == "__main__":
    main()
