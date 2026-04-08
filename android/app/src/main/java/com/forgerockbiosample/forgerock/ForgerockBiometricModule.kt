package com.forgerockbiosample.forgerock

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.forgerock.android.auth.FRAuth
import org.forgerock.android.auth.FRSession
import org.forgerock.android.auth.Node
import org.forgerock.android.auth.NodeListener
import org.forgerock.android.auth.callback.HiddenValueCallback
import org.forgerock.android.auth.callback.NameCallback
import org.forgerock.android.auth.callback.WebAuthnAuthenticationCallback
import org.forgerock.android.auth.callback.WebAuthnRegistrationCallback
import org.forgerock.android.auth.callback.WebAuthnRegistrationCallback.Registration
import org.forgerock.android.auth.callback.WebAuthnRegistrationCallback.UserVerification
import org.forgerock.android.auth.AuthService

class ForgerockBiometricModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ForgerockBiometric"

  @ReactMethod
  fun registerWithBiometrics(username: String, journeyName: String, promise: Promise) {
    startJourney(username = username, journeyName = journeyName, action = "register", promise = promise)
  }

  @ReactMethod
  fun loginWithBiometrics(username: String, journeyName: String, promise: Promise) {
    startJourney(username = username, journeyName = journeyName, action = "login", promise = promise)
  }

  private fun startJourney(username: String, journeyName: String, action: String, promise: Promise) {
    val appContext = reactContext.applicationContext

    try {
      // Uses native SDK; requires your ForgeRock/Ping config in Android resources.
      FRAuth.start(appContext)
    } catch (e: Exception) {
      promise.reject("FR_SDK_INIT", e)
      return
    }

    val listener =
      object : NodeListener<FRSession> {
        override fun onSuccess(result: FRSession) {
          promise.resolve(
            mapOf(
              "platform" to "android",
              "message" to "Success ($action) - session established for journey '$journeyName'.",
            ),
          )
        }

        override fun onException(e: Exception) {
          promise.reject("FR_AUTH", e)
        }

        override fun onCallbackReceived(node: Node) {
          try {
            val callbacks = node.callbacks
            for (cb in callbacks) {
              when (cb) {
                is NameCallback -> cb.setName(username)
                is WebAuthnRegistrationCallback -> {
                  CoroutineScope(Dispatchers.Main).launch {
                    try {
                      cb.register(appContext, node)
                      node.next(appContext, this@object)
                    } catch (e: Exception) {
                      promise.reject("FR_WEBAUTHN_REGISTER", e)
                    }
                  }
                  return
                }
                is WebAuthnAuthenticationCallback -> {
                  CoroutineScope(Dispatchers.Main).launch {
                    try {
                      cb.authenticate(appContext, node)
                      node.next(appContext, this@object)
                    } catch (e: Exception) {
                      promise.reject("FR_WEBAUTHN_AUTH", e)
                    }
                  }
                  return
                }
              }
            }
            node.next(appContext, this)
          } catch (e: Exception) {
            promise.reject("FR_NODE", e)
          }
        }
      }

    // Start the specific tree/journey name.
    FRSession.authenticate(appContext, journeyName, listener)
  }
}

