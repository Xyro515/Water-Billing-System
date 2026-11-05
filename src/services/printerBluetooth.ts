import { useCallback, useEffect, useRef, useState } from 'react';
import type { BluetoothDevice } from 'react-native-receipt-printer';
import { loadReceiptPrinterModule } from './printerNative';

export type PrinterDevice = Pick<BluetoothDevice, 'address' | 'name' | 'bonded' | 'type'>;
export type PrinterReadyError =
  | 'permission_denied'
  | 'permission_blocked'
  | 'bluetooth_disabled'
  | 'unsupported'
  | 'development_build_required';

function uniqueDevices(devices: PrinterDevice[]) {
  return [...new Map(devices.map((device) => [device.address, device])).values()];
}

export function usePrinterBluetooth(enabled = true) {
  const mounted = useRef(true);
  const [bondedDevices, setBondedDevices] = useState<PrinterDevice[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<PrinterDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<PrinterDevice | null>(null);
  const [readyError, setReadyError] = useState<PrinterReadyError | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    if (!enabled) return;
    let removeListener: (() => void) | undefined;
    loadReceiptPrinterModule().then((printer) => {
      const subscription = printer.onConnectionChange((event) => {
        if (!mounted.current) return;
        setConnectedDevice(event.type === 'connected' ? event.device : null);
      });
      removeListener = subscription;
      const current = printer.getConnectedDevice();
      if (mounted.current && current) setConnectedDevice(current);
    }).catch(() => setReadyError('development_build_required'));
    return () => removeListener?.();
  }, [enabled]);

  const checkReady = useCallback(async () => {
    if (!enabled) {
      if (mounted.current) setReadyError('development_build_required');
      return false;
    }
    try {
      const printer = await loadReceiptPrinterModule();
      const result = await printer.ensureReady();
      if (mounted.current) setReadyError(result.ready ? null : result.reason);
      return result.ready;
    } catch {
      if (mounted.current) setReadyError('development_build_required');
      return false;
    }
  }, [enabled]);

  const refreshBondedDevices = useCallback(async () => {
    const printer = await loadReceiptPrinterModule();
    const devices = await printer.getBondedDevices();
    if (mounted.current) setBondedDevices(uniqueDevices(devices));
    return devices;
  }, []);

  const scan = useCallback(async () => {
    if (!(await checkReady())) return;
    setIsScanning(true);
    setDiscoveredDevices([]);
    try {
      await refreshBondedDevices();
      const printer = await loadReceiptPrinterModule();
      await printer.startScan((device) => {
        if (mounted.current) setDiscoveredDevices((current) => uniqueDevices([...current, device]));
      }, { timeoutMs: 10_000 });
    } finally {
      if (mounted.current) setIsScanning(false);
    }
  }, [checkReady, refreshBondedDevices]);

  const connect = useCallback(async (device: PrinterDevice) => {
    if (!(await checkReady())) return false;
    setIsConnecting(true);
    try {
      const printer = await loadReceiptPrinterModule();
      await printer.connect(device.address);
      if (mounted.current) setConnectedDevice(device);
      return true;
    } finally {
      if (mounted.current) setIsConnecting(false);
    }
  }, [checkReady]);

  const disconnect = useCallback(async () => {
    const printer = await loadReceiptPrinterModule();
    await printer.disconnect();
    if (mounted.current) setConnectedDevice(null);
  }, []);

  return {
    bondedDevices,
    discoveredDevices,
    connectedDevice,
    readyError,
    isScanning,
    isConnecting,
    scan,
    connect,
    disconnect,
  };
}
