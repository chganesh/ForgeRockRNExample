/**
 * Step Handler - Journey step orchestration
 * 
 * Responsibilities:
 * - Process each step in the authentication journey
 * - Detect and log all callbacks
 * - Fill known callbacks (username, password, etc)
 * - Detect WebAuthn callbacks and delegate to native bridge
 * - Recursively handle next steps
 * 
 * Flow:
 * 1. Check if LoginSuccess → Done! ✅
 * 2. Get all callbacks in the step
 * 3. Detect WebAuthn → Call native bridge (SDK handles biometric)
 * 4. Fill other callbacks (name, password, etc)
 * 5. Call step.next() and recurse
 */
import { handleWebAuthn } from './webAuthnHandler';

/**
 * Main step handler - recursively processes the authentication journey
 * 
 * @param step Current step from ForgeRock SDK
 * @param credentials Optional credentials (username, password, etc)
 * @returns Final result when journey completes
 */
export const handleStep = async (
  step: any,
  credentials?: { username?: string; password?: string }
): Promise<any> => {
  // Log the current step type
  console.log('📍 Step Type:', step.type);

  // ✅ Journey complete - success
  if (step.type === 'LoginSuccess') {
    console.log('✅ Journey Complete - Login Successful');
    return { kind: 'success', sessionToken: step.getSessionToken?.() };
  }

  // ❌ Journey failed
  if (step.type === 'LoginFailure') {
    console.log('❌ Journey Failed:', step.getMessage?.());
    return { kind: 'failure', message: step.getMessage?.() };
  }

  // 🔄 Regular step - get callbacks
  const callbacks = step.getCallbacks?.() ?? [];
  console.log(`📦 Callbacks: ${callbacks.map((cb: any) => cb.getType?.()).join(', ')}`);

  // 🔥 Detect WebAuthn - delegate to native bridge
  const hasWebAuthn = callbacks.some(
    (cb: any) =>
      cb.getType?.() === 'WebAuthnRegistrationCallback' ||
      cb.getType?.() === 'WebAuthnAuthenticationCallback'
  );

  if (hasWebAuthn) {
    console.log('🎯 WebAuthn detected - delegating to native bridge');
    return handleWebAuthn(step);
  }

  // 📝 Fill known callbacks
  console.log('📝 Filling callbacks...');
  callbacks.forEach((cb: any) => {
    const type = cb.getType?.();

    switch (type) {
      case 'NameCallback':
        if (credentials?.username) {
          console.log(`  ✓ Setting username: ${credentials.username}`);
          cb.setName?.(credentials.username);
        }
        break;

      case 'PasswordCallback':
        if (credentials?.password) {
          console.log(`  ✓ Setting password: ••••••••`);
          cb.setPassword?.(credentials.password);
        }
        break;

      case 'StringAttributeInputCallback':
        const prompt = cb.getPrompt?.();
        if (prompt === 'email' || prompt === 'mail') {
          if (credentials?.username) {
            console.log(`  ✓ Setting email: ${credentials.username}`);
            cb.setValue?.(credentials.username);
          }
        }
        break;

      case 'HiddenValueCallback':
        // Used for CSRF tokens, usually auto-filled
        console.log(`  ✓ HiddenValueCallback (auto)`);
        break;

      default:
        console.log(`  ⚠️  Unhandled callback: ${type}`);
    }
  });

  // ➡️ Proceed to next step
  console.log('⏭️  Moving to next step...');
  try {
    const nextStep = await step.next?.();
    return handleStep(nextStep, credentials);
  } catch (error) {
    console.error('❌ Error getting next step:', error);
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : 'Error advancing journey',
    };
  }
};
