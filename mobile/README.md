# OPDesk Mobile (Flutter)

A native mobile client for **OPDesk — Workforce Operations**, connected to the same REST API used by the Next.js web application.

## What's in this build

The mobile app now follows the OPDesk web product structure while adapting it to a phone-first layout:

- Dashboard
- People
- Tasks
- Notifications
- Teams
- Projects
- Attendance with clock-in / clock-out
- Timesheets
- Daily Updates
- Meetings
- Access & Permissions for Super Admin
- Reports / Training / Settings entry points
- Secure JWT session storage
- Role-aware navigation
- Pull-to-refresh and API error states
- Production backend URL configured by default

The app uses the existing backend endpoints rather than duplicating business logic.

## Production backend

The default API URL is:

`https://bharat-infotechs-opdesk.vercel.app`

Therefore a release APK can be built without supplying `--dart-define`:

```bash
flutter pub get
flutter analyze
flutter build apk --release
```

For the connected Android phone:

```bash
flutter run -d R9ZY20B78VT --dart-define=API_BASE_URL=https://bharat-infotechs-opdesk.vercel.app
```

For local development against the Next.js server, use your PC's LAN IP on a physical phone:

```bash
flutter run -d R9ZY20B78VT --dart-define=API_BASE_URL=http://192.168.1.10:3000
```

Replace `192.168.1.10` with the PC's IPv4 address. The phone and PC must be on the same network and Windows Firewall must allow the Next.js port.

For an Android emulator:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

## Authentication

The mobile client sends:

`Authorization: Bearer <OPDesk JWT>`

The token is stored in platform secure storage. The same employee account can therefore be used in the web and mobile clients.

Login accepts either the employee email or employee ID, depending on what exists in the backend.

## Important release note for an existing Android scaffold

If the `android/` folder was generated locally with `flutter create`, make sure the main Android manifest contains:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
```

It belongs directly under the `<manifest>` element in:

`android/app/src/main/AndroidManifest.xml`

Then rebuild the release APK.

## Build output

After:

```bash
flutter build apk --release
```

Flutter normally writes the APK to:

`build/app/outputs/flutter-apk/app-release.apk`

For a debug install:

```bash
flutter run -d R9ZY20B78VT --dart-define=API_BASE_URL=https://bharat-infotechs-opdesk.vercel.app
```

## Scope

The mobile UI is designed around the backend surface that currently exists in the uploaded OPDesk project. Where the backend does not expose a mobile-ready API (for example some reporting/training configuration areas), the app provides a clear entry point instead of inventing fake data.

The web application remains the source of truth for organization configuration and the full desktop workflow.
