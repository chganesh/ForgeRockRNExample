/**
 * ForgeRock WebAuthn - Simplified POC
 * 
 * Flow:
 * 1. Call register() or authenticate()
 * 2. JS SDK starts journey → gets first step
 * 3. stepHandler processes step recursively
 * 4. When WebAuthn detected → call native bridge
 * 5. Native SDK does biometric → returns next step
 * 6. Continue until success/failure
 * 
 * That's it!
 */
import { FRAuth, StepType } from '@forgerock/javascript-sdk';
import { NativeModules } from 'react-native';

const { ForgeRockBridge } = NativeModules;

// ============================================================================
// Simple Entry Points
// ============================================================================

export async function register(username: string, password: string) {
  console.log('📝 Starting registration...');
  try {
    // Initialize SDK
    initSDK();

    // Start journey
    let step = await FRAuth.start({ tree: 'rn-bio-register' });

    // Process recursively
    const result = await processStep(step, { username, password });

    if (result.ok) {
      console.log('✅ Registration successful!');
    } else {
      console.log('❌ Registration failed:', result.error);
    }

    return result;
  } catch (error) {
    console.error('❌ Error:', error);
    return { ok: false, error: String(error) };
  }
}

export async function authenticate(username: string) {
  console.log('🔐 Starting authentication...');
  try {
    // Initialize SDK
    initSDK();

    // Start journey
    let step = await FRAuth.start({ tree: 'rn-bio-login' });

    // Process recursively
    const result = await processStep(step, { username });

    if (result.ok) {
      console.log('✅ Authentication successful!');
    } else {
      console.log('❌ Authentication failed:', result.error);
    }

    return result;
  } catch (error) {
    console.error('❌ Error:', error);
    return { ok: false, error: String(error) };
  }
}

// ============================================================================
// Core Logic - Process Steps
// ============================================================================

async function processStep(
  step: any,
  credentials?: { username?: string; password?: string }
): Promise<{ ok: boolean; sessionToken?: string; error?: string }> {
  try {
    // ✅ Success
    if (step.type === StepType.LoginSuccess) {
      console.log('✅ Journey Complete');
      return {
        ok: true,
        sessionToken: step.getSessionToken?.(),
      };
    }

    // ❌ Failure
    if (step.type === StepType.LoginFailure) {
      console.log('❌ Journey Failed');
      return {
        ok: false,
        error: step.getMessage?.() ?? 'Authentication failed',
      };
    }

    // 🔄 Regular step - process callbacks
    const callbacks = step.getCallbacks?.() ?? [];
    console.log(`📦 Callbacks: ${callbacks.map((cb: any) => cb.getType?.()).join(', ')}`);

    // 🔥 Check for WebAuthn - delegate to native
    const hasWebAuthn = callbacks.some(
      (cb: any) =>
        cb.getType?.() === 'WebAuthnRegistrationCallback' ||
        cb.getType?.() === 'WebAuthnAuthenticationCallback'
    );

    if (hasWebAuthn) {
      console.log('🎯 WebAuthn detected - delegating to native bridge');
      // Call native bridge - it handles EVERYTHING
      const nextStepJson = await ForgeRockBridge.handleWebAuthn(JSON.stringify(step));
      const nextStep = JSON.parse(nextStepJson);
      // Recurse with next step
      return processStep(nextStep, credentials);
    }

    // 📝 Fill known callbacks
    callbacks.forEach((cb: any) => {
      const type = cb.getType?.();
      switch (type) {
        case 'NameCallback':
          if (credentials?.username) {
            cb.setName?.(credentials.username);
            console.log(`  ✓ Username: ${credentials.username}`);
          }
          break;

        case 'PasswordCallback':
          if (credentials?.password) {
            cb.setPassword?.(credentials.password);
            console.log(`  ✓ Password: ••••••`);
          }
          break;

        case 'StringAttributeInputCallback':
          if (credentials?.username && cb.getPrompt?.()?.includes('mail')) {
            cb.setValue?.(credentials.username);
            console.log(`  ✓ Email: ${credentials.username}`);
          }
          break;

        default:
          // Ignore other callbacks
          break;
      }
    });

    // ➡️ Continue to next step
    const nextStep = await step.next?.();
    return processStep(nextStep, credentials);

  } catch (error) {
    console.error('❌ Error processing step:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// SDK Initialization
// ============================================================================

let sdkInitialized = false;

function initSDK() {
  if (sdkInitialized) return;

  // TODO: Update with your actual config
  try {
    // SDK initialization happens here
    // You can add Config.set() if needed
    sdkInitialized = true;
    console.log('✅ SDK initialized');
  } catch (error) {
    console.error('❌ SDK init error:', error);
  }
}
