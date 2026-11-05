export type PhotoQualityIssue = 'glare' | 'low_light' | 'blur';

export type PhotoQualityResult = {
  meanLuminance: number;
  glareRatio: number;
  darkRatio: number;
  laplacianVariance: number;
  issues: PhotoQualityIssue[];
};

export type PhotoQualityThresholds = {
  maximumGlareRatio: number;
  minimumMeanLuminance: number;
  minimumLaplacianVariance: number;
};

export const defaultPhotoQualityThresholds: PhotoQualityThresholds = {
  maximumGlareRatio: 0.12,
  minimumMeanLuminance: 45,
  minimumLaplacianVariance: 80,
};

export function analyzeRgbaPhotoQuality(data: Uint8Array, width: number, height: number, thresholds = defaultPhotoQualityThresholds): PhotoQualityResult {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3 || data.length < width * height * 4) throw new Error('Invalid image pixel data.');
  const luminance = new Float32Array(width * height);
  let sum = 0;
  let glarePixels = 0;
  let darkPixels = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    const value = 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
    luminance[pixel] = value;
    sum += value;
    if (value >= 245) glarePixels += 1;
    if (value <= 35) darkPixels += 1;
  }

  let laplacianSum = 0;
  let laplacianSquaredSum = 0;
  let laplacianCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const value = 4 * luminance[index] - luminance[index - 1] - luminance[index + 1] - luminance[index - width] - luminance[index + width];
      laplacianSum += value;
      laplacianSquaredSum += value * value;
      laplacianCount += 1;
    }
  }
  const laplacianMean = laplacianSum / laplacianCount;
  const laplacianVariance = Math.max(0, laplacianSquaredSum / laplacianCount - laplacianMean * laplacianMean);
  const meanLuminance = sum / (width * height);
  const glareRatio = glarePixels / (width * height);
  const darkRatio = darkPixels / (width * height);
  const issues: PhotoQualityIssue[] = [];
  if (glareRatio > thresholds.maximumGlareRatio) issues.push('glare');
  if (meanLuminance < thresholds.minimumMeanLuminance) issues.push('low_light');
  if (laplacianVariance < thresholds.minimumLaplacianVariance) issues.push('blur');
  return { meanLuminance, glareRatio, darkRatio, laplacianVariance, issues };
}
