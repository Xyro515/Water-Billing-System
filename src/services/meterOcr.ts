import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getMeterDigitCrop, parseMeterRecognition, type MeterRecognitionSuggestion } from '../lib/meterRecognition';
import { runningInExpoGo } from './runtimeStorage';

export type MeterOcrResult =
  | { status: 'recognized'; suggestion: MeterRecognitionSuggestion }
  | { status: 'unavailable' | 'no_digits'; message: string };

export async function recognizeMeterPhoto(input: { uri: string; width: number; height: number }): Promise<MeterOcrResult> {
  if (runningInExpoGo) {
    return { status: 'unavailable', message: 'Automatic digit recognition requires the NMMPC development build. Enter the reading manually in Expo Go.' };
  }

  const context = ImageManipulator.manipulate(input.uri);
  context.crop(getMeterDigitCrop(input.width, input.height));
  const rendered = await context.renderAsync();
  const derivedCrop = await rendered.saveAsync({ compress: 0.92, format: SaveFormat.JPEG });

  try {
    const { default: TextRecognition } = await import('@react-native-ml-kit/text-recognition');
    const recognition = await TextRecognition.recognize(derivedCrop.uri);
    const suggestion = parseMeterRecognition(recognition.text);
    return suggestion
      ? { status: 'recognized', suggestion }
      : { status: 'no_digits', message: 'No reliable meter digits were found. Retake the photo or enter the reading manually.' };
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : 'The recognition engine could not read this image.';
    return { status: 'unavailable', message: `${detail} Enter the reading manually.` };
  }
}
