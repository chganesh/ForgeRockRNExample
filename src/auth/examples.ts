/**
 * Example: End-to-End Registration Flow
 * 
 * Shows how to use:
 * - forgeRockService: Configure and start journey
 * - stepHandler: Process each step recursively
 * - webAuthnHandler: Detect WebAuthn and call native bridge
 */
import * as FRService from './forgeRockService';
import { handleStep } from './stepHandler';

/**
 * Example 1: Initialize ForgeRock at app startup
 */
export async function initializeApp() {
  FRService.init({
    amBaseUrl: 'https://openam-example.forgeblocks.com/am',
    realm: 'alpha',
    clientId: 'sdkPublicClient',
    registrationJourney: 'rn-bio-register',
    authenticationJourney: 'rn-bio-login',
  });

  console.log('✅ App initialized');
}

/**
 * Example 2: Start registration journey
 */
export async function registerWithBiometric(username: string) {
  try {
    console.log('📝 Starting registration...');

    // 1️⃣  Start the journey
    const firstStep = await FRService.startJourney('rn-bio-register');

    // 2️⃣  Recursively process steps
    // handleStep will:
    // - Detect WebAuthn callbacks
    // - Call native bridge for biometric
    // - Fill username/password/email
    // - Continue until success or failure
    const result = await handleStep(firstStep, {
      username,
      password: 'Password@123', // ⚠️ Don't hardcode in production!
    });

    if (result.kind === 'success') {
      console.log('✅ Registration successful!');
      console.log('Session token:', result.sessionToken);
      return { ok: true, sessionToken: result.sessionToken };
    } else {
      console.log('❌ Registration failed:', result.message);
      return { ok: false, error: result.message };
    }

  } catch (error) {
    console.error('❌ Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Example 3: Start authentication journey
 */
export async function authenticateWithBiometric(username: string) {
  try {
    console.log('🔐 Starting authentication...');

    // 1️⃣  Start the journey
    const firstStep = await FRService.startJourney('rn-bio-login');

    // 2️⃣  Recursively process steps
    // handleStep will:
    // - Detect WebAuthn callbacks
    // - Call native bridge for biometric
    // - Fill username if needed
    // - Continue until success or failure
    const result = await handleStep(firstStep, {
      username,
    });

    if (result.kind === 'success') {
      console.log('✅ Authentication successful!');
      console.log('Session token:', result.sessionToken);
      return { ok: true, sessionToken: result.sessionToken };
    } else {
      console.log('❌ Authentication failed:', result.message);
      return { ok: false, error: result.message };
    }

  } catch (error) {
    console.error('❌ Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Example 4: Logout
 */
export async function logout() {
  try {
    await FRService.logout();
    console.log('👋 Logged out successfully');
    return { ok: true };
  } catch (error) {
    console.error('Error logging out:', error);
    return { ok: false, error: String(error) };
  }
}

// ============================================================================
// Flow Diagrams
// ============================================================================

/*
📝 REGISTRATION FLOW:

1. React Component calls: registerWithBiometric('ganesh')
   |
2. FRService.startJourney('rn-bio-register')
   ├─ JS SDK calls ForgeRock AM
   └─ Returns Step 1 (usually NameCallback)
   |
3. handleStep(step1, {username: 'ganesh'})
   ├─ Detect NameCallback → Fill with 'ganesh'
   ├─ Call step.next()
   └─ Returns Step 2 (usually PasswordCallback)
   |
4. handleStep(step2, ...)
   ├─ Detect PasswordCallback → Fill with password
   ├─ Call step.next()
   └─ Returns Step 3 (EmailCallback or WebAuthnRegistrationCallback)
   |
5. handleStep(step3, ...)
   ├─ Detect WebAuthnRegistrationCallback
   ├─ Call handleWebAuthn(step3)
   │  └─ Call ForgeRockBridge.handleWebAuthn(step)
   │     └─ Native SDK (Android/iOS):
   │        ├─ Extract challenge
   │        ├─ Call FIDO2 / AuthenticationServices
   │        ├─ Show biometric prompt
   │        ├─ Create attestation
   │        ├─ Continue journey
   │        └─ Return next step
   │  └─ handleStep(nextStep, ...)
   └─ Recurse until LoginSuccess
   |
6. Return { ok: true, sessionToken: '...' }


🔓 AUTHENTICATION FLOW:

1. React Component calls: authenticateWithBiometric('ganesh')
   |
2. FRService.startJourney('rn-bio-login')
   ├─ JS SDK calls ForgeRock AM
   └─ Returns Step 1 (usually NameCallback)
   |
3. handleStep(step1, {username: 'ganesh'})
   ├─ Detect NameCallback → Fill with 'ganesh'
   ├─ Call step.next()
   └─ Returns Step 2 (WebAuthnAuthenticationCallback)
   |
4. handleStep(step2, ...)
   ├─ Detect WebAuthnAuthenticationCallback
   ├─ Call handleWebAuthn(step2)
   │  └─ Call ForgeRockBridge.handleWebAuthn(step)
   │     └─ Native SDK (Android/iOS):
   │        ├─ Extract challenge
   │        ├─ Call FIDO2 / AuthenticationServices
   │        ├─ Show biometric prompt (Face ID/Touch ID)
   │        ├─ Create assertion
   │        ├─ Continue journey
   │        └─ Return next step
   │  └─ handleStep(nextStep, ...)
   └─ Recurse until LoginSuccess
   |
5. Return { ok: true, sessionToken: '...' }


💡 BRAIN/MUSCLE PATTERN:

┌─────────────────────────────────────┐
│  BRAIN 🧠 (JavaScript)              │
│  ─────────────────────────────────  │
│  - forgeRockService: Config & init   │
│  - stepHandler: Flow control         │
│  - webAuthnHandler: Detect & bridge  │
└────────────┬────────────────────────┘
             │ Calls native when
             │ WebAuthn detected
             │
┌────────────▼────────────────────────┐
│  MUSCLE 💪 (Native)                 │
│  ─────────────────────────────────  │
│  Android: ForgeRockBridgeModule.kt   │
│  - Call FIDO2 API                    │
│  - Show biometric prompt             │
│  - Create credential                 │
│  - Return result                     │
│                                      │
│  iOS: ForgeRockBridge.swift          │
│  - Call AuthenticationServices       │
│  - Show Face ID/Touch ID/Passkey     │
│  - Create credential                 │
│  - Return result                     │
└─────────────────────────────────────┘
*/

/**
 * Usage in React Component Example:
 * 
 * import React, { useState } from 'react';
 * import { View, TextInput, Button, Text } from 'react-native';
 * import * as Auth from './auth/examples';
 * 
 * export function RegisterScreen() {
 *   const [username, setUsername] = useState('');
 *   const [loading, setLoading] = useState(false);
 *   const [message, setMessage] = useState('');
 * 
 *   const handleRegister = async () => {
 *     setLoading(true);
 *     try {
 *       const result = await Auth.registerWithBiometric(username);
 *       if (result.ok) {
 *         setMessage('✅ Registration successful!');
 *       } else {
 *         setMessage(`❌ ${result.error}`);
 *       }
 *     } finally {
 *       setLoading(false);
 *     }
 *   };
 * 
 *   return (
 *     <View>
 *       <TextInput
 *         placeholder="Username"
 *         value={username}
 *         onChangeText={setUsername}
 *       />
 *       <Button
 *         title="Register with Biometric"
 *         onPress={handleRegister}
 *         disabled={loading}
 *       />
 *       {message && <Text>{message}</Text>}
 *     </View>
 *   );
 * }
 */
