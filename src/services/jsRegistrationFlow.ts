import {
  CallbackType,
  FRAuth,
  FRLoginFailure,
  FRLoginSuccess,
  FRStep,
  FRWebAuthn,
  StepType,
  WebAuthnStepType,
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
      kind: 'handoff_native_webauthn';
      webAuthnKind: 'registration' | 'authentication';
      authId?: string;
      detail: string;
    }
  | {
      kind: 'native_biometric_completed';
      webAuthnKind: 'registration' | 'authentication';
      authId?: string;
      native: { platform: string; message: string };
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
  /**
   * When the JavaScript SDK receives a WebAuthn step, Hermes cannot run browser WebAuthn.
   * If true, this automatically invokes the native ForgeRock SDK (platform biometrics / WebAuthn).
   */
  triggerNativeOnWebAuthnCallback?: boolean;
  /** If you already called `configureForgeRockJs` in App.tsx, skip re-applying samples. */
  skipConfigure?: boolean;
  /** Merged into `configureForgeRockJs` when `skipConfigure` is false. */
  forgeRockOverrides?: ForgeRockJsOverrides;
};

/**
 * Runs the journey with the JavaScript SDK: handles Name / HiddenValue callbacks until
 * LoginSuccess, LoginFailure, or a WebAuthn step.
 *
 * If `triggerNativeOnWebAuthnCallback` is true, WebAuthn steps trigger the native module:
 * registration → `registerWithBiometrics`, authentication → `loginWithBiometrics`.
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

      const step = current as FRStep;
      const webAuthnKind = FRWebAuthn.getWebAuthnStepType(step);
      const authId = step.payload.authId;

      if (webAuthnKind === WebAuthnStepType.Registration) {
        if (options.triggerNativeOnWebAuthnCallback) {
          const native = await ForgerockBiometric.registerWithBiometrics(
            username,
            journeyName,
          );
          return {
            kind: 'native_biometric_completed',
            webAuthnKind: 'registration',
            authId,
            native,
          };
        }
        return {
          kind: 'handoff_native_webauthn',
          webAuthnKind: 'registration',
          authId,
          detail:
            'WebAuthn registration callback from AM — use native ForgeRock SDK for platform biometrics.',
        };
      }

      if (webAuthnKind === WebAuthnStepType.Authentication) {
        if (options.triggerNativeOnWebAuthnCallback) {
          const native = await ForgerockBiometric.loginWithBiometrics(
            username,
            journeyName,
          );
          return {
            kind: 'native_biometric_completed',
            webAuthnKind: 'authentication',
            authId,
            native,
          };
        }
        return {
          kind: 'handoff_native_webauthn',
          webAuthnKind: 'authentication',
          authId,
          detail:
            'WebAuthn authentication callback from AM — use native ForgeRock SDK for platform biometrics.',
        };
      }

      fillKnownCallbacks(step, username);
      current = await FRAuth.next(step);
    }

    return {
      kind: 'error',
      message: `Stopped after ${MAX_STEPS} steps — add handlers for more callback types or verify the journey.`,
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
  return runJourneyWithJsThenNativeBiometric(username, {
    triggerNativeOnWebAuthnCallback: false,
  });
}
