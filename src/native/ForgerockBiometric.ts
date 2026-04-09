import { NativeModules } from 'react-native';

type LoginResult = {
  platform: 'android' | 'ios';
  message: string;
};

type ForgerockBiometricNative = {
  registerWithBiometrics(username: string, journeyName: string): Promise<LoginResult>;
  loginWithBiometrics(username: string, journeyName: string): Promise<LoginResult>;
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

  registerWithBiometrics(username: string, journeyName?: string) {
    // Username is passed to native in-memory only; do not persist it.
    return getModule().registerWithBiometrics(
      username,
      journeyName ?? DEFAULT_REGISTER_JOURNEY,
    );
  },

  loginWithBiometrics(username: string, journeyName?: string) {
    // Username is passed to native in-memory only; do not persist it.
    return getModule().loginWithBiometrics(
      username,
      journeyName ?? DEFAULT_LOGIN_JOURNEY,
    );
  },
};

