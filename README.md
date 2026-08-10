# NVA SignagePlayerTV

Android TV signage player app jisme TV khud local CMS host kar sakta hai, QR se CMS open hota hai, media upload hota hai, aur screen par layout ke hisab se image/video/web/YouTube/template content play hota hai.

## 1. User Guide: App Active Karna, Permission Allow Karna, Aur Complete Workflow

### App ko active/use karne ke tareike

Is app ko mainly in tareeko se use kiya ja sakta hai:

1. **TV-hosted CMS via QR**
   - App TV par install/open karein.
   - Remote ka **Back** button press karne par QR Access page open hota hai.
   - QR scan karke phone/laptop browser me CMS open karein.
   - TV par hi CMS panel open karna ho to QR page par **Open CMS** select karke remote ka **OK** press karein.
   - Back se khula QR page 15 second me auto-close ho jata hai.

2. **TV-side CMS with remote**
   - Remote se CMS panel navigate kiya ja sakta hai.
   - Arrow keys focus move karti hain.
   - OK button selected control press karta hai.
   - S1, S2, S3 buttons section-wise file picker open karte hain.
   - S1/S2/S3 file picker open hone se pehle auto-reopen OFF ho jata hai, taaki upload/picker ke time app force reopen na ho.

3. **TV-side CMS with mouse**
   - CMS panel mouse se bhi use ho sakta hai.
   - TV compact CMS page me parent container par scroll enabled hai, isliye mouse wheel se page scroll karke settings, upload aur save controls tak easily pahucha ja sakta hai.

4. **USB playback**
   - USB drive TV me insert karne par app USB media detect kar sakta hai.
   - USB source available hone par playback policy USB content ko priority de sakti hai.
   - USB remove hone par app CMS/cached playback par wapas aa sakta hai.

5. **Cached/offline playback**
   - CMS se sync kiya gaya media local cache me store hota hai.
   - Network/CMS unavailable hone par app cached media play kar sakta hai.

6. **Auto-start / auto-reopen mode**
   - App boot ke baad reopen/start ho sakta hai.
   - CMS me Reopen ON/OFF controls available hain.
   - Upload/file picker ke time auto-reopen OFF rakhna useful hai, warna Android picker ke upar app wapas aa sakta hai.

### Permission allow workflow

Fresh install ke baad ye permissions allow karna important hai:

1. **Storage / media permission**
   - Images/videos read karne ke liye required.
   - USB/media import aur local playback cache ke liye useful.

2. **Manage All Files permission**
   - Android TV me external storage/USB media access reliable banane ke liye required ho sakta hai.
   - App prompt kare to Settings me jaakar allow karein.

3. **Display over other apps / overlay permission**
   - Auto-reopen/kiosk style behavior me help karta hai.
   - App prompt kare to overlay permission enable karein.

4. **Install unknown apps permission**
   - CMS se APK update/install flow use karna ho to required.

5. **Network/Wi-Fi permissions**
   - Local CMS host karne, QR URL reachable banane, device discovery, aur socket/API communication ke liye used.

6. **Boot/keep-alive related permissions**
   - TV restart ke baad app reopen/start karne ke liye manifest me boot receiver aur foreground service configured hain.

### Normal content upload workflow

1. TV aur phone/laptop ko same network par rakhein.
2. App TV par open karein.
3. Remote **Back** press karke QR page open karein.
4. QR scan karke CMS browser me open karein, ya TV par **Open CMS** press karein.
5. CMS me device select karein. TV-hosted compact CMS me current TV auto-selected hota hai.
6. Layout choose karein:
   - Fullscreen
   - 2-section layout
   - 3-section grid layout
7. Har section ka source choose karein:
   - Multimedia image/video
   - Website URL
   - YouTube URL
   - Ready Template
8. Multimedia ke liye files upload karein:
   - Browser CMS me file input/upload button use karein.
   - TV-side CMS me S1/S2/S3 press karein, files choose karein, upload auto-start hoga.
9. Ticker, timing, direction, colors, schedule, cache settings adjust karein.
10. Save/apply config karein.
11. Player screen updated content play karegi.

### Remote control behavior

- **Back**: QR Access page open karta hai. Double-back style flow se CMS open behavior bhi supported hai.
- **OK / DPAD Center**: focused button/input select karta hai.
- **Arrow keys**: TV CMS me focus move aur scroll behavior manage karti hain.
- **Long OK**: native side me auto-reopen toggle behavior configured hai.

### Media File Manager (Files button)

Har Upload Section ke **Files** button se responsive, center-screen popup khulta hai.

- **All Devices**: discovered/connected TVs ki uploaded files device-wise aur Section 1/2/3 wise dikhata hai.
- **Specific device**: sirf us TV ki files aur uska IP dikhata hai.
- Empty section me clear empty-state dikhata hai.
- File ke left checkbox se ek ya multiple files select karein, phir **Delete Selected** karein.
- Delete request usi TV ke `/config/delete-section-media` endpoint par jaati hai; successful delete ke baad player ko media refresh event milta hai.
- Popup desktop par left device-list aur mobile par responsive top-grid use karta hai. Slow/offline device ke liye loading timeout hai, isliye baaki devices ki files block nahi hoti.

Important: har TV apna embedded CMS aur local media storage host karta hai. Browser QR aur `TV-IP:8080` agar same TV ka URL kholte hain to same CMS/state dikhate hain. Alag TV IP alag local CMS hote hain; multi-device upload/config actions selected targets par explicitly apply hote hain.

## 2. Technical Details: Is Project Me Kya Use Hua Hai Aur Kaise Kaam Karta Hai

### Main stack

- **React Native 0.83.1**: main app UI aur player logic.
- **React 19.2.0**: component model.
- **TypeScript**: app source mostly `src/` me.
- **Android native Kotlin/Java**: TV remote keys, embedded CMS server, USB/media access, boot receiver, auto-reopen, native file picker, native video player.
- **react-native-video**: media playback.
- **react-native-webview**: TV ke andar CMS panel render karne ke liye.
- **react-native-fs**: local file/cache operations.
- **AsyncStorage**: saved state/config markers.
- **socket.io / socket.io-client**: external PC CMS/device communication paths.
- **Express/CORS server folder**: PC-side CMS/server support.
- **Jest**: unit tests.
- **Gradle Android build**: APK build/package.

### Important folders/files

- `src/app/App.tsx`
  - Main app controller.
  - CMS connection, QR/admin panel open/close, BackHandler, source policy, socket events, permission flow, embedded CMS startup, playback lifecycle.

- `src/admin/AdminCmsPanel.tsx`
  - TV overlay panel.
  - QR Access view aur TV CMS WebView host karta hai.
  - TV native file picker bridge handle karta hai.

- `src/admin/CmsAccessCard.tsx`
  - QR, IP, local CMS URL aur Open CMS button UI.

- `src/player/`
  - Player rendering, slide layout, media stage, backdrop, templates, video state.

- `src/services/`
  - Config load, media sync/cache, source policy, USB state, embedded CMS bridge, permissions, server discovery.

- `android/app/src/main/java/com/signageplayertv/`
  - `MainActivity.kt`: TV remote key events, auto-reopen controls.
  - `DeviceIdModule.java`: React Native native module; device info, permissions, auto-reopen, file picker/upload bridge.
  - `EmbeddedCmsServer.java`: TV ke andar HTTP CMS/API server.
  - `EmbeddedCmsRuntime.java`: embedded CMS runtime/status/QR info.
  - `BootReceiver.java`: boot ke baad app/service start.
  - `KioskKeepAliveService.kt`: keep-alive foreground service.
  - `UsbManagerModule.java` and `UsbWakeReceiver.java`: USB events/media handling.
  - `NativeVideoPlayerView.java`: native video view integration.

- `android/app/src/main/assets/cms/`
  - TV-hosted CMS static files.
  - `index.html`: CMS HTML layout.
  - `style.css`: CMS UI styling, TV compact mode, scroll/focus layout.
  - `app.js`: CMS logic, upload, device selection, preview, templates, TV native bridge.
  - `enterprise.js`: enterprise/group/device management helpers.

- `android/app/src/main/assets/cms/app.js`
  - Device discovery, multi-device upload/config calls aur Media File Manager UI.
  - APK CMS feature change ke liye yahi primary browser-side source hai.

- `android/app/src/main/res/`
  - Android resources, launcher icons/background, layouts, styles.

- `server/`
  - PC CMS/server implementation and installer support.

### Runtime flow

1. App start hota hai aur `App.tsx` embedded CMS server initialize karta hai.
2. Native `EmbeddedCmsServer` TV par local HTTP server chalata hai.
3. `EmbeddedCmsRuntime` local URL, public URL/IP aur QR data provide karta hai.
4. QR page user ko CMS URL deta hai.
5. CMS browser/TV WebView se API calls embedded server ko jaati hain.
6. Upload media TV ke local storage/cache me save hota hai.
7. Config save hone par React Native player new config/media list load karta hai.
8. Player layout ke hisab se sections render karta hai.
9. USB, CMS online, CMS offline/cached source priority `sourcePolicy`/source manager logic se decide hoti hai.
10. Auto-reopen/boot receiver app ko kiosk-style TV use case ke liye alive rakhte hain.

### CMS access consistency

- QR scan aur browser `TV-IP:8080` direct us TV ke embedded CMS ko open karte hain.
- Admin-only mobile app ko **Open Admin CMS** se target TV CMS choose/connect karna chahiye.
- Same result ke liye upload, save config aur delete hamesha intended device/group/all-device selection ke saath run karein.
- APK CMS UI/API change karne par updated APK ko har TV aur Admin-only device par install karein; purane APK me purana CMS asset bundle rahega.

## 3. Future Changes Notes: Kahan Change Karna Hai Aur Dhyan Rakhne Wali Baatein

### Common changes ka map

- **QR page / admin overlay behavior change karna ho**
  - `src/app/App.tsx`
  - `src/admin/AdminCmsPanel.tsx`
  - `src/admin/CmsAccessCard.tsx`

- **TV remote Back/OK/arrow behavior change karna ho**
  - JS side: `src/app/App.tsx`, `android/app/src/main/assets/cms/app.js`
  - Native side: `android/app/src/main/java/com/signageplayertv/MainActivity.kt`

- **TV-side CMS UI, scroll, S1/S2/S3, upload buttons change karna ho**
  - `android/app/src/main/assets/cms/index.html`
  - `android/app/src/main/assets/cms/style.css`
  - `android/app/src/main/assets/cms/app.js`
  - Native picker bridge: `src/admin/AdminCmsPanel.tsx` and `DeviceIdModule.java`

- **Media playback/layout/template change karna ho**
  - `src/player/`
  - `src/player/slideRendererUtils.ts`
  - CMS preview side: `android/app/src/main/assets/cms/app.js`

- **Upload API/cache/storage behavior change karna ho**
  - Embedded TV CMS: `EmbeddedCmsServer.java`, `DeviceIdModule.java`
  - React Native services: `src/services/mediaService.ts`, `src/services/embeddedCmsService.ts`
  - Browser/TV CMS upload logic: `android/app/src/main/assets/cms/app.js`

- **USB behavior change karna ho**
  - `src/services/usbManagerModule.ts`
  - `src/services/usbPlaybackCacheService.ts`
  - `android/app/src/main/java/com/signageplayertv/UsbManagerModule.java`
  - `android/app/src/main/java/com/signageplayertv/UsbWakeReceiver.java`

- **Auto-start / auto-reopen behavior change karna ho**
  - `MainActivity.kt`
  - `BootReceiver.java`
  - `KioskKeepAliveService.kt`
  - `DeviceIdModule.java`
  - CMS buttons/API: `android/app/src/main/assets/cms/app.js`, `EmbeddedCmsServer.java`

- **Logo/icon/background change karna ho**
  - Adaptive background: `android/app/src/main/res/drawable/ic_launcher_background.xml`
  - Launcher PNGs: `android/app/src/main/res/mipmap-*`
  - Play Store icon: `android/app/src/main/res/playstore-icon.png`
  - CMS logo asset: `android/app/src/main/assets/cms/nvlogo.png`

### Change karte waqt rules

1. **TV CMS ke assets duplicate jagah ho sakte hain**
   - `android/app/src/main/assets/cms/` APK ke andar jaata hai.
   - `server/public/` PC CMS ke liye hai.
   - Agar feature dono CMS me chahiye to dono side check karein.
   - Android APK build ke liye `android/app/src/main/assets/cms/` mandatory source hai. `server/public/` ko edit karne se installed TV APK update nahi hota.

2. **Native bridge carefully change karein**
   - WebView CMS `window.ReactNativeWebView.postMessage(...)` se RN ko message bhejta hai.
   - `AdminCmsPanel.tsx` message parse karke native module call karta hai.
   - `DeviceIdModule.java` actual Android picker/upload/settings ka kaam karta hai.

3. **Permissions test real Android TV par karein**
   - Emulator aur TV behavior different ho sakta hai.
   - Manage All Files, Overlay, Unknown Apps, USB permission manually verify karein.

4. **Auto-reopen feature upload/picker ko interrupt kar sakta hai**
   - File picker ya APK install flow ke time auto-reopen OFF karna safer hai.
   - Is logic ko remove/change karne se upload workflow impact ho sakta hai.

5. **Scroll/focus changes TV remote aur mouse dono se test karein**
   - Arrow navigation ke liye focus logic `app.js` me hai.
   - Mouse wheel/parent scroll ke liye TV compact CSS important hai.

6. **Build/test commands**
   - Unit tests:
     ```sh
     npm test -- --runInBand
     ```
   - Android debug APK:
     ```sh
     cd android
     .\gradlew.bat assembleDebug --console plain
     ```
   - Android release APK:
     ```sh
     cd android
     .\gradlew.bat clean
     .\gradlew.bat assembleRelease --console plain
     ```
     Output: `android/app/build/outputs/apk/release/app-release.apk`

7. **Before final APK**
   - Fresh install test karein.
   - Permission prompts allow karke boot/reopen verify karein.
   - QR scan from phone verify karein.
   - TV CMS with remote verify karein.
   - TV CMS with mouse scroll verify karein.
   - S1/S2/S3 upload verify karein.
   - Offline cached playback verify karein.
   - USB insert/remove verify karein.
