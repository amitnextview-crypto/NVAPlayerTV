# SignagePlayerTV Setup Guide

This file is for the person who receives this project in a ZIP file and wants to:

- edit the code in VS Code
- run the Android app
- build the release APK
- run the local CMS/server
- use the licence website
- deploy the licence website on Vercel
- host the licence website on another server and connect a custom domain

This guide is written in simple step-by-step language so a new person can follow it.

## 1. What is inside this project

This ZIP contains these main parts:

- Android app: main project root
- Local CMS/server: [server](c:\Android\signageplayertv\server)
- Android release keystore: [android/app/my-release-key.jks](c:\Android\signageplayertv\android\app\my-release-key.jks)
- Licence app / website source: [_tmp_new_generator](c:\Android\signageplayertv\_tmp_new_generator)

## 2. Before starting

Use a Windows PC.

Recommended software to install first:

1. VS Code
2. Node.js 20 or newer
3. Java JDK 17
4. Android Studio
5. LibreOffice if PowerPoint upload/convert feature is needed in CMS
6. Optional: ffmpeg if video conversion feature is needed and system cannot find ffmpeg automatically

## 3. Download and install required software

### 3.1 Install VS Code

1. Open browser.
2. Search `VS Code download`.
3. Open the official Microsoft website.
4. Download the Windows version.
5. Run the installer.
6. Keep default options and finish installation.

### 3.2 Install Node.js

1. Search `Node.js download`.
2. Open the official Node.js website.
3. Download the `LTS` version.
4. Install it using default options.

This project expects Node 20 or newer.

## 3.3 Install Java JDK 17

1. Search `JDK 17 download`.
2. Download Windows x64 installer from a trusted source such as Eclipse Adoptium.
3. Install it with default options.

Important:

- this project should use JDK 17
- if another Java version is used, Android build may fail

### 3.4 Install Android Studio

1. Search `Android Studio download`.
2. Open the official Android Developers website.
3. Download the Windows installer.
4. Install it.
5. During installation, let it install Android SDK and required tools.

### 3.5 First Android Studio setup

1. Open Android Studio once.
2. When the setup wizard opens, choose `Standard`.
3. Let Android Studio download all required components.
4. Wait for the setup to complete.
5. Close Android Studio if you want. You can continue using VS Code for editing.

Reason:

- you can edit and run commands from VS Code
- but Android Studio setup makes sure Android SDK, build-tools, platform-tools and licenses are installed correctly

### 3.6 Install LibreOffice if CMS will handle PPT/PPTX

If the user wants to upload PowerPoint files in CMS and convert them, install LibreOffice.

Steps:

1. Search `LibreOffice download`.
2. Download Windows installer.
3. Install with default options.

Reason:

- the CMS uses LibreOffice for PowerPoint conversion
- without LibreOffice, PPT upload/convert can fail

### 3.7 Optional: install ffmpeg

If the user wants video processing and conversion support, install ffmpeg.

Steps:

1. Search `ffmpeg windows download`.
2. Download a trusted build.
3. Install it or keep the extracted folder safely.

Reason:

- some video conversion flows depend on ffmpeg

## 4. Extract the ZIP and open the project

1. Copy the ZIP file to any drive.
2. Extract it anywhere you want.

Examples:

- `C:\Projects\signageplayertv`
- `D:\Work\signageplayertv`
- `E:\Apps\signageplayertv`

This project can be kept on `C`, `D`, or `E` drive.

3. Open VS Code.
4. Click `File > Open Folder`.
5. Select the extracted project folder.

## 5. Very important checks before building

These are the most important machine-specific things in this project.

### 5.1 Java hardcoded path in Gradle

Open [android/gradle.properties](c:\Android\signageplayertv\android\gradle.properties)

If you see this line:

```properties
org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.16.8-hotspot
```

then remember:

- this path is from the original machine
- on a new PC this exact path may be different
- if it stays wrong, Android build can fail

Best practice:

- remove this line completely, or
- put `#` at the start to comment it

Like this:

```properties
# org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.16.8-hotspot
```

Then the new PC should use its own `JAVA_HOME`.

### 5.2 Make sure JAVA_HOME points to JDK 17

The new PC should have `JAVA_HOME` pointing to the installed JDK 17 folder.

If Android build gives Java-related errors, the user should verify that:

- JDK 17 is installed
- `JAVA_HOME` is set correctly

### 5.3 Keep the release keystore file

Do not remove this file:

[android/app/my-release-key.jks](c:\Android\signageplayertv\android\app\my-release-key.jks)

Important:

- this file is used for release APK signing
- if this file is missing, `assembleRelease` can fail
- if the user receives the project ZIP, this file must remain inside the project

### 5.4 Licence server URL inside app

Open [src/services/licenseService.ts](c:\Android\signageplayertv\src\services\licenseService.ts)

This file currently contains a fixed website URL:

```ts
const LICENSE_GENERATOR_BASE_URL = "https://local-signage-player-tv-admin-user.vercel.app";
```

If the new user deploys their own licence website, they must replace this URL with their own website URL.

Example:

```ts
const LICENSE_GENERATOR_BASE_URL = "https://your-domain.com";
```

or

```ts
const LICENSE_GENERATOR_BASE_URL = "https://your-vercel-project.vercel.app";
```

If this is not changed when needed:

- licence verification can go to the old server
- activation may fail or use the wrong licence server

### 5.5 CMS default example IP in app

Open [src/admin/AdminPanel.tsx](c:\Android\signageplayertv\src\admin\AdminPanel.tsx)

There is an example CMS URL:

```ts
http://172.19.88.107:8080
```

This is only an example.

On another PC or another network:

- this IP will usually be different
- the user must enter the correct CMS PC IP

### 5.6 CMS port

CMS runs on port `8080`.

If app and CMS are on the same network:

- make sure firewall is not blocking port `8080`
- make sure both devices are on the same LAN/Wi-Fi

## 6. Install project dependencies

Open terminal in VS Code.

### 6.1 Install main app packages

Run:

```powershell
npm install
```

This installs the main project packages.

Important:

- do not manually copy `node_modules`
- always run `npm install` on the new PC
- patch-package is already configured and will run after install

### 6.2 Install CMS/server packages

Run:

```powershell
cd server
npm install
cd ..
```

### 6.3 Install licence website packages

If the user wants to run or deploy the licence website, run:

```powershell
cd _tmp_new_generator
npm install
cd ..
```

## 7. How to edit the code

The user can edit the code directly in VS Code.

Important folders:

- app code: [src](c:\Android\signageplayertv\src)
- Android native code: [android](c:\Android\signageplayertv\android)
- CMS/server: [server](c:\Android\signageplayertv\server)
- licence website: [_tmp_new_generator](c:\Android\signageplayertv\_tmp_new_generator)

## 8. How to run the Android app in development

If the user wants to run the app on phone or emulator:

### 8.1 Use a phone or emulator

Option 1: Real Android phone

1. Enable `Developer options`.
2. Enable `USB debugging`.
3. Connect phone with USB cable.
4. Allow permission popup on phone.

Option 2: Android emulator

1. Open Android Studio.
2. Open Device Manager.
3. Create an emulator if not already created.
4. Start the emulator.

### 8.2 Start Metro

In VS Code terminal, from project root, run:

```powershell
npm start
```

### 8.3 Run the app

Open another terminal in VS Code and run:

```powershell
npm run android
```

## 9. How to build the release APK

This is the important part for sharing APK.

### 9.1 Open terminal in VS Code

From project root run:

```powershell
cd android
.\gradlew.bat clean assembleRelease
```

### 9.2 APK output location

After successful build, the APK will usually be inside:

`android\app\build\outputs\apk\release\`

### 9.3 If release build fails

Check these first:

1. JDK 17 installed
2. `JAVA_HOME` correct
3. `org.gradle.java.home` not forcing a wrong path
4. [android/app/my-release-key.jks](c:\Android\signageplayertv\android\app\my-release-key.jks) is present
5. `npm install` already run in root
6. Android Studio setup completed at least once

## 10. How to run the CMS/server locally

The CMS/server is inside [server](c:\Android\signageplayertv\server).

### 10.1 Install packages

```powershell
cd server
npm install
```

### 10.2 Start CMS locally

```powershell
npm start
```

### 10.3 Open CMS

Usually open in browser:

- `http://localhost:8080`

On local network, other devices can use:

- `http://YOUR_PC_IP:8080`

### 10.4 PPT feature notes

If PowerPoint upload/convert is needed:

- install LibreOffice on the CMS PC
- if LibreOffice is installed in a non-standard place, path may need to be set on that machine

### 10.5 Video conversion notes

If video conversion is needed:

- make sure ffmpeg is available
- if system cannot find ffmpeg automatically, install it properly on that PC

## 11. How to use the licence website

Licence website source is here:

[_tmp_new_generator](c:\Android\signageplayertv\_tmp_new_generator)

This is a separate Next.js project.

### 11.1 Install and run locally

```powershell
cd _tmp_new_generator
npm install
npm run dev
```

Then open browser:

- `http://localhost:3000`

## 12. Required changes before using the licence website

These changes are important for the user who wants to use their own licence system.

### 12.1 Change admin login email and password

Open:

[_tmp_new_generator/app/api/login/route.js](c:\Android\signageplayertv\_tmp_new_generator\app\api\login\route.js)

There is a fixed admin login check:

```js
if (email === "amitnext@gmail.com" && password === "next@1234") {
  return Response.json({ role: "admin" });
}
```

The user should replace it with their own email and password.

Example:

```js
if (email === "your-email@gmail.com" && password === "your-password") {
  return Response.json({ role: "admin" });
}
```

If they want to use the exact values below, they can also replace with:

```js
if (email === "nextview@gmail.com" && password === "next@1234") {
  return Response.json({ role: "admin" });
}
```

But better practice is:

- use their own email
- use their own password

### 12.2 Set MongoDB connection

Open:

[_tmp_new_generator/lib/db.js](c:\Android\signageplayertv\_tmp_new_generator\lib\db.js)

This file reads:

```js
const uri = process.env.MONGO_URI;
```

So the user must provide their own MongoDB connection string in environment variables.

### 12.3 Set SECRET value

Open:

[_tmp_new_generator/app/api/generate/route.js](c:\Android\signageplayertv\_tmp_new_generator\app\api\generate\route.js)

This uses:

```js
process.env.SECRET
```

So the user must also set their own `SECRET` environment variable.

Important:

- `SECRET` should be a private secret string
- do not leave it empty
- do not share it publicly

## 13. How to deploy the licence website on Vercel

This is the easiest deployment option for most users.

### 13.1 Create accounts

The user should have:

1. Vercel account
2. MongoDB database

If using MongoDB Atlas:

1. create MongoDB Atlas account
2. create a cluster
3. create a database user
4. allow network access
5. copy the connection string

### 13.2 Upload licence website project

The user should deploy the folder:

[_tmp_new_generator](c:\Android\signageplayertv\_tmp_new_generator)

They can:

1. create a separate GitHub repo for this folder, or
2. upload/import this folder into their own workflow

### 13.3 Add Vercel environment variables

In Vercel project settings, add:

- `SECRET`
- `MONGO_URI`

Meaning:

- `SECRET` = their own private secret key
- `MONGO_URI` = their own MongoDB connection string

### 13.4 Build and deploy

After Vercel project is connected:

1. deploy the project
2. wait for build to complete
3. open the generated Vercel URL

Example:

- `https://your-project-name.vercel.app`

### 13.5 Update Android app licence URL

After deployment, open:

[src/services/licenseService.ts](c:\Android\signageplayertv\src\services\licenseService.ts)

Replace:

```ts
const LICENSE_GENERATOR_BASE_URL = "https://local-signage-player-tv-admin-user.vercel.app";
```

with the new deployed URL.

Then rebuild the Android app / APK.

## 14. If the user does not want Vercel and wants another server

The licence website can also be hosted on another server.

Examples:

- VPS
- Windows server
- Linux server
- hosting provider that supports Node.js

### 14.1 Requirements for another server

The server should have:

1. Node.js installed
2. access to MongoDB
3. environment variables configured
4. ability to run a Next.js app

### 14.2 Steps on another server

1. upload the [_tmp_new_generator](c:\Android\signageplayertv\_tmp_new_generator) project to the server
2. install dependencies:

```bash
npm install
```

3. set environment variables on the server:

- `SECRET`
- `MONGO_URI`

4. build the project:

```bash
npm run build
```

5. start the project:

```bash
npm run start
```

The site will start on the server.

### 14.3 Connect a custom domain

If the user wants their own domain, for example:

- `license.yourdomain.com`

then general steps are:

1. buy or use an existing domain
2. open DNS settings of the domain
3. point the domain to the hosting server
4. add the same domain in hosting/server configuration
5. enable SSL/HTTPS

Exact DNS steps depend on the hosting provider.

Common examples:

- if provider gives an `A record`, point domain to server IP
- if provider gives a `CNAME`, point subdomain to the provided hostname

### 14.4 After custom domain is connected

Once the custom domain works, update:

[src/services/licenseService.ts](c:\Android\signageplayertv\src\services\licenseService.ts)

Example:

```ts
const LICENSE_GENERATOR_BASE_URL = "https://license.yourdomain.com";
```

Then rebuild the APK again so the Android app uses the new licence server.

## 15. Recommended order for a new user

If a new user gets the ZIP file, the safest order is:

1. install VS Code
2. install Node.js
3. install JDK 17
4. install Android Studio
5. open Android Studio once and finish setup
6. extract ZIP on any drive
7. open project in VS Code
8. check [android/gradle.properties](c:\Android\signageplayertv\android\gradle.properties) and remove/comment old Java path if needed
9. make sure [android/app/my-release-key.jks](c:\Android\signageplayertv\android\app\my-release-key.jks) is present
10. run `npm install` in project root
11. run `npm install` in [server](c:\Android\signageplayertv\server)
12. if licence website is needed, run `npm install` in [_tmp_new_generator](c:\Android\signageplayertv\_tmp_new_generator)
13. update [src/services/licenseService.ts](c:\Android\signageplayertv\src\services\licenseService.ts) with their own licence website URL if needed
14. if using their own licence website, update login email/password in [_tmp_new_generator/app/api/login/route.js](c:\Android\signageplayertv\_tmp_new_generator\app\api\login\route.js)
15. set `SECRET` and `MONGO_URI` on Vercel or on their own server
16. if needed, install LibreOffice for PPT support
17. if needed, install ffmpeg for video processing
18. run app or build release APK

## 16. Final quick checklist

Before saying "everything is ready", confirm these:

- Node.js installed
- JDK 17 installed
- Android Studio installed and opened once
- `JAVA_HOME` correct
- [android/gradle.properties](c:\Android\signageplayertv\android\gradle.properties) not forcing wrong Java path
- [android/app/my-release-key.jks](c:\Android\signageplayertv\android\app\my-release-key.jks) present
- root `npm install` completed
- [server](c:\Android\signageplayertv\server) `npm install` completed if CMS needed
- [_tmp_new_generator](c:\Android\signageplayertv\_tmp_new_generator) `npm install` completed if licence website needed
- [src/services/licenseService.ts](c:\Android\signageplayertv\src\services\licenseService.ts) updated if using new licence server URL
- [_tmp_new_generator/app/api/login/route.js](c:\Android\signageplayertv\_tmp_new_generator\app\api\login\route.js) updated with own admin email/password
- hosting environment has `SECRET`
- hosting environment has `MONGO_URI`
- LibreOffice installed if PPT feature needed
- ffmpeg available if video conversion feature needed
- CMS port `8080` not blocked

## 17. Main commands summary

### Main app

```powershell
npm install
npm start
npm run android
```

### Release APK

```powershell
cd android
.\gradlew.bat clean assembleRelease
```

### CMS/server

```powershell
cd server
npm install
npm start
```

### Licence website local run

```powershell
cd _tmp_new_generator
npm install
npm run dev
```

### Licence website production build on a server

```bash
npm install
npm run build
npm run start
```
