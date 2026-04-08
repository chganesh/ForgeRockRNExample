import { NativeModules } from 'react-native';

type LoginResult = {
  platform: 'android' | 'ios';
  message: string;
};

type ForgerockBiometricNative = {
  loginWithBiometrics(username: string): Promise<LoginResult>;
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
  loginWithBiometrics(username: string) {
    // Username is passed to native in-memory only; do not persist it.
    return getModule().loginWithBiometrics(username);
  },
};

