 import RNFS from 'react-native-fs';

const CONFIG_PATH = `${RNFS.DocumentDirectoryPath}/config.json`;

export async function readConfig() {
  try {
    const exists = await RNFS.exists(CONFIG_PATH);
    if (!exists) return null;
    const data = await RNFS.readFile(CONFIG_PATH);
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

export async function writeConfig(data: any) {
  await RNFS.writeFile(CONFIG_PATH, JSON.stringify(data, null, 2));
}