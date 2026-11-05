# Phase 6 OCR implementation

## Selected engine

The mobile app uses Google ML Kit Text Recognition v2 through `@react-native-ml-kit/text-recognition` with the bundled Latin model.

- Recognition stays on the device and does not upload customer meter images to an OCR service.
- OCR is advisory: an employee must inspect and confirm every suggestion before it fills the editable reading fields.
- The original photograph remains immutable audit evidence; recognition runs against a derived center crop.
- Expo Go keeps manual entry available because ML Kit is a native dependency.
- Android and iOS autolinking provide the native configuration; no hand-edited native folders or config plugin are required.

## Development-build verification

The package is installed and integrated for Expo SDK 58, but the checklist's development-build and physical-device items must remain unchecked until a new development client is built, installed, and tested on a device.

## Recognition rules

1. Crop the region represented by the on-screen digit guide.
2. Extract candidate digit strings from that derived crop.
3. Separate an explicit decimal/fractional portion without silently assuming the final digit is red.
4. Mark character substitutions, multiple candidates, and unknown red-digit position as uncertain.
5. Never copy OCR output into a reading until the employee confirms it.
6. Keep the whole and fractional fields editable after recognition.
7. Keep manual entry available when recognition is unavailable or finds no digits.
