import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { analyzeRgbaPhotoQuality } from '../lib/photoQuality';

export async function analyzeMeterPhotoQuality(uri: string) {
  const context = ImageManipulator.manipulate(uri, { maxWidth: 320, maxHeight: 320 });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  const analysisFile = new File(result.uri);
  try {
    const bytes = await analysisFile.bytes();
    const decoded = decode(bytes, { useTArray: true, formatAsRGBA: true, tolerantDecoding: true, maxResolutionInMP: 1, maxMemoryUsageInMB: 32 });
    return analyzeRgbaPhotoQuality(decoded.data, decoded.width, decoded.height);
  } finally {
    if (analysisFile.exists) analysisFile.delete();
  }
}
