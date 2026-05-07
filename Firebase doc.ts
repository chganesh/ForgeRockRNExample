# Firebase Push Notifications — React Native Enterprise Handbook

## Overview

This handbook provides a complete end-to-end guide for integrating Firebase Cloud Messaging (FCM) into React Native applications using the latest React Native architecture and Firebase SDKs.

It covers:

* Android & iOS setup
* React Native 0.73 → 0.84+
* Firebase latest SDK integration
* Notification lifecycle
* Background handling
* Deep linking
* Local notifications
* Backend integration
* CI/CD support
* Production best practices
* Enterprise architecture standards

This document is intended for:

* React Native Developers
* Mobile Architects
* Backend Engineers
* QA Teams
* DevOps Teams

---

# Table of Contents

1. Introduction
2. Architecture Overview
3. Supported Versions
4. Firebase Project Setup
5. React Native Dependency Installation
6. Android Integration
7. iOS Integration
8. Notification Permission Flow
9. FCM Token Lifecycle
10. Notification Handling
11. App State Behaviors
12. Local Notifications with Notifee
13. Deep Linking & Navigation
14. Backend Integration
15. Topic Notifications
16. Silent Notifications
17. Notification Channels
18. Rich Notifications
19. Analytics & Crash Tracking
20. CI/CD Integration
21. Production Best Practices
22. Security Guidelines
23. Common Issues & Troubleshooting
24. Migration Guide
25. Recommended GitHub Project Structure
26. FAQ
27. References

---

# 1. Introduction

Firebase Cloud Messaging (FCM) is Google’s cloud-based push notification infrastructure for Android and iOS applications.

FCM enables:

* Push notifications
* Silent background updates
* Topic messaging
* User engagement campaigns
* Real-time communication

FCM acts as the bridge between:

* Backend servers
* Firebase infrastructure
* Apple APNs
* Android devices
* React Native applications

---

# 2. Architecture Overview

```text
Backend Server
       ↓
Firebase Admin SDK
       ↓
Firebase Cloud Messaging (FCM)
       ↓
Android FCM / Apple APNs
       ↓
React Native Application
       ↓
Notification Handlers
       ↓
Navigation / Business Logic
```

---

# 3. Supported Versions

| Technology            | Supported Version |
| --------------------- | ----------------- |
| React Native          | 0.73 → 0.84+      |
| React                 | 18+               |
| Node.js               | 18+               |
| Android Gradle Plugin | 8.1+              |
| Gradle                | 8.4+              |
| Firebase BOM          | Latest            |
| Java                  | 17                |
| Kotlin                | 2.0+              |
| Xcode                 | 16+               |
| iOS                   | 15+               |

---

# 4. Firebase Project Setup

## Create Firebase Project

1. Open Firebase Console
2. Create a Firebase project
3. Add Android application
4. Add iOS application
5. Enable Firebase Cloud Messaging

---

## Android Setup

Download:

```text
google-services.json
```

Place file inside:

```text
android/app/google-services.json
```

---

## iOS Setup

Download:

```text
GoogleService-Info.plist
```

Place file inside:

```text
ios/GoogleService-Info.plist
```

---

## APNs Setup for iOS

1. Open Apple Developer Portal
2. Navigate to Certificates, IDs & Profiles
3. Create APNs Auth Key (.p8)
4. Save:

   * Team ID
   * Key ID
5. Upload APNs key to Firebase Console

---

# 5. React Native Dependency Installation

## Install Firebase Packages

```bash
npm install @react-native-firebase/app
npm install @react-native-firebase/messaging
npm install @notifee/react-native
```

---

## Install iOS Pods

```bash
cd ios
pod install
```

---

# 6. Android Integration

## android/build.gradle

```gradle
buildscript {
    dependencies {
        classpath("com.google.gms:google-services:4.4.2")
    }
}
```

---

## android/app/build.gradle

```gradle
plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
}
```

---

## Firebase BOM

```gradle
implementation(platform("com.google.firebase:firebase-bom:33.5.1"))
```

---

## SDK Versions

```gradle
android {
    compileSdk = 35

    defaultConfig {
        minSdk = 23
        targetSdk = 35
    }
}
```

---

## Android Permissions

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

---

## Important Notes for React Native 0.84+

React Native 0.84+ may automatically resolve higher Android Gradle Plugin versions.

Example:

```text
Configured AGP: 8.1.2
Resolved AGP: 8.12.0
```

Possible reasons:

* React Native Gradle Plugin alignment
* Google Services Plugin updates
* Dependency resolution strategy
* Gradle compatibility mappings

---

# 7. iOS Integration

## AppDelegate.mm

```objective-c
#import <Firebase.h>

- (BOOL)application:(UIApplication *)application
didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FIRApp configure];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}
```

---

## Enable iOS Capabilities

Enable:

* Push Notifications
* Background Modes
* Remote notifications

---

## APS Entitlement

```xml
<key>aps-environment</key>
<string>development</string>
```

Use:

```text
production
```

for App Store builds.

---

# 8. Notification Permission Flow

## Android 13+

Android 13+ requires runtime notification permission.

```ts
await PermissionsAndroid.request(
  PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
);
```

---

## iOS Permission Request

```ts
import messaging from '@react-native-firebase/messaging';

const authStatus = await messaging().requestPermission();
```

---

# 9. FCM Token Lifecycle

## Get FCM Token

```ts
const token = await messaging().getToken();
```

---

## Token Refresh

```ts
messaging().onTokenRefresh(async token => {
  await updateToken(token);
});
```

---

## Logout Cleanup

```ts
await messaging().deleteToken();
```

---

# 10. Notification Handling

## Foreground Notifications

```ts
messaging().onMessage(async remoteMessage => {
  console.log(remoteMessage);
});
```

---

## Background Notifications

```ts
messaging().onNotificationOpenedApp(remoteMessage => {
  console.log(remoteMessage);
});
```

---

## Quit State Notifications

```ts
const notification = await messaging().getInitialNotification();
```

---

## Background Message Handler

Place inside:

```text
index.js
```

BEFORE:

```ts
AppRegistry.registerComponent
```

```ts
messaging().setBackgroundMessageHandler(async message => {
  console.log(message);
});
```

---

# 11. App State Behaviors

| App State   | Notification Behavior       |
| ----------- | --------------------------- |
| Foreground  | Manual local notification   |
| Background  | Notification tray           |
| Quit State  | Opens app from notification |
| Silent Push | Background processing       |

---

# 12. Local Notifications with Notifee

## Create Notification Channel

```ts
await notifee.createChannel({
  id: 'default',
  name: 'Default Channel',
  importance: AndroidImportance.HIGH,
});
```

---

## Display Local Notification

```ts
await notifee.displayNotification({
  title: 'Order Update',
  body: 'Your order shipped',
});
```

---

# 13. Deep Linking & Navigation

## Notification Payload Example

```json
{
  "screen": "OrderDetails",
  "orderId": "123"
}
```

---

## Navigation Handling

```ts
navigation.navigate(data.screen, {
  orderId: data.orderId,
});
```

---

# 14. Backend Integration

## Install Firebase Admin SDK

```bash
npm install firebase-admin
```

---

## Initialize Firebase Admin

```js
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
```

---

## Send Push Notification

```js
await admin.messaging().send({
  token,
  notification: {
    title: 'Hello',
    body: 'Welcome',
  },
});
```

---

# 15. Topic Notifications

## Subscribe to Topic

```ts
await messaging().subscribeToTopic('news');
```

---

## Unsubscribe from Topic

```ts
await messaging().unsubscribeFromTopic('news');
```

---

# 16. Silent Notifications

## Use Cases

* Background sync
* Chat refresh
* API prefetching
* Badge updates

---

## iOS Silent Push Payload

```json
{
  "contentAvailable": true
}
```

---

# 17. Notification Channels

Android 8+ requires notification channels.

Recommended channels:

* orders
* chat
* reminders
* promotions

---

# 18. Rich Notifications

Supported features:

* Images
* Action buttons
* Badge count
* Big text
* Custom sounds

---

# 19. Analytics & Crash Tracking

Recommended Firebase Services:

* Firebase Analytics
* Firebase Crashlytics

Track:

* Notification opens
* Delivery failures
* Deep link failures
* Click-through rate

---

# 20. CI/CD Integration

## Recommended Tools

| Tool                      | Purpose           |
| ------------------------- | ----------------- |
| GitHub Actions            | CI/CD             |
| Fastlane                  | Mobile automation |
| Firebase App Distribution | QA builds         |

---

# 21. Production Best Practices

Recommended:

* Remove stale tokens
* Retry failed notifications
* Use high priority carefully
* Deduplicate notifications
* Add notification preferences
* Monitor delivery metrics
* Store tokens securely

---

# 22. Security Guidelines

## Never Do

* Never commit Firebase service account JSON
* Never expose Firebase admin credentials
* Never send sensitive data inside payloads

---

## Recommended

* Use backend-only notification sending
* Use environment variables
* Rotate credentials periodically

---

# 23. Common Issues & Troubleshooting

| Issue                                | Solution                    |
| ------------------------------------ | --------------------------- |
| getToken() returns null              | Verify google-services.json |
| iOS push not received                | Verify APNs setup           |
| Foreground notifications not visible | Use Notifee                 |
| Duplicate notifications              | Deduplicate by messageId    |
| Background handler not firing        | Register in index.js        |
| AGP mismatch issues                  | Clear Gradle cache          |
| SSL mismatch issues                  | Align AGP + Gradle versions |

---

# 24. Migration Guide

Supported migrations:

* GCM → FCM
* Old RN Firebase → Modular SDK
* RN 0.6x → RN 0.84+
* Old Architecture → New Architecture

---

# 25. Recommended GitHub Project Structure

```text
src/
 ├── notifications/
 │    ├── NotificationService.ts
 │    ├── NotificationPermission.ts
 │    ├── NotificationNavigation.ts
 │    ├── NotificationHandler.ts
 │    ├── NotificationChannels.ts
 │    └── index.ts
```

---

# 26. FAQ

## Why are foreground notifications not showing?

FCM does not automatically display notifications while app is foregrounded. Use Notifee local notifications.

---

## Why does the token change?

Token changes after:

* Reinstall
* App data clear
* Device restore
* Firebase refresh

---

## Why does iOS simulator not receive notifications?

APNs works only on physical iOS devices.

---

## Why do Huawei devices fail?

Huawei devices without Google Play Services cannot use FCM.

---

# 27. References

* [React Native Firebase Docs](https://rnfirebase.io/messaging/usage?utm_source=chatgpt.com)
* [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging?utm_source=chatgpt.com)
* [Firebase Admin SDK Docs](https://firebase.google.com/docs/admin/setup?utm_source=chatgpt.com)
* [Notifee Docs](https://notifee.app/react-native/docs/overview?utm_source=chatgpt.com)
* [Apple Push Notification Docs](https://developer.apple.com/documentation/usernotifications?utm_source=chatgpt.com)

---

# Conclusion

This handbook serves as:

* Enterprise notification integration guide
* Team onboarding document
* Production troubleshooting handbook
* CI/CD integration reference
* Reusable architecture standard for React Native applications

You can directly paste this document into Confluence and enhance it further with:

* Internal APIs
* Architecture diagrams
* Screenshots
* GitHub repository links
* Release checklists
* QA validation steps
  
