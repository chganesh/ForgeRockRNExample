import { NativeModules } from 'react-native';

/**
 * Generic operation result from native module.
 * The SDK handles all WebAuthn complexity internally.
 */
export type OperationResult = {
  platform: 'android' | 'ios';
  message: string;
  sessionToken?: string;
};

type ForgerockBiometricNative = {
  /**
   * Register with WebAuthn biometric.
   * The SDK's WebAuthnRegistrationCallback handles:
   * - Challenge extraction from callback
   * - FIDO2 / AuthenticationServices API calls
   * - Biometric prompts
   * - Attestation creation
   * - Journey continuation
   */
  registerWithBiometrics(username: string, journeyName: string): Promise<OperationResult>;

  /**
   * Authenticate with WebAuthn biometric.
   * The SDK's WebAuthnAuthenticationCallback handles:
   * - Challenge extraction
   * - FIDO2 / AuthenticationServices API calls
   * - Biometric prompts
   * - Assertion signing
   * - Journey continuation
   */
  loginWithBiometrics(username: string, journeyName: string): Promise<OperationResult>;
};

const { ForgerockBiometric: NativeForgerockBiometric } = NativeModules as {
  ForgerockBiometric?: ForgerockBiometricNative;
};

const DEFAULT_REGISTER_JOURNEY = 'rn-bio-register';
const DEFAULT_LOGIN_JOURNEY = 'rn-bio-login';

function getModule(): ForgerockBiometricNative {
  if (!NativeForgerockBiometric) {
    throw new Error(
      'Native module ForgerockBiometric is not linked. Rebuild the app.',
    );
  }
  return NativeForgerockBiometric;
}

export const ForgerockBiometric = {
  defaultRegisterJourney: DEFAULT_REGISTER_JOURNEY,
  defaultLoginJourney: DEFAULT_LOGIN_JOURNEY,

  /**
   * Register with WebAuthn biometric.
   * @param username Username for registration
   * @param journeyName ForgeRock journey/tree name
   */
  registerWithBiometrics(username: string, journeyName?: string) {
    return getModule().registerWithBiometrics(
      username,
      journeyName ?? DEFAULT_REGISTER_JOURNEY,
    );
  },

  /**
   * Authenticate with WebAuthn biometric.
   * @param username Username for authentication
   * @param journeyName ForgeRock journey/tree name
   */
  loginWithBiometrics(username: string, journeyName?: string) {
    return getModule().loginWithBiometrics(
      username,
      journeyName ?? DEFAULT_LOGIN_JOURNEY,
    );
  },
};

