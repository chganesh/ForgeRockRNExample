import {
  CallbackType,
  FRAuth,
  FRLoginFailure,
  FRLoginSuccess,
  FRStep,
  StepType,
} from '@forgerock/javascript-sdk';
import {
  configureForgeRockJs,
  ForgeRockJsOverrides,
  REGISTRATION_HIDDEN_VALUE,
  REGISTRATION_JOURNEY,
} from '../config/forgerock';
import { ForgerockBiometric } from '../native/ForgerockBiometric';

export type JsRegistrationResult =
  | {
      kind: 'login_success';
      sessionToken?: string;
    }
  | {
      kind: 'login_failure';
      message?: string;
    }
  | {
      kind: 'error';
      message: string;
    };

const MAX_STEPS = 25;

function fillKnownCallbacks(step: FRStep, username: string): void {
  try {
    step.setCallbackValue(CallbackType.NameCallback, username);
  } catch {
    // no NameCallback in this step
  }
  if (REGISTRATION_HIDDEN_VALUE !== '') {
    try {
      step.setCallbackValue(
        CallbackType.HiddenValueCallback,
        REGISTRATION_HIDDEN_VALUE,
      );
    } catch {
      // no HiddenValueCallback
    }
  }
}

export type JourneyOptions = {
  /** Defaults to registration journey from config. */
  journeyName?: string;
  /** If you already called `configureForgeRockJs` in App.tsx, skip re-applying samples. */
  skipConfigure?: boolean;
  /** Merged into `configureForgeRockJs` when `skipConfigure` is false. */
  forgeRockOverrides?: ForgeRockJsOverrides;
};

/**
 * Runs the journey with the JavaScript SDK + Native WebAuthn.
 * 
 * The flow:
 * 1. JS SDK calls AM journey
 * 2. JS SDK encounters WebAuthnRegistrationCallback or WebAuthnAuthenticationCallback
 * 3. SDK's callback handlers manage WebAuthn completely:
 *    - Extract challenge
 *    - Call FIDO2 / AuthenticationServices
 *    - Show biometric prompt
 *    - Handle attestation/assertion
 *    - Continue journey
 * 4. Journey completes with success or failure
 * 
 * No manual payload extraction needed!
 */
export async function runJourneyWithJsThenNativeBiometric(
  username: string,
  options: JourneyOptions = {},
): Promise<JsRegistrationResult> {
  const journeyName = options.journeyName ?? REGISTRATION_JOURNEY;

  if (!options.skipConfigure) {
    try {
      configureForgeRockJs(options.forgeRockOverrides);
    } catch (e) {
      return {
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }

  try {
    let current = await FRAuth.start({ tree: journeyName });

    for (let i = 0; i < MAX_STEPS; i++) {
      if (current.type === StepType.LoginSuccess) {
        const ok = current as FRLoginSuccess;
        return {
          kind: 'login_success',
          sessionToken: ok.getSessionToken(),
        };
      }
      if (current.type === StepType.LoginFailure) {
        const fail = current as FRLoginFailure;
        return {
          kind: 'login_failure',
          message: fail.getMessage(),
        };
      }

      // Fill known callbacks and proceed
      const step = current as FRStep;
      fillKnownCallbacks(step, username);
      current = await FRAuth.next(step);
    }

    return {
      kind: 'error',
      message: `Stopped after ${MAX_STEPS} steps — verify the journey configuration.`,
    };
  } catch (e) {
    return {
      kind: 'error',
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

/** @deprecated Use `runJourneyWithJsThenNativeBiometric`. */
export async function runRegistrationJsUntilNativeBiometric(
  username: string,
): Promise<JsRegistrationResult> {
  return runJourneyWithJsThenNativeBiometric(username);
}
