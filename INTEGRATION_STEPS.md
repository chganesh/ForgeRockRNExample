# JS SDK → Native biometrics (integration notes)

This repo demonstrates how to **detect WebAuthn callbacks in the ForgeRock JavaScript SDK** and then **trigger the native ForgeRock SDK** (via a React Native bridge) to show the **OS biometric UI**.

## Exact flow (what happens)

- **JavaScript SDK** runs your journey with `FRAuth.start()` + `FRAuth.next()`
- The app fills your non-WebAuthn callbacks (example: `NameCallback`, optional `HiddenValueCallback`)
- When AM returns a **WebAuthn step**, the app triggers the **native module bridge** (`ForgerockBiometric`)
- The **native ForgeRock SDK** performs WebAuthn using the platform authenticator:
  - Android: fingerprint/face prompt via system UI
  - iOS: Face ID / Touch ID prompt via system UI

## Where the WebAuthn trigger is implemented

- `src/services/jsRegistrationFlow.ts`
  - Looks for WebAuthn using `FRWebAuthn.getWebAuthnStepType(step)`
  - On WebAuthn **Registration** → calls `ForgerockBiometric.registerWithBiometrics(username, journeyName)`
  - On WebAuthn **Authentication** → calls `ForgerockBiometric.loginWithBiometrics(username, journeyName)`

## What you must configure (must match AM)

### AM / server

- A journey/tree (registration or login) that includes:
  - username collection (or whatever your flow needs)
  - **WebAuthn Registration** node (for registration) or **WebAuthn Authentication** node (for login)
- OAuth client configured with:
  - `client_id`
  - allowed `redirect_uri` values
  - scopes
  - correct platform settings (public/native client settings per your tenant standards)

### JavaScript SDK (your existing setup)

- Your app already configures the JS SDK. Keep using that.
- Ensure these match the same environment as native:
  - AM base URL (`serverConfig.baseUrl`)
  - realm (`realmPath`)
  - journey/tree name (`tree` or step override)
  - OAuth client settings (`clientId`, `redirectUri`, `scope`)

### Android native config

Set these in `android/app/src/main/res/values/strings.xml`:

- `forgerock_url`
- `forgerock_realm`
- `forgerock_oauth_client_id`
- `forgerock_oauth_redirect_uri`
- `forgerock_oauth_scope`
- `forgerock_cookie_name`
- `forgerock_auth_service` (optional default; code also passes `journeyName`)

### iOS native config

- Ensure Ping/ForgeRock iOS SDK is configured (FRAuth config/plist per your setup)
- `Info.plist` includes `NSFaceIDUsageDescription` if Face ID is used

## Test

- Run the app
- Enter username
- Start the journey
- When AM reaches the WebAuthn step, you should see the OS biometric prompt

## Integration checklist (copy into your main app)

- Decide your two journey names:
  - Registration journey (JS SDK): your normal registration tree
  - `BIO_TREE` (native SDK): the AM journey/tree that contains **WebAuthn** and therefore shows **biometrics**
    - Example: `rn-bio-register` (WebAuthn Registration)
    - Example: `rn-bio-login` (WebAuthn Authentication)

- JS: in your journey step loop, detect WebAuthn:
  - `FRWebAuthn.getWebAuthnStepType(step)`
- When WebAuthn is detected:
  - Registration → call native `ForgerockBiometric.registerWithBiometrics(username, journeyName)`
  - Authentication → call native `ForgerockBiometric.loginWithBiometrics(username, journeyName)`
- Native must be configured for the same AM/realm/OAuth client as JS.

### Optional (POC): trigger native when a specific callback appears (HiddenValueCallback)

If you want the server to control the exact handoff point, you can use a callback like `HiddenValueCallback` as a marker.

- In your JS step loop, before calling `FRAuth.next(step)`:
  - if the step contains `HiddenValueCallback`, call native and start `BIO_TREE`

Pseudo-check:

```ts
const hasHidden =
  step.getCallbacksOfType(CallbackType.HiddenValueCallback).length > 0;

if (hasHidden) {
  return await ForgerockBiometric.registerWithBiometrics(username, BIO_TREE);
}
```

## Notes

- This is a **POC** for “JS journey → native biometric”.
- If you require a single continuous AM transaction (continue the same `authId` between JS and native), you need extra resume/session sharing work.

