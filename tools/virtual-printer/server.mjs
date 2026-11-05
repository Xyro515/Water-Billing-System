import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeEscPos, formatReceipt } from './escpos.mjs';

const port = Number(process.env.VIRTUAL_PRINTER_HTTP_PORT ?? 9101);
const targetHost = process.env.VIRTUAL_PRINTER_TCP_HOST ?? '127.0.0.1';
const targetPort = Number(process.env.VIRTUAL_PRINTER_TCP_PORT ?? 9100);
const outputDirectory = join(dirname(fileURLToPath(import.meta.url)), 'output');
const recent = [];

function forwardToEscPosPrinter(receipt) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: targetHost, port: targetPort });
    socket.setTimeout(5000);
    socket.once('connect', () => socket.end(encodeEscPos(receipt)));
    socket.once('close', (hadError) => { if (!hadError) resolve(); });
    socket.once('timeout', () => socket.destroy(new Error('ESC/POS virtual printer connection timed out.')));
    socket.once('error', reject);
  });
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  if (request.method === 'GET' && request.url === '/health') return json(response, 200, { ready: true, printer: 'NMMPC Windows Virtual Printer', receipts: recent.length });
  if (request.method === 'GET' && request.url === '/') return json(response, 200, { printer: 'NMMPC Windows Virtual Printer', recent });
  if (request.method !== 'POST' || request.url !== '/print') return json(response, 404, { error: 'Not found' });
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => { body += chunk; if (body.length > 1_000_000) request.destroy(); });
  request.on('end', async () => {
    try {
      const payload = JSON.parse(body);
      if (!payload.receipt?.lines || !Array.isArray(payload.receipt.lines)) return json(response, 400, { error: 'A receipt with lines is required.' });
      const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const formatted = formatReceipt(payload.receipt);
      await forwardToEscPosPrinter(payload.receipt);
      await mkdir(outputDirectory, { recursive: true });
      const output = join(outputDirectory, `${id}.txt`);
      await writeFile(output, formatted, 'utf8');
      recent.unshift({ id, output, receivedAt: new Date().toISOString(), paperWidth: payload.receipt.paperWidth ?? 58 });
      recent.splice(20);
      console.log(`\n--- Receipt ${id} ---\n${formatted}\n--- Saved ${output} ---`);
      return json(response, 201, { id, output });
    } catch (error) {
      return json(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });
});

server.listen(port, '0.0.0.0', () => {
  const addresses = Object.values(networkInterfaces()).flat().filter((entry) => entry?.family === 'IPv4' && !entry.internal).map((entry) => `http://${entry.address}:${port}`);
  console.log('NMMPC Windows Virtual Printer is ready.');
  console.log(`Forwarding ESC/POS data to ${targetHost}:${targetPort}.`);
  console.log(`Local health check: http://127.0.0.1:${port}/health`);
  for (const address of addresses) console.log(`Expo Go URL: ${address}`);
  console.log('Keep this window open while testing. Press Ctrl+C to stop.');
});

server.on('error', async (error) => {
  if (error.code === 'EADDRINUSE') {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) });
      const health = await response.json();
      if (response.ok && health.printer === 'NMMPC Windows Virtual Printer') {
        console.log(`NMMPC Windows Virtual Printer is already running on HTTP port ${port}. Reuse the existing bridge.`);
        return;
      }
    } catch { /* Another application owns the port. */ }
    console.error(`HTTP bridge port ${port} is used by another application. Set VIRTUAL_PRINTER_HTTP_PORT to another free port.`);
    process.exitCode = 1;
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
