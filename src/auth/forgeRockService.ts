/**
 * ForgeRock Service - Configuration and journey initialization
 * 
 * Responsibilities:
 * - Configure ForgeRock SDK once at app startup
 * - Start journeys
 * - Manage session tokens
 */
import type { ConfigOptions, Tokens } from '@forgerock/javascript-sdk';
import { Config, FRAuth } from '@forgerock/javascript-sdk';

// ============================================================================
// Configuration
// ============================================================================

/** Update these with your actual ForgeRock AM details */
export const DEFAULT_CONFIG = {
  amBaseUrl: 'https://openam-example.forgeblocks.com/am',
  realm: 'alpha',
  clientId: 'sdkPublicClient',
  redirectUri: 'com.forgerockbiosample:/oauth2redirect',
  scope: 'openid profile email address',
  registrationJourney: 'rn-bio-register',
  authenticationJourney: 'rn-bio-login',
};

// ============================================================================
// Token Storage (Replace with encrypted storage in production)
// ============================================================================

const memoryTokens = new Map<string, Tokens>();

const tokenStore = {
  async get(clientId: string): Promise<Tokens> {
    return memoryTokens.get(clientId) ?? { accessToken: '' };
  },
  async set(clientId: string, token: Tokens) {
    memoryTokens.set(clientId, token);
  },
  async remove(clientId: string) {
    memoryTokens.delete(clientId);
  },
};

// ============================================================================
// Public API
// ============================================================================

export type ForgeRockConfig = Partial<typeof DEFAULT_CONFIG>;

/**
 * Initialize ForgeRock SDK - call once at app startup
 * 
 * @example
 * FRService.init({
 *   amBaseUrl: 'https://am.company.com/am',
 *   clientId: 'mobile-client',
 *   registrationJourney: 'SignUp',
 *   authenticationJourney: 'SignIn',
 * });
 */
export function init(config: ForgeRockConfig = {}): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  Config.set({
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
    scope: cfg.scope,
    realmPath: `realms/${cfg.realm}`,
    serverConfig: {
      baseUrl: cfg.amBaseUrl.endsWith('/') ? cfg.amBaseUrl : `${cfg.amBaseUrl}/`,
      timeout: 60000,
    },
    tree: cfg.registrationJourney,
    tokenStore,
  });

  console.log('✅ ForgeRock SDK initialized');
}

/**
 * Start an authentication journey
 * 
 * @example
 * const step = await FRService.startJourney('registration-journey');
 */
export async function startJourney(journeyName: string): Promise<any> {
  console.log(`🚀 Starting journey: ${journeyName}`);
  return FRAuth.start({ tree: journeyName });
}

/**
 * Get session token if authenticated
 */
export function getSessionToken(): string | undefined {
  return FRAuth.getSessionToken();
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  await FRAuth.logout();
  console.log('👋 Logged out');
}
