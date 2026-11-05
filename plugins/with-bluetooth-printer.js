const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

const ANDROID_PERMISSIONS = [
  { name: 'android.permission.BLUETOOTH_CONNECT' },
  { name: 'android.permission.BLUETOOTH_SCAN', usesPermissionFlags: 'neverForLocation' },
  { name: 'android.permission.BLUETOOTH', maxSdkVersion: '30' },
  { name: 'android.permission.BLUETOOTH_ADMIN', maxSdkVersion: '30' },
  { name: 'android.permission.ACCESS_FINE_LOCATION', maxSdkVersion: '30' },
];

function withAndroidBluetoothPermissions(config) {
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    const existing = manifest['uses-permission'] ?? [];

    for (const permission of ANDROID_PERMISSIONS) {
      const current = existing.find(
        (entry) => entry.$?.['android:name'] === permission.name,
      );
      const attributes = current?.$ ?? { 'android:name': permission.name };

      if (permission.maxSdkVersion) {
        attributes['android:maxSdkVersion'] = permission.maxSdkVersion;
      }
      if (permission.usesPermissionFlags) {
        attributes['android:usesPermissionFlags'] = permission.usesPermissionFlags;
      }

      if (current) current.$ = attributes;
      else existing.push({ $: attributes });
    }

    manifest['uses-permission'] = existing;
    return result;
  });
}

function withIosBluetoothDescription(config) {
  return withInfoPlist(config, (result) => {
    result.modResults.NSBluetoothAlwaysUsageDescription =
      result.modResults.NSBluetoothAlwaysUsageDescription ??
      'Allow NMMPC to connect to a thermal receipt printer.';
    return result;
  });
}

module.exports = function withBluetoothPrinter(config) {
  return withIosBluetoothDescription(withAndroidBluetoothPermissions(config));
};
