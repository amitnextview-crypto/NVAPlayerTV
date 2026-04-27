import { PermissionsAndroid, Platform } from "react-native";

function isGranted(result: string) {
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function ensureUsbMediaReadPermissions() {
  if (Platform.OS !== "android") return true;

  if (Platform.Version >= 33) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
    ]);
    return (
      isGranted(results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES]) &&
      isGranted(results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO])
    );
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
  );
  return isGranted(result);
}

