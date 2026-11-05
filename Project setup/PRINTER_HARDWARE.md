# NMMPC Printer Hardware Preparation

## Required baseline

The first field printer should be a **58 mm Bluetooth Classic (SPP) thermal printer with ESC/POS command support**. Do not purchase from a listing that only says “Bluetooth” or “POS compatible”; obtain the manufacturer, exact model, manual, and ESC/POS confirmation first.

An 80 mm printer is optional. Add one only when the cooperative needs wider office receipts; field portability favors 58 mm.

## Procurement acceptance record

Complete this record for every candidate model before marking the development checklist:

| Field | Required evidence |
| --- | --- |
| Manufacturer and exact model | Label on the device and product manual |
| Paper width | 58 mm required; 80 mm optional |
| Bluetooth transport | Bluetooth Classic SPP (not BLE-only) |
| Command language | ESC/POS documented by manufacturer |
| Android pairing | Device appears in Android Nearby devices and pairs successfully |
| Character set | Philippine names, addresses, peso values, and punctuation print correctly |
| Battery/charging | Survives the expected field route |
| Test result | Discovery, reconnect, disconnect recovery, and sample receipt verified |

## Development-build test sequence

1. Create and install the Android development APK from the `development` EAS profile.
2. Turn on the printer and place it in Bluetooth pairing mode.
3. Open **Printer**, grant Nearby devices permission, and tap **Find nearby printers**.
4. Select the exact model. Complete Android's pairing prompt or PIN if shown.
5. Close and reopen the app and verify automatic reconnection.
6. Turn the printer off and verify the app reports it as unavailable without losing the saved device.

Do not mark hardware or physical-device checklist items complete until the exact model and observed result are recorded here.
