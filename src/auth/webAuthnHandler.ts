/**
 * WebAuthn Handler - Delegate WebAuthn to native bridge
 * 
 * Brain/Muscle Pattern:
 * - JS SDK = Brain (flow control)
 * - Native SDK = Muscle (WebAuthn biometric execution)
 * 
 * When WebAuthnRegistrationCallback or WebAuthnAuthenticationCallback is detected,
 * this handler calls the native bridge which uses ForgeRock's native SDKs to:
 * - Extract challenge
 * - Call FIDO2 (Android) or AuthenticationServices (iOS)
 * - Show biometric prompt
 * - Create attestation/assertion
 * - Continue journey automatically
 */
import { NativeModules } from 'react-native';
import { handleStep } from './stepHandler';

const { ForgeRockBridge } = NativeModules;

/**
 * Handle WebAuthn callback by delegating to native bridge
 * 
 * The native bridge will:
 * 1. Parse the step and detect WebAuthn callback
 * 2. Extract challenge from callback payload
 * 3. Call platform WebAuthn APIs (FIDO2 or AuthenticationServices)
 * 4. Show biometric prompt to user
 * 5. Create attestation (registration) or assertion (authentication)
 * 6. Validate response
 * 7. Continue the journey to get next step
 * 8. Return next step to JS
 * 
 * @param step Current step containing WebAuthn callback
 * @param credentials Optional credentials for subsequent steps
 * @returns Result from continuing the journey
 */
export const handleWebAuthn = async (
  step: any,
  credentials?: { username?: string; password?: string }
): Promise<any> => {
  try {
    console.log('🎯 WebAuthn callback detected');
    console.log('📤 Passing step to native bridge...');

    // Convert step to JSON to pass to native
    const stepJson = JSON.stringify(step);

    // Call native bridge - it handles all WebAuthn complexity
    console.log('🔐 Native SDK: Extracting challenge → Calling FIDO2/AuthenticationServices → Showing biometric prompt → Creating credential');
    const response = await ForgeRockBridge.handleWebAuthn(stepJson);

    // Parse next step from native
    console.log('📥 Received next step from native bridge');
    const nextStep = JSON.parse(response);

    // Recursively handle next step
    return handleStep(nextStep, credentials);

  } catch (error) {
    console.error('❌ WebAuthn error:', error);
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : 'WebAuthn failed',
    };
  }
};
