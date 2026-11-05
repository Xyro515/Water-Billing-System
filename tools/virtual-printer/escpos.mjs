const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const command = (...bytes) => Buffer.from(bytes);
// Keep LF intact: ESC/POS uses it to print and advance to the next line.
const ascii = (value = '') => Buffer.from(String(value).replace(/[^\x0A\x20-\x7E]/g, '?'), 'ascii');
const printable = (value = '') => String(value).replace(/[^\x20-\x7E]/g, '?');

function wrapText(value, width) {
  const text = printable(value).trim();
  if (!text) return [''];
  const rows = [];
  for (const word of text.split(/\s+/)) {
    if (word.length > width) {
      const pending = rows.at(-1);
      if (pending && pending.length < width) rows.push('');
      for (let offset = 0; offset < word.length; offset += width) rows.push(word.slice(offset, offset + width));
      continue;
    }
    const current = rows.at(-1) ?? '';
    if (!current) rows.push(word);
    else if (`${current} ${word}`.length <= width) rows[rows.length - 1] = `${current} ${word}`;
    else rows.push(word);
  }
  return rows.filter((row, index) => row || index === 0);
}

function alignWithin(value, width, alignment = 'left') {
  const text = printable(value).slice(0, width);
  if (alignment === 'right') return text.padStart(width);
  if (alignment === 'center') {
    const left = Math.floor((width - text.length) / 2);
    return `${' '.repeat(left)}${text}`.padEnd(width);
  }
  return text.padEnd(width);
}

function layoutText(line, normalWidth) {
  const width = line.size === 'large' ? Math.floor(normalWidth / 2) : normalWidth;
  const left = printable(line.preText);
  const right = printable(line.content);
  if (left) {
    if (left.length + right.length + 1 <= width) {
      return [`${left}${' '.repeat(width - left.length - right.length)}${right}`];
    }
    return [
      ...wrapText(left, width).map((row) => alignWithin(row, width, 'left')),
      ...wrapText(right, width).map((row) => alignWithin(row, width, 'right')),
    ];
  }
  return wrapText(right, width).map((row) => alignWithin(row, width, line.align));
}

function barcodeModuleDots(content, printableDots) {
  const modules = content.length * 11 + 35;
  for (let dots = 3; dots >= 2; dots -= 1) {
    if (modules * dots <= printableDots) return dots;
  }
  return 0;
}

function encodeCode128(line, paperWidth) {
  const content = String(line.data ?? '');
  const printableDots = paperWidth === 80 ? 576 : 384;
  const moduleDots = /^[\x20-\x7E]+$/.test(content)
    ? barcodeModuleDots(content, printableDots)
    : 0;

  if (!moduleDots) {
    return Buffer.concat([
      command(ESC, 0x61, 1),
      ascii(content),
      command(LF, ESC, 0x61, 0),
    ]);
  }

  // CrossEscPos's virtual CODE128 renderer selects the code set itself. Its
  // HRI renderer treats the hardware-oriented "{B" selector as customer text,
  // so the development bridge sends only the actual value. Physical printers
  // use react-native-receipt-printer's hardware encoder instead of this bridge.
  const data = ascii(content);
  return Buffer.concat([
    command(ESC, 0x61, 1),
    command(GS, 0x68, Math.max(1, Math.min(255, Number(line.height) || 80))),
    command(GS, 0x77, moduleDots),
    command(GS, 0x48, line.showText === false ? 0 : 2),
    command(GS, 0x66, 0),
    command(GS, 0x6b, 73, data.length),
    data,
    command(LF, ESC, 0x61, 0),
  ]);
}

function encodeQrCode(line) {
  const data = ascii(line.data);
  const storeLength = data.length + 3;
  return Buffer.concat([
    command(ESC, 0x61, 1),
    command(GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0),
    command(GS, 0x28, 0x6b, 3, 0, 49, 67, 5),
    command(GS, 0x28, 0x6b, 3, 0, 49, 69, 48),
    command(GS, 0x28, 0x6b, storeLength % 256, Math.floor(storeLength / 256), 49, 80, 48),
    data,
    command(GS, 0x28, 0x6b, 3, 0, 49, 81, 48),
    command(LF, ESC, 0x61, 0),
  ]);
}

export function formatReceipt(receipt) {
  const width = receipt.paperWidth === 80 ? 48 : 32;
  const fit = (value = '') => String(value).replace(/[^\x20-\x7E]/g, '?').slice(0, width);
  const lines = [];
  for (const line of receipt.lines ?? []) {
    if (line.type === 'divider') lines.push((line.char ?? '-').repeat(width));
    else if (line.type === 'spacer') for (let index = 0; index < (line.lines ?? 1); index += 1) lines.push('');
    else if (line.type === 'barcode') lines.push(`[CODE128 ${fit(line.data)}]`);
    else if (line.type === 'qrcode') lines.push(`[QR ${fit(line.data)}]`);
    else if (line.type === 'cut') lines.push('[CUT]');
    else if (line.type === 'text') lines.push(...layoutText(line, width));
  }
  return lines.join('\n');
}

export function encodeEscPos(receipt) {
  const paperWidth = receipt.paperWidth === 80 ? 80 : 58;
  const width = paperWidth === 80 ? 48 : 32;
  const chunks = [command(ESC, 0x40, ESC, 0x32)];

  for (const line of receipt.lines ?? []) {
    if (line.type === 'cut') { chunks.push(command(GS, 0x56, 0x00)); continue; }
    if (line.type === 'spacer') { chunks.push(Buffer.from('\n'.repeat(line.lines ?? 1))); continue; }
    if (line.type === 'divider') { chunks.push(command(ESC, 0x61, 1), ascii(`${(line.char ?? '-').repeat(width)}\n`), command(ESC, 0x61, 0)); continue; }
    if (line.type === 'barcode') { chunks.push(encodeCode128(line, paperWidth)); continue; }
    if (line.type === 'qrcode') { chunks.push(encodeQrCode(line)); continue; }
    if (line.type === 'text') {
      const rows = layoutText(line, width);
      chunks.push(command(ESC, 0x61, 1, ESC, 0x45, line.bold ? 1 : 0, GS, 0x21, line.size === 'large' ? 0x11 : 0x00));
      for (const row of rows) chunks.push(ascii(`${row}\n`));
      chunks.push(command(ESC, 0x45, 0, GS, 0x21, 0, ESC, 0x61, 0));
    }
  }

  chunks.push(command(ESC, 0x45, 0x00, GS, 0x21, 0x00));
  return Buffer.concat(chunks);
}
