# Flashing firmware 1.07

Flashing firmware always carries a risk. This procedure was tested successfully on one keyboard,
using Redragon's own flashing code (write + verify + reboot). You do this at your own risk.

## Requirements

* Redragon K596 Vishnu, **MosArt version**: USB ID `062A:8519` when wired, and the official
  software shows `FW: 1.04`. Check the ID in Device Manager -> keyboard -> Details -> Hardware Ids
  (`HID\VID_062A&PID_8519`).
* Official **Redragon Gaming Software K596RGB 1.0.0.3**: <https://redragonshop.com/pages/software> ->
  search `vishnu` -> **VISHNU K596 Pro Wireless Keyboard** -> **Software (Dual Mode)**
  ([direct link](https://cdn.shopify.com/s/files/1/0012/4957/4961/files/Redragon_K596RGB_Keyboard_Software_99614b56-7986-4aa2-b062-beae835d5d03.zip?v=1727257837)), installer
  `Redragon Gaming Software K596RGB 1.0.0.3 Setup.exe`, SHA-256
  `ff41aff036a98141e24d1f7248ec22040e8787ab89a4f7b942638fb8d28660db`, installed.
* Python 3 (only for building the flashing programs).

## 1. Build the flashing programs

Run in PowerShell 7 or Windows PowerShell 5.1 (no extra modules needed):

```powershell
python .\tools\patch_software.py "C:\Redragon Gaming Software\Redragon Gaming Software.exe"
```

Adjust the path to your install folder. The script refuses any file other than the expected
version and verifies its own output, then writes two programs next to the original:

| Program | Firmware |
|---|---|
| `K596 FLASH original 1.04.exe` | original 1.04, byte for byte (dry run / restore) |
| `K596 FLASH patch 1.07.exe` | 1.07 = 1.04 + direct-mode fixes (held keys, lock indicators, per-LED refresh removed) |

Both always enable the UPDATE button. Windows may warn about an unknown program.

## 2. Dry run with the original firmware

1. Close SignalRGB and any other RGB software.
2. Connect the keyboard **by cable**, preferably to a rear USB port.
3. Start `K596 FLASH original 1.04.exe`, click **UPDATE**, confirm.
4. Do not touch the keyboard or the PC until it reports `Firmware update is successful.`
5. The keyboard should work exactly as before and still show `FW: 1.04`.

## 3. Flash the patch

Start `K596 FLASH patch 1.07.exe` and repeat the same steps. Afterwards the software shows
`FW: 1.07`. Keyboards already on an earlier patch can be updated the same way.

## Going back

`K596 FLASH original 1.04.exe` flashes the original firmware again at any time.

## Notes

* The original Redragon software will never flash anything on a patched keyboard (its built-in
  firmware is 1.04, which it considers older).
* Never send HID feature report `0x06` to the keyboard yourself: it unlocks firmware download mode.
