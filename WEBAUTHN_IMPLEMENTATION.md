# WebAuthn E2E Implementation Guide

## Overview

This guide details the complete WebAuthn biometric authentication flow for your ForgeRock React Native app, with fully implemented native bridges for both Android and iOS.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React Native App (JS Layer)                                │
│  ├─ runJourneyWithJsThenNativeBiometric()                  │
│  ├─ Detects WebAuthnRegistrationCallback                   │
│  ├─ Extracts challenge + user info                         │
│  └─ Passes payload to native bridge                        │
└────────────┬────────────────────────────────────────────────┘
             │ JSON payload with challenge
             ▼
┌─────────────────────────────────────────────────────────────┐
│  Native Platform Layer                                      │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │ Android (Kotlin) │         │ iOS (Swift)      │         │
│  │  Fido2ApiClient  │         │ AuthServices     │         │
│  │  ├─ Platform     │         │ ├─ ASAuthControl │         │
│  │  │  authenticator│         │ │  ler           │         │
│  │  ├─ Biometric    │         │ ├─ Passkey/      │         │
│  │  │  prompt       │         │ │  biometric      │         │
│  │  └─ Attestation/ │         │ └─ Attestation/  │         │
│  │     assertion    │         │    assertion     │         │
│  └──────────────────┘         └──────────────────┘         │
└────────────┬────────────────────────────────────────────────┘
             │ Base64: attestationObject + clientDataJSON
             ▼
┌─────────────────────────────────────────────────────────────┐
│  React Native JS (Process Result)                           │
│  └─ Return base64 response for callback submission         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  ForgeRock AM (Server)                                      │
│  ├─ Receive attestation/assertion                          │
│  ├─ Verify against challenge                               │
│  ├─ Store public key (registration)                        │
│  └─ Return next step / session token                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Android (Kotlin + Google Play Services FIDO2)

#### Method Signature
```kotlin
@ReactMethod
fun registerWithBiometrics(
  username: String,
  journeyName: String,
  webAuthnPayload: ReadableMap?,  // From JS
  promise: Promise
)

@ReactMethod
fun loginWithBiometrics(
  username: String,
  journeyName: String,
  webAuthnPayload: ReadableMap?,  // From JS
  promise: Promise
)
```

#### Flow for Registration

```kotlin
1. Extract base64 challenge from payload
2. Decode to bytes: Base64.decode(challengeB64, Base64.URL_SAFE)
3. Create PublicKeyCredentialCreationOptions:
   ├─ RP ID: "forgerock.example.com" (MUST match your domain)
   ├─ Username + UserID + DisplayName
   ├─ Challenge bytes
   ├─ Supported algorithms: ES256, RS256
   ├─ Attachment: PLATFORM (device biometric)
   └─ User verification: PREFERRED
4. Call Fido2ApiClient.getRegisterIntent(options)
5. User performs biometric/PIN authentication
6. Receive AuthenticatorAttestationResponse:
   ├─ attestationObject (base64 encoded)
   └─ clientDataJSON (base64 encoded)
7. Return to JS for submission to AM
```

#### Flow for Authentication

```kotlin
1. Extract base64 challenge from payload
2. Decode to bytes
3. Create PublicKeyCredentialRequestOptions:
   ├─ Challenge bytes
   ├─ RP ID: "forgerock.example.com"
   ├─ Allow credentials (from payload if present)
   └─ User verification: PREFERRED
4. Call Fido2ApiClient.getSignIntent(options)
5. User performs biometric authentication
6. Receive AuthenticatorAssertionResponse:
   ├─ authenticatorData (base64 encoded)
   ├─ clientDataJSON (base64 encoded)
   └─ signature (base64 encoded)
7. Return to JS for submission to AM
```

#### Key Dependencies
```gradle
implementation("com.google.android.gms:play-services-fido:20.2.0")
implementation("org.forgerock:forgerock-auth:4.8.3")
implementation("androidx.biometric:biometric:1.1.0")
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
```

#### Important Notes
- ✅ UI operations must be on Main thread (handled via CoroutineScope(Dispatchers.Main))
- ✅ RP ID must match your domain configuration
- ✅ Attestation preference is DIRECT (server verification)
- ✅ Platform authenticator ensures device-bound keys
- ✅ Errors are passed back with meaningful Android-specific codes

---

### iOS (Swift + AuthenticationServices)

#### Method Signature
```swift
@objc(registerWithBiometrics:journeyName:webAuthnPayload:resolver:rejecter:)
func registerWithBiometrics(
  _ username: String,
  journeyName: String,
  webAuthnPayload: NSDictionary?,  // From JS
  resolver resolve: @escaping RCTPromiseResolveBlock,
  rejecter reject: @escaping RCTPromiseRejectBlock
)

@objc(loginWithBiometrics:journeyName:webAuthnPayload:resolver:rejecter:)
func loginWithBiometrics(
  _ username: String,
  journeyName: String,
  webAuthnPayload: NSDictionary?,  // From JS
  resolver resolve: @escaping RCTPromiseResolveBlock,
  rejecter reject: @escaping RCTPromiseRejectBlock
)
```

#### Flow for Registration

```swift
1. Extract base64 challenge from payload
2. Decode to Data: Data(base64Encoded: challengeB64)
3. Create ASAuthorizationPlatformPublicKeyCredentialProvider:
   └─ RP ID: "forgerock.example.com"
4. Create registration request:
   ├─ Challenge bytes
   ├─ Username + UserID + DisplayName
   └─ User verification: PREFERRED
5. Create ASAuthorizationController with request
6. Set delegate + presentation context
7. Call performRequests()
8. User sees Face ID / Touch ID prompt
9. Biometric success triggers:
   ├─ ASAuthorizationPlatformPublicKeyCredentialRegistration
   ├─ attestationObject (base64 URL-safe)
   └─ clientDataJSON (base64 URL-safe)
10. Return to JS via Promise resolve
```

#### Flow for Authentication

```swift
1. Extract base64 challenge from payload
2. Decode to Data
3. Create ASAuthorizationPlatformPublicKeyCredentialProvider
4. Create assertion request:
   ├─ Challenge bytes
   └─ User verification: PREFERRED
5. Create ASAuthorizationController with request
6. Set delegate + presentation context
7. Call performRequests()
8. User sees Face ID / Touch ID prompt
9. Biometric success triggers:
   ├─ ASAuthorizationPlatformPublicKeyCredentialAssertion
   ├─ authenticatorData (base64 URL-safe)
   ├─ clientDataJSON (base64 URL-safe)
   └─ signature (base64 URL-safe)
10. Return to JS via Promise resolve
```

#### Key Frameworks & Requirements
```swift
import AuthenticationServices  // iOS 16.0+ required
import FRAuth                   // ForgeRock SDK
```

#### Podfile Configuration
```ruby
pod 'FRAuth'           # Includes WebAuthn callback support
pod 'FRAuthenticator'  # Optional biometric handling
# AuthenticationServices is built-in (no pod needed)
```

#### iOS Deployment Target
- **Minimum:** iOS 15.0 (set in Podfile post_install)
- **WebAuthn Support:** iOS 16.0+
- **AuthenticationServices APIs:** iOS 16.0+

#### Important Notes
- ✅ RP ID must match your domain configuration
- ✅ All operations must be on main thread (DispatchQueue.main)
- ✅ Async handling via Promise callbacks
- ✅ Base64 encoding is URL-safe without padding
- ✅ Errors include NSError with localization support

---

## JavaScript / TypeScript Layer

### Payload Extraction

**Registration Payload:**
```typescript
type WebAuthnRegistrationPayload = {
  challenge: string;           // base64 challenge from AM
  'user.id'?: string;          // user identifier
  'user.name'?: string;        // username
  'user.displayName'?: string; // display name
};
```

**Authentication Payload:**
```typescript
type WebAuthnAuthenticationPayload = {
  challenge: string;                      // base64 challenge
  allowCredentials?: Array<{              // optional
    id: string;
    type: string;
    transports?: string[];
  }>;
  userVerification?: 'required' | 'preferred' | 'discouraged';
};
```

### Functions

```typescript
function extractWebAuthnRegistrationPayload(step: FRStep): 
  WebAuthnRegistrationPayload | null

function extractWebAuthnAuthenticationPayload(step: FRStep): 
  WebAuthnAuthenticationPayload | null
```

These functions parse the FRStep callback payload and extract WebAuthn-specific data.

### Journey Flow

```typescript
const result = await runJourneyWithJsThenNativeBiometric(username, {
  triggerNativeOnWebAuthnCallback: true,
  journeyName: 'registration-journey'
});

// Returns:
// {
//   kind: 'native_biometric_completed',
//   webAuthnKind: 'registration' | 'authentication',
//   native: {
//     platform: 'android' | 'ios',
//     attestationObject: '...base64...',  // registration
//     authenticatorData: '...base64...',  // authentication
//     clientDataJSON: '...base64...',
//     signature: '...base64...',          // authentication only
//     message: '...'
//   }
// }
```

---

## RP ID Configuration

**CRITICAL:** The RP ID must match across all layers:

```kotlin
// Android
val rpEntity = PublicKeyCredentialRpEntity(
  "forgerock.example.com",  // ← MUST MATCH
  "ForgeRock",
  null
)
```

```swift
// iOS
let platformProvider = ASAuthorizationPlatformPublicKeyCredentialProvider(
  relyingPartyIdentifier: "forgerock.example.com"  // ← MUST MATCH
)
```

Replace `"forgerock.example.com"` with your actual domain!

---

## ForgeRock AM Configuration

### WebAuthn Node Settings

Your authentication trees in AM must have:

1. **WebAuthn Registration Node**
   - ❌ "Return challenge as JavaScript" = DISABLED
   - This ensures MetadataCallback is sent (SDK converts to WebAuthnRegistrationCallback)

2. **WebAuthn Authentication Node**
   - ❌ "Return challenge as JavaScript" = DISABLED

3. **RP ID Configuration**
   - Must match native implementation: `"forgerock.example.com"`

### Asset Links Configuration

#### Android (android/.../strings.xml)
```xml
<string name="forgerock_url">https://am.example.com/am</string>
<string name="forgerock_realm">alpha</string>
<string name="forgerock_oauth_client_id">sdkPublicClient</string>
<string name="forgerock_oauth_redirect_uri">com.forgerockbiosample:/oauth2redirect</string>
```

#### iOS (Info.plist FRAuthConfigName)
Configure similar settings in your iOS app's FRAuth configuration.

---

## Error Handling

### Android Error Codes
| Code | Meaning |
|------|---------|
| `FR_FIDO2_REGISTER_INTENT` | Failed to get registration intent |
| `FR_FIDO2_REGISTRATION_FAILED` | User cancelled or biometric failed |
| `FR_REGISTRATION_RESULT_ERROR` | Error processing attestation response |
| `FR_FIDO2_SIGN_INTENT` | Failed to get sign intent |
| `FR_FIDO2_AUTHENTICATION_FAILED` | User cancelled or biometric failed |
| `FR_AUTHENTICATION_RESULT_ERROR` | Error processing assertion response |

### iOS Error Codes
| Code | Meaning |
|------|---------|
| `FR_WEBAUTHN_REGISTRATION_FAILED` | Registration cancelled or failed |
| `FR_WEBAUTHN_AUTHENTICATION_FAILED` | Authentication cancelled or failed |
| `FR_iOS_VERSION` | iOS 16.0+ required |

---

## E2E Flow Example

### Registration Flow
```
1. User enters username in React Native UI
2. JS calls: runJourneyWithJsThenNativeBiometric(username)
3. JS SDK calls AM registration journey
4. AM sends WebAuthnRegistrationCallback with challenge
5. JS extracts challenge + user info → WebAuthnRegistrationPayload
6. JS calls: ForgerockBiometric.registerWithBiometrics(username, journeyName, payload)
7. Native receives payload, calls Fido2ApiClient / AuthenticationServices
8. User sees biometric prompt (Face ID / Fingerprint)
9. Device creates key pair, returns attestationObject + clientDataJSON
10. Native returns base64-encoded values to JS
11. JS receives response with platform info
12. (FUTURE) JS submits attestation to WebAuthn callback
13. JS continues journey with next AM callback
14. (FUTURE) AM validates attestation, stores public key
15. Journey completes with success
```

### Authentication Flow
```
1. User enters username for login
2. JS calls: runJourneyWithJsThenNativeBiometric(username, { action: 'login' })
3. JS SDK calls AM login journey
4. AM sends WebAuthnAuthenticationCallback with challenge + allowCredentials
5. JS extracts challenge → WebAuthnAuthenticationPayload
6. JS calls: ForgerockBiometric.loginWithBiometrics(username, journeyName, payload)
7. Native receives payload, calls Fido2ApiClient / AuthenticationServices
8. User sees biometric prompt
9. Device signs challenge with stored private key
10. Native returns authenticatorData + signature + clientDataJSON
11. JS receives response with platform info
12. (FUTURE) JS submits assertion to WebAuthn callback
13. JS continues journey with next AM callback
14. (FUTURE) AM verifies signature using stored public key
15. Login succeeds, session established
```

---

## Testing Checklist

### Setup
- [ ] Update `forgerock.ts` with your AM URL and realm
- [ ] Configure AM WebAuthn nodes (disable JavaScript return)
- [ ] Set correct RP ID in Android & iOS native code
- [ ] Ensure device has biometric capability (Face ID / Fingerprint / PIN)

### Registration
- [ ] User can enter username
- [ ] Journey starts with form callback
- [ ] User fills form (email, password, etc.)
- [ ] WebAuthn callback is triggered
- [ ] Native bridge receives payload
- [ ] Biometric/PIN prompt appears
- [ ] User authenticates with biometric
- [ ] Device returns attestation
- [ ] Native bridge returns response
- [ ] Journey continues or completes

### Authentication
- [ ] User enters username for login
- [ ] WebAuthn callback is triggered
- [ ] Biometric/PIN prompt appears
- [ ] User authenticates
- [ ] Assertion is returned
- [ ] AM verifies signature
- [ ] User is logged in

### Error Scenarios
- [ ] User cancels biometric → error handled gracefully
- [ ] Invalid challenge → proper error message
- [ ] Network error → retry capability
- [ ] Device doesn't support WebAuthn → fallback to legacy mode

---

## Deployment Notes

### Android
1. Build and deploy APK
2. Test on Android 7.0+ device with FIDO2 support
3. Verify Play Services is up to date

### iOS
1. Build and deploy to iOS 16.0+ device
2. Test Face ID / Touch ID
3. Verify Xcode build settings include AuthenticationServices

---

## Next Steps

1. ✅ Implement native WebAuthn APIs (DONE)
2. ⏳ Integrate actual callback submission in JS:
   - Set attestation/assertion on callback
   - Submit step to continue journey
3. ⏳ Add App Links for Android
4. ⏳ Add Universal Links for iOS
5. ⏳ Comprehensive error handling & user feedback
6. ⏳ Testing on real devices
7. ⏳ Production deployment

---

## References

- [Google Play Services FIDO2 API](https://developers.google.com/identity/fido/android)
- [iOS AuthenticationServices](https://developer.apple.com/documentation/authenticationservices)
- [WebAuthn W3C Spec](https://www.w3.org/TR/webauthn-2/)
- [Ping Identity Mobile Biometrics Docs](https://docs.pingidentity.com/sdks/latest/sdks/use-cases/mobile-biometrics/)
- [ForgeRock JavaScript SDK](https://backstage.forgerock.com/docs/sdks/latest/sdks/javascript-sdk/)
