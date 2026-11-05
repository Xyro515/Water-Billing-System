import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

type StorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const state = globalThis as typeof globalThis & { __nmmpcExpoGoStorage?: Map<string, string> };
const memory = state.__nmmpcExpoGoStorage ?? new Map<string, string>();
state.__nmmpcExpoGoStorage = memory;

const memoryStorage: StorageAdapter = {
  getItem: async (key) => memory.get(key) ?? null,
  setItem: async (key, value) => { memory.set(key, value); },
  removeItem: async (key) => { memory.delete(key); },
};

export const runningInExpoGo = Constants.appOwnership === 'expo' || Constants.expoVersion != null;
export const runtimeStorage: StorageAdapter = runningInExpoGo ? memoryStorage : AsyncStorage;
export const offlineDatabaseEnabled = !runningInExpoGo;
