import { NativeModules } from 'react-native';

type LoginResult = {
  platform: 'android' | 'ios';
  message: string;
};

type ForgerockBiometricNative = {
  registerWithBiometrics(username: string, journeyName: string): Promise<LoginResult>;
  loginWithBiometrics(username: string, journeyName: string): Promise<LoginResult>;
};

const { ForgerockBiometric } = NativeModules as {
  ForgerockBiometric?: ForgerockBiometricNative;
};

function getModule(): ForgerockBiometricNative {
  if (!ForgerockBiometric) {
    throw new Error(
      'Native module ForgerockBiometric is not linked. Rebuild the app.',
    );
  }
  return ForgerockBiometric;
}

export const ForgerockBiometric = {
  defaultRegisterJourney: 'rn-bio-register',
  defaultLoginJourney: 'rn-bio-login',

  registerWithBiometrics(username: string, journeyName?: string) {
    // Username is passed to native in-memory only; do not persist it.
    return getModule().registerWithBiometrics(
      username,
      journeyName ?? ForgerockBiometric.defaultRegisterJourney,
    );
  },

  loginWithBiometrics(username: string, journeyName?: string) {
    // Username is passed to native in-memory only; do not persist it.
    return getModule().loginWithBiometrics(
      username,
      journeyName ?? ForgerockBiometric.defaultLoginJourney,
    );
  },
};

