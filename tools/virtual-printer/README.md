# Windows virtual printer for Expo Go

This development-only HTTP bridge lets Expo Go send NMMPC receipt data to Windows without native Bluetooth or raw TCP modules.

1. Connect the Windows computer and phone to the same private Wi-Fi network.
2. From the repository root, run `npm.cmd run printer:virtual`.
3. Allow Node.js through Windows Defender Firewall on **Private networks** if prompted.
4. Start Expo Go with `npm.cmd start`.
5. In NMMPC **Printer**, select **Windows virtual**, confirm the displayed URL uses the computer's LAN IPv4 address, and tap **Print a test receipt**.
6. Open `tools/virtual-printer/output/` to inspect the generated text receipt.

The HTTP bridge listens on port `9101` and forwards raw ESC/POS data to CrossEscPos at `127.0.0.1:9100`. Override these with `VIRTUAL_PRINTER_HTTP_PORT`, `VIRTUAL_PRINTER_TCP_HOST`, or `VIRTUAL_PRINTER_TCP_PORT` if needed. Do not expose this development server to a public network or deploy it as a production printer service.
