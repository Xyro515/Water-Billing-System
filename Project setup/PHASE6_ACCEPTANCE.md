# Phase 6 acceptance procedure

The Phase 6 acceptance tests require a development APK, physical Android phone, actual water meters, and consented test photographs. Do not commit customer photographs or a completed manifest containing customer identifiers.

## Test set

Capture at least two supported meter models and include all of these conditions:

- bright sunlight;
- low light;
- glare or reflection;
- dirty or scratched cover;
- a normal control image for each meter model.

Use test accounts and avoid names, addresses, faces, house numbers, GPS metadata, or other unnecessary personal information. Keep the original photograph unchanged. Retakes must be separate records.

## Execution

1. Install the Expo SDK 58 development APK containing the verified ML Kit adapter.
2. Copy `tests/fixtures/meter-photos/manifest.example.json` to `manifest.json`.
3. Capture each meter with the app and record its exact whole and visible fractional digits.
4. Record the OCR result without correcting it.
5. Manually change the suggested reading, confirm the corrected value, then restore and confirm the true value.
6. Record `manualCorrectionVerified: true` only when the saved confirmed reading exactly matches the employee-entered value.
7. Run `npm.cmd run phase6:acceptance`.
8. Archive the generated console result with the APK version, phone model, Android version, printer-independent app version, tester, and date.

The script measures recognition rate and exact-match accuracy separately. An unreadable result is not counted as an exact OCR match, but it must still allow safe manual correction. Checklist items remain unchecked until the real dataset and archived result exist.
