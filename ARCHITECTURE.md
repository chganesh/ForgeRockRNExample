# Simplified WebAuthn Architecture

## Overview

**Brain/Muscle Pattern:**
- **Brain 🧠** = JavaScript SDK (flow control, journey orchestration)
- **Muscle 💪** = Native SDK (biometric execution, WebAuthn credential creation)

---

## Directory Structure

```
src/
  auth/
    ├── forgeRockService.ts      # Configuration & journey initialization
    ├── stepHandler.ts            # Main flow control - processes each step
    ├── webAuthnHandler.ts        # Detects WebAuthn & calls native bridge
    └── examples.ts               # Usage examples
    
android/
  app/src/main/java/com/forgerockbiosample/forgerock/
    └── ForgeRockBridgeModule.java   # Native bridge - handles WebAuthn on Android
    
ios/
  ForgerockBioSample/
    └── ForgeRockBridge.swift        # Native bridge - handles WebAuthn on iOS
```

---

## Components

### 1. `forgeRockService.ts` - Configuration Layer

**Responsibilities:**
- Configure ForgeRock SDK once at app startup
- Initialize with AM server URL, client ID, journey names
- Start journeys
- Manage session tokens

**Key Functions:**
```typescript
FRService.init(config)           // Call once at startup
FRService.startJourney(name)     // Begin authentication/registration
FRService.getSessionToken()      // Get current token
FRService.logout()               // Clear session
```

---

### 2. `stepHandler.ts` - Flow Control Engine

**Responsibilities:**
- Recursively process each step in the journey
- Detect step type (success, failure, or regular)
- Detect and fill known callbacks (username, password, email)
- **Detect WebAuthn callbacks and delegate to native**
- Progress to next step

**Main Function:**
```typescript
handleStep(step, credentials)
```

**Flow:**
```
1. Check if LoginSuccess → Done ✅
2. Check if LoginFailure → Failed ❌
3. Get all callbacks in step
4. Detect WebAuthn? → Call native bridge
5. Fill other callbacks (name, password, etc)
6. Call step.next() → Recurse
```

---

### 3. `webAuthnHandler.ts` - Native Bridge Caller

**Responsibilities:**
- Detect WebAuthn callbacks in steps
- Call native module via React Native bridge
- Pass JSON-serialized step to native
- Receive next step from native
- Recursively continue journey

**Key Function:**
```typescript
handleWebAuthn(step, credentials)
```

**What Happens:**
```
JS: "Hey native, here's a WebAuthn step"
  ↓
Native: "I'll extract the challenge, call FIDO2/AuthenticationServices, show biometric"
  ↓
User: "Shows biometric prompt + authenticates"
  ↓
Native: "Here's the next step"
  ↓
JS: "Thanks! Continuing journey..."
```

---

### 4. `ForgeRockBridgeModule.java` - Android Native Implementation

**Responsibilities:**
- Receive WebAuthn steps from JS
- Iterate through callbacks
- Call ForgeRock SDK's `WebAuthnRegistrationCallback.register()` or `WebAuthnAuthenticationCallback.authenticate()`
- SDK handles the entire WebAuthn flow:
  - Extract challenge ✅
  - Call FIDO2 API ✅
  - Show biometric prompt ✅
  - Create attestation/assertion ✅
  - Validate ✅
  - Continue journey ✅
- Return next step to JS

**Key Method:**
```kotlin
handleWebAuthn(stepJson)
```

---

### 5. `ForgeRockBridge.swift` - iOS Native Implementation

**Responsibilities:**
- Receive WebAuthn steps from JS
- Iterate through callbacks
- Call ForgeRock SDK's `WebAuthnRegistrationCallback.authenticate()` or `WebAuthnAuthenticationCallback.authenticate()`
- SDK handles the entire WebAuthn flow:
  - Extract challenge ✅
  - Call AuthenticationServices API ✅
  - Show Face ID / Touch ID / Passkey prompt ✅
  - Create attestation/assertion ✅
  - Validate ✅
  - Continue journey ✅
- Return next step to JS

**Key Method:**
```swift
handleWebAuthn(stepJson)
```

---

## Complete Flow

### Registration Journey

```
1️⃣  registerWithBiometric('ganesh')
     └─ FRService.startJourney()
        └─ ForgeRock AM returns NameCallback

2️⃣  handleStep(step1, {username: 'ganesh'})
     ├─ Detect NameCallback
     ├─ Fill with username
     ├─ step.next()
     └─ Receive PasswordCallback

3️⃣  handleStep(step2, ...)
     ├─ Detect PasswordCallback
     ├─ Fill with password
     ├─ step.next()
     └─ Receive WebAuthnRegistrationCallback

4️⃣  handleStep(step3, ...)
     ├─ Detect WebAuthnRegistrationCallback
     ├─ Call handleWebAuthn()
     │  └─ Bridge.handleWebAuthn(step)
     │     └─ Native SDK:
     │        ├─ Extract challenge
     │        ├─ Call FIDO2 / AuthenticationServices
     │        ├─ Show biometric
     │        ├─ Create attestation
     │        └─ Continue journey
     ├─ Receive next step
     └─ handleStep(nextStep)

5️⃣  handleStep(stepN, ...)
     ├─ Detect LoginSuccess
     └─ Return { ok: true, sessionToken }

✅ Registration complete!
```

### Authentication Journey

```
1️⃣  authenticateWithBiometric('ganesh')
     └─ FRService.startJourney()
        └─ ForgeRock AM returns NameCallback

2️⃣  handleStep(step1, {username: 'ganesh'})
     ├─ Detect NameCallback
     ├─ Fill with username
     ├─ step.next()
     └─ Receive WebAuthnAuthenticationCallback

3️⃣  handleStep(step2, ...)
     ├─ Detect WebAuthnAuthenticationCallback
     ├─ Call handleWebAuthn()
     │  └─ Bridge.handleWebAuthn(step)
     │     └─ Native SDK:
     │        ├─ Extract challenge
     │        ├─ Call FIDO2 / AuthenticationServices
     │        ├─ Show biometric (Face ID/Touch ID)
     │        ├─ Create assertion
     │        └─ Continue journey
     ├─ Receive next step (usually LoginSuccess)
     └─ handleStep(nextStep)

4️⃣  handleStep(stepN, ...)
     ├─ Detect LoginSuccess
     └─ Return { ok: true, sessionToken }

✅ Authentication complete!
```

---

## Key Insights

### ✅ What's Simple
- **JS to Native communication:** Just JSON strings via React Native bridge
- **Native handling:** SDK does 90% of the work
- **Callback detection:** Check callback type, delegate if WebAuthn
- **Result handling:** Parse JSON, continue journey

### ❌ What We DON'T Do
- ❌ Manually extract challenges (SDK does it)
- ❌ Manually call FIDO2 API directly (SDK wraps it)
- ❌ Manually create attestations/assertions (SDK does it)
- ❌ Manually validate responses (SDK validates)
- ❌ Manually parse CBOR (SDK handles it)

### 💡 Why This Works
The ForgeRock SDKs (Android & iOS) already have:
- **WebAuthnRegistrationCallback.register()** - Does EVERYTHING for registration
- **WebAuthnAuthenticationCallback.authenticate()** - Does EVERYTHING for authentication

All we do is call these methods!

---

## Usage

### App Initialization (App.tsx)
```typescript
import * as FRService from './auth/forgeRockService';

export default function App() {
  useEffect(() => {
    FRService.init({
      amBaseUrl: 'https://am.company.com/am',
      clientId: 'mobile-client',
      registrationJourney: 'SignUp',
      authenticationJourney: 'SignIn',
    });
  }, []);

  return <NavigationStack />;
}
```

### Registration Screen
```typescript
import * as Auth from './auth/examples';

export function RegisterScreen() {
  const handleRegister = async (username: string) => {
    const result = await Auth.registerWithBiometric(username);
    if (result.ok) {
      console.log('✅ Registered!');
    } else {
      console.log('❌ Failed:', result.error);
    }
  };

  // ... UI code
}
```

### Authentication Screen
```typescript
export function LoginScreen() {
  const handleLogin = async (username: string) => {
    const result = await Auth.authenticateWithBiometric(username);
    if (result.ok) {
      console.log('✅ Logged in!');
    } else {
      console.log('❌ Failed:', result.error);
    }
  };

  // ... UI code
}
```

---

## Error Handling

All functions return a consistent result:
```typescript
{
  ok: boolean;           // true = success, false = failure
  error?: string;        // Error message if ok=false
  sessionToken?: string; // Session token if ok=true
}
```

---

## Logging

Enable debug logging to understand the flow:

```
✅ ForgeRock SDK initialized
🚀 Starting journey: rn-bio-register
📍 Step Type: FRStep
📦 Callbacks: NameCallback
📝 Filling callbacks...
  ✓ Setting username: ganesh
⏭️  Moving to next step...
📍 Step Type: FRStep
📦 Callbacks: PasswordCallback
📝 Filling callbacks...
  ✓ Setting password: ••••••••
⏭️  Moving to next step...
📍 Step Type: FRStep
📦 Callbacks: WebAuthnRegistrationCallback
🎯 WebAuthn callback detected
📤 Passing step to native bridge...
🔐 Native SDK: Extracting challenge → Calling FIDO2/AuthenticationServices → Showing biometric prompt → Creating credential
📥 Received next step from native bridge
✅ Journey Complete - Login Successful
```

---

## Testing Checklist

- [ ] FRService.init() called at app startup
- [ ] handleStep() correctly fills NameCallback with username
- [ ] handleStep() correctly detects WebAuthnRegistrationCallback
- [ ] handleWebAuthn() successfully calls native bridge
- [ ] Native bridge receives step JSON
- [ ] ForgeRock native SDK's register/authenticate called
- [ ] Biometric prompt appears
- [ ] Native bridge returns next step
- [ ] handleStep() continues with next step
- [ ] Journey completes with LoginSuccess
- [ ] Session token received and stored

---

## Production Checklist

- [ ] Replace DEFAULT_CONFIG with actual AM server URL
- [ ] Replace DEFAULT_CONFIG with actual OAuth client ID
- [ ] Replace DEFAULT_CONFIG with actual journey names
- [ ] Replace in-memory token store with encrypted secure storage
- [ ] Add error handling and user feedback for biometric failures
- [ ] Add retry logic for network failures
- [ ] Add logging/analytics
- [ ] Test on real devices with biometric capability
- [ ] Test iOS 16.0+ for Passkeys support
- [ ] Test Android with multiple biometric types
- [ ] Configure AM WebAuthn nodes properly
- [ ] Set RP ID to your actual domain (not example.com)

---

## Architecture Benefits

✅ **Simple:** Only 4 files, ~500 lines total  
✅ **Clear:** Each file has one responsibility  
✅ **Maintainable:** Easy to understand the flow  
✅ **Testable:** Each component testable in isolation  
✅ **Scalable:** Easy to add more callback types  
✅ **Standard:** Follows ForgeRock best practices  
✅ **Secure:** Uses SDK's built-in validation  
✅ **Future-proof:** SDK updates = automatic fixes  

---

## References

- [ForgeRock JavaScript SDK](https://github.com/ForgeRock/forgerock-javascript-sdk)
- [ForgeRock Android SDK](https://github.com/ForgeRock/forgerock-android-sdk)
- [FRAuth iOS SDK](https://github.com/ForgeRock/forgerock-ios-sdk)
- [WebAuthn Spec](https://www.w3.org/TR/webauthn-2/)
- [FIDO2 API](https://developers.google.com/identity/fido)
- [AuthenticationServices (iOS)](https://developer.apple.com/documentation/authenticationservices)
