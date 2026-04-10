# Native Bridge Rewrite - WebAuthn Integration

## Overview
Complete rewrite of the native Android (Kotlin) and iOS (Swift) bridges to support explicit WebAuthn payload passing. This enables proper separation of concerns: **JS SDK = Brain (orchestration)**, **Native SDK = Muscle (biometric execution)**.

---

## Architecture Changes

### Before (Legacy)
```
JS SDK → Native → Auto-handle everything → Return success
```

### After (New)
```
JS SDK detects WebAuthn callback
    ↓
Extracts payload (challenge, user, etc.)
    ↓
Sends to Native with explicit payload
    ↓
Native executes WebAuthn (biometric)
    ↓
Returns attestation/assertion response
    ↓
JS receives response and continues journey
```

---

## Files Modified

### 1. **Android Native Bridge**
**File:** `android/app/src/main/java/com/forgerockbiosample/forgerock/ForgerockBiometricModule.kt`

#### New Method Signatures
```kotlin
// Registration with optional WebAuthn payload
@ReactMethod
fun registerWithBiometrics(
  username: String,
  journeyName: String,
  webAuthnPayload: ReadableMap?,  // ← NEW: Explicit payload
  promise: Promise
)

// Authentication with optional WebAuthn payload
@ReactMethod
fun loginWithBiometrics(
  username: String,
  journeyName: String,
  webAuthnPayload: ReadableMap?,  // ← NEW: Explicit payload
  promise: Promise
)
```

#### New Functions
- `handleWebAuthnRegistrationPayload()` - Extract and process WebAuthn registration challenge
- `handleWebAuthnAuthenticationPayload()` - Extract and process WebAuthn authentication challenge
- `startJourneyAutomatic()` - Legacy mode for backward compatibility

#### Key Features
- ✅ Explicit payload extraction from WebAuthn callbacks
- ✅ Returns attestation object + client data (registration)
- ✅ Returns assertion + authenticator data (authentication)
- ✅ Backward compatible (null payload = legacy auto mode)
- ✅ Proper error handling with meaningful messages

---

### 2. **iOS Native Bridge**
**File:** `ios/ForgerockBioSample/ForgerockBiometric.swift`

#### New Method Signatures
```swift
@objc(registerWithBiometrics:journeyName:webAuthnPayload:resolver:rejecter:)
func registerWithBiometrics(
  _ username: String,
  journeyName: String,
  webAuthnPayload: NSDictionary?,  // ← NEW: Explicit payload
  resolver: @escaping RCTPromiseResolveBlock,
  rejecter: @escaping RCTPromiseRejectBlock
)

@objc(loginWithBiometrics:journeyName:webAuthnPayload:resolver:rejecter:)
func loginWithBiometrics(
  _ username: String,
  journeyName: String,
  webAuthnPayload: NSDictionary?,  // ← NEW: Explicit payload
  resolver: @escaping RCTPromiseResolveBlock,
  rejecter: @escaping RCTPromiseRejectBlock
)
```

#### New Functions
- `handleWebAuthnRegistrationPayload()` - Extract and process registration challenge
- `handleWebAuthnAuthenticationPayload()` - Extract and process authentication challenge
- `runJourneyAutomatic()` - Legacy mode
- `handleNodeAutomatic()` - Recursive node handling for legacy mode

#### Key Features
- ✅ Main thread dispatch for UI operations
- ✅ Explicit payload extraction and validation
- ✅ Returns attestation/assertion structures
- ✅ Backward compatible
- ✅ Proper error handling with NSError

---

### 3. **TypeScript Bridge**
**File:** `src/native/ForgerockBiometric.ts`

#### New Type Definitions

```typescript
// WebAuthn Registration Payload (from JS SDK)
export type WebAuthnRegistrationPayload = {
  challenge: string;           // base64 challenge
  'user.id'?: string;          // user identifier
  'user.name'?: string;        // user name
  'user.displayName'?: string; // display name
  [key: string]: any;          // additional attributes
};

// WebAuthn Authentication Payload (from JS SDK)
export type WebAuthnAuthenticationPayload = {
  challenge: string;
  allowCredentials?: Array<{
    id: string;
    type: string;
    transports?: string[];
  }>;
  userVerification?: 'required' | 'preferred' | 'discouraged';
};

// WebAuthn Registration Response (attestation)
export type WebAuthnRegistrationResponse = {
  platform: 'android' | 'ios';
  attestationObject: string;    // base64 encoded
  clientDataJSON: string;       // base64 encoded
  transports?: string;
  message: string;
};

// WebAuthn Authentication Response (assertion)
export type WebAuthnAuthenticationResponse = {
  platform: 'android' | 'ios';
  authenticatorData: string;    // base64 encoded
  clientDataJSON: string;       // base64 encoded
  signature: string;            // base64 encoded
  message: string;
};
```

#### Updated Module Interface
```typescript
type ForgerockBiometricNative = {
  registerWithBiometrics(
    username: string,
    journeyName: string,
    webAuthnPayload?: WebAuthnRegistrationPayload | null
  ): Promise<WebAuthnRegistrationResponse | OperationResult>;

  loginWithBiometrics(
    username: string,
    journeyName: string,
    webAuthnPayload?: WebAuthnAuthenticationPayload | null
  ): Promise<WebAuthnAuthenticationResponse | OperationResult>;
};
```

---

### 4. **JS Registration Flow**
**File:** `src/services/jsRegistrationFlow.ts`

#### New Functions

**Extract Registration Payload**
```typescript
function extractWebAuthnRegistrationPayload(step: FRStep): 
  WebAuthnRegistrationPayload | null
```
- Extracts challenge, user ID, user name from FRStep callback
- Returns structured payload for native bridge

**Extract Authentication Payload**
```typescript
function extractWebAuthnAuthenticationPayload(step: FRStep): 
  WebAuthnAuthenticationPayload | null
```
- Extracts challenge and allow credentials from FRStep callback
- Returns structured payload for native bridge

#### Flow Changes

**Before:**
```js
WebAuthn callback detected → Call native → Return success
```

**After:**
```js
WebAuthn callback detected
    ↓
Extract payload (challenge, user.id, user.name, etc.)
    ↓
Pass payload to native bridge
    ↓
Native executes WebAuthn
    ↓
Receive attestation/assertion response
    ↓
Returned to caller for further processing
```

---

## Usage Examples

### JavaScript (React Native)

**Registration with Explicit WebAuthn Payload:**
```typescript
const result = await runJourneyWithJsThenNativeBiometric(
  username,
  { triggerNativeOnWebAuthnCallback: true }
);

// result.kind === 'native_biometric_completed'
// result.native contains { platform, attestationObject, clientDataJSON, ... }
```

### Android (Kotlin)

**Called from React Native:**
```kotlin
val module = ForgerockBiometricModule(reactContext)

// With explicit WebAuthn payload
val payload = Arguments.createMap()
payload.putString("challenge", "base64Challenge")
payload.putString("user.name", "john.doe")

module.registerWithBiometrics(
  username = "john.doe",
  journeyName = "registration",
  webAuthnPayload = payload,
  promise = promise
)
```

### iOS (Swift)

**Called from React Native:**
```swift
let module = ForgerockBiometric()

// With explicit WebAuthn payload
let payload: [String: Any] = [
  "challenge": "base64Challenge",
  "user.name": "john.doe"
]

module.registerWithBiometrics(
  "john.doe",
  journeyName: "registration",
  webAuthnPayload: payload as NSDictionary,
  resolver: resolver,
  rejecter: rejecter
)
```

---

## Backward Compatibility

**All changes are backward compatible:**

```typescript
// Old way (auto-mode) still works
await ForgerockBiometric.registerWithBiometrics(username, journeyName);

// New way (explicit payload)
await ForgerockBiometric.registerWithBiometrics(
  username,
  journeyName,
  webAuthnPayload  // Optional payload
);
```

When `webAuthnPayload` is `null` or omitted, native modules fall back to legacy auto-handling mode.

---

## Error Handling

### Android Error Codes
- `FR_REGISTER` - Registration operation failed
- `FR_LOGIN` - Login operation failed  
- `FR_WEBAUTHN_REGISTER_PAYLOAD` - Registration payload processing error
- `FR_WEBAUTHN_AUTH_PAYLOAD` - Authentication payload processing error
- `FR_SDK_INIT` - SDK initialization failed
- `FR_NODE_CALLBACK` - Callback processing failed

### iOS Error Codes
- `FR_REGISTER` - Registration operation failed
- `FR_LOGIN` - Login operation failed
- `FR_WEBAUTHN` - WebAuthn operation failed
- `FR_AUTH` - Authentication failed
- `FR_NODE` - Node processing failed

---

## E2E Flow Integration

### Registration Journey
```
1. JS SDK starts journey
2. User fills form (name, email, password)
3. Server returns WebAuthnRegistrationCallback
4. JS SDK detects it
5. JS extracts payload (challenge, user info)
6. JS calls Native.registerWithBiometrics(payload)
7. Native executes platform biometrics
8. Native returns attestation object + client data
9. JS receives response
10. JS can set callback with response (future enhancement)
11. JS submits and continues journey
12. Server validates and returns test/success
```

### Authentication Journey
```
1. JS SDK starts login journey
2. User enters username
3. Server returns WebAuthnAuthenticationCallback
4. JS SDK detects it
5. JS extracts payload (challenge, allow credentials)
6. JS calls Native.loginWithBiometrics(payload)
7. Native executes platform biometrics
8. Native returns assertion + signature
9. JS receives response
10. JS can set callback with response (future enhancement)
11. JS submits and continues journey
12. Server validates and logs user in
```

---

## Migration Checklist

- [x] Android Kotlin module updated
- [x] iOS Swift module updated
- [x] TypeScript bridge types updated
- [x] JS registration flow enhanced
- [x] Payload extraction functions added
- [x] Error codes documented
- [x] Backward compatibility maintained
- [ ] Actual WebAuthn API integration (Android/iOS native)
- [ ] Test execution
- [ ] Documentation updates

---

## Next Steps

1. **Implement actual WebAuthn API calls:**
   - Android: Use `Fido2ApiClient` or similar WebAuthn library
   - iOS: Use `AuthenticationServices` framework

2. **Complete the journey cycle:**
   - Return attestation/assertion to JS callback
   - Continue journey submission

3. **Testing:**
   - Test registration flow end-to-end
   - Test authentication flow end-to-end
   - Test error scenarios

4. **Update App.tsx:**
   - Add login UI component
   - Handle registration and login separately

---

## Notes for Developers

- **Payload extraction:** The payload extraction functions look for WebAuthn callback structure in `step.payload`. Adjust regex/checks if your ForgeRock AM sends different callback format.
- **Base64 encoding:** All WebAuthn responses (attestationObject, authenticatorData, etc.) should be base64 URL-safe encoded without padding.
- **Platform differences:** iOS uses AuthenticationServices; Android uses Fido2ApiClient or AndroidX Biometric APIs.
- **Testing:** Use ForgeRock AM test instance with WebAuthn journey configured before testing.
