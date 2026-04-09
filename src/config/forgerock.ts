/**
 * ForgeRock JavaScript SDK — sample defaults for this POC.
 *
 * In your main app you already configure AM URLs / OAuth: call `configureForgeRockJs()`
 * once at startup and pass your real values; they override these samples (same keys).
 *
 * Mirror the same tenant + OAuth client in native Android `strings.xml` (forgerock_*)
 * and iOS FRAuth plist when you integrate.
 */
import type { ConfigOptions, Tokens } from '@forgerock/javascript-sdk';
import { Config } from '@forgerock/javascript-sdk';

type ServerConfig = NonNullable<ConfigOptions['serverConfig']>;

/** Copy these sample strings into `android/.../res/values/strings.xml` when wiring native. */
export const SAMPLE_ANDROID_STRINGS = {
  forgerock_url: 'https://openam-example.forgeblocks.com/am',
  forgerock_realm: 'alpha',
  forgerock_oauth_client_id: 'sdkPublicClient',
  /** Must match the OAuth client in AM; mobile-style URI is common for RN. */
  forgerock_oauth_redirect_uri: 'com.forgerockbiosample:/oauth2redirect',
  forgerock_oauth_scope: 'openid profile email address',
  forgerock_cookie_name: 'iPlanetDirectoryPro',
  forgerock_auth_service: 'rn-bio-register',
} as const;

/**
 * Sample JS SDK config — replace in main project via `configureForgeRockJs({ ... })`.
 * `AM_BASE_URL` must end with `/` for the SDK.
 */
export const SAMPLE_FORGEOCK_JS_CONFIG: ConfigOptions = {
  clientId: SAMPLE_ANDROID_STRINGS.forgerock_oauth_client_id,
  redirectUri: SAMPLE_ANDROID_STRINGS.forgerock_oauth_redirect_uri,
  scope: SAMPLE_ANDROID_STRINGS.forgerock_oauth_scope,
  realmPath: `realms/${SAMPLE_ANDROID_STRINGS.forgerock_realm}`,
  serverConfig: {
    baseUrl: `${SAMPLE_ANDROID_STRINGS.forgerock_url}/`,
    timeout: 60000,
  },
  tree: SAMPLE_ANDROID_STRINGS.forgerock_auth_service,
};

export const REGISTRATION_JOURNEY = SAMPLE_ANDROID_STRINGS.forgerock_auth_service;

/** Optional HiddenValueCallback value if your tree expects it from the client. */
export const REGISTRATION_HIDDEN_VALUE = '';

const memoryTokens = new Map<string, Tokens>();

const inMemoryTokenStore = {
  async get(clientId: string): Promise<Tokens> {
    const existing = memoryTokens.get(clientId);
    if (existing) {
      return existing;
    }
    return { accessToken: '' };
  },
  async set(clientId: string, token: Tokens) {
    memoryTokens.set(clientId, token);
  },
  async remove(clientId: string) {
    memoryTokens.delete(clientId);
  },
};

export type ForgeRockJsOverrides = Omit<Partial<ConfigOptions>, 'serverConfig'> & {
  serverConfig?: Partial<ServerConfig>;
};

/**
 * Applies ForgeRock JS `Config.set`. Pass your main-app URLs/client so they override samples.
 *
 * @example
 * configureForgeRockJs({
 *   clientId: 'myClient',
 *   serverConfig: { baseUrl: 'https://prod-am.company.com/am/' },
 *   tree: 'Registration',
 * });
 */
export function configureForgeRockJs(overrides?: ForgeRockJsOverrides): void {
  const base = SAMPLE_FORGEOCK_JS_CONFIG.serverConfig as ServerConfig;
  const mergedServer: ServerConfig = {
    ...base,
    ...overrides?.serverConfig,
    baseUrl: overrides?.serverConfig?.baseUrl ?? base.baseUrl,
    timeout: overrides?.serverConfig?.timeout ?? base.timeout,
  };

  Config.set({
    ...SAMPLE_FORGEOCK_JS_CONFIG,
    ...overrides,
    serverConfig: mergedServer,
    tokenStore: overrides?.tokenStore ?? inMemoryTokenStore,
  });
}
