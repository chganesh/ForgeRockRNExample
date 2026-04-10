package com.forgerockbiosample.forgerock

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.forgerock.android.auth.FRAuth
import org.forgerock.android.auth.FRSession
import org.forgerock.android.auth.Node
import org.forgerock.android.auth.NodeListener
import org.forgerock.android.auth.callback.NameCallback
import org.forgerock.android.auth.callback.WebAuthnAuthenticationCallback
import org.forgerock.android.auth.callback.WebAuthnRegistrationCallback

/**
 * Native bridge for WebAuthn biometric operations.
 * Uses ForgeRock SDK's built-in WebAuthn callback handlers.
 * 
 * The SDK automatically handles:
 * - Challenge extraction
 * - FIDO2 / WebAuthn API calls
 * - Biometric prompts
 * - Attestation/Assertion creation
 * - Journey continuation
 */
class ForgerockBiometricModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ForgerockBiometric"

  /**
   * Register with WebAuthn biometric.
   * The SDK's WebAuthnRegistrationCallback handles the entire flow.
   */
  @ReactMethod
  fun registerWithBiometrics(
    username: String,
    journeyName: String,
    promise: Promise
  ) {
    CoroutineScope(Dispatchers.Main).launch {
      try {
        startJourney(
          username = username,
          journeyName = journeyName,
          action = "register",
          promise = promise
        )
      } catch (e: Exception) {
        promise.reject("FR_REGISTER", e.message ?: "Unknown error", e)
      }
    }
  }

  /**
   * Authenticate with WebAuthn biometric.
   * The SDK's WebAuthnAuthenticationCallback handles the entire flow.
   */
  @ReactMethod
  fun loginWithBiometrics(
    username: String,
    journeyName: String,
    promise: Promise
  ) {
    CoroutineScope(Dispatchers.Main).launch {
      try {
        startJourney(
          username = username,
          journeyName = journeyName,
          action = "login",
          promise = promise
        )
      } catch (e: Exception) {
        promise.reject("FR_LOGIN", e.message ?: "Unknown error", e)
      }
    }
  }

  /**
   * Start the authentication journey.
   * The SDK's callback handlers manage WebAuthn automatically.
   * 
   * When WebAuthnRegistrationCallback or WebAuthnAuthenticationCallback is encountered:
   * - SDK extracts challenge
   * - SDK calls FIDO2 API
   * - SDK shows biometric prompt
   * - SDK automatically continues journey
   * - JS receives final result (success/failure)
   */
  private fun startJourney(
    username: String,
    journeyName: String,
    action: String,
    promise: Promise
  ) {
    val appContext = reactContext.applicationContext

    try {
      FRAuth.start(appContext)
    } catch (e: Exception) {
      promise.reject("FR_SDK_INIT", e.message ?: "SDK init failed", e)
      return
    }

    val listener = object : NodeListener<FRSession> {
      override fun onSuccess(result: FRSession) {
        val response: WritableMap = Arguments.createMap().apply {
          putString("platform", "android")
          putString("message", "Success ($action) - biometric authentication completed")
          putString("sessionToken", result.sessionToken)
        }
        promise.resolve(response)
      }

      override fun onException(e: Exception) {
        promise.reject("FR_AUTH_JOURNEY", e.message ?: "Journey failed", e)
      }

      override fun onCallbackReceived(node: Node) {
        try {
          val callbacks = node.callbacks
          for (cb in callbacks) {
            when (cb) {
              // SDK handles NameCallback for username
              is NameCallback -> cb.setName(username)
              
              // SDK's WebAuthnRegistrationCallback handles FIDO2 internally
              is WebAuthnRegistrationCallback -> {
                CoroutineScope(Dispatchers.Main).launch {
                  try {
                    // Simple one-liner: SDK does EVERYTHING
                    // - Extracts challenge from callback
                    // - Calls FIDO2 API
                    // - Shows biometric prompt
                    // - Handles attestation
                    // - Validates and continues journey automatically
                    cb.register(appContext, node)
                    // No need to manually call node.next() - SDK does it
                  } catch (e: Exception) {
                    promise.reject("FR_WEBAUTHN_REGISTER", e.message ?: "WebAuthn registration failed", e)
                  }
                }
                return
              }
              
              // SDK's WebAuthnAuthenticationCallback handles FIDO2 internally
              is WebAuthnAuthenticationCallback -> {
                CoroutineScope(Dispatchers.Main).launch {
                  try {
                    // Simple one-liner: SDK does EVERYTHING
                    // - Extracts challenge from callback
                    // - Calls FIDO2 API
                    // - Shows biometric prompt
                    // - Handles assertion
                    // - Validates and continues journey automatically
                    cb.authenticate(appContext, node)
                    // No need to manually call node.next() - SDK does it
                  } catch (e: Exception) {
                    promise.reject("FR_WEBAUTHN_AUTH", e.message ?: "WebAuthn authentication failed", e)
                  }
                }
                return
              }
            }
          }
          node.next(appContext, this)
        } catch (e: Exception) {
          promise.reject("FR_NODE_CALLBACK", e.message ?: "Callback processing failed", e)
        }
      }
    }

    FRSession.authenticate(appContext, journeyName, listener)
  }
}

