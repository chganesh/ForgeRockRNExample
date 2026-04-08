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
import org.forgerock.android.auth.FRUser
import org.forgerock.android.auth.Node
import org.forgerock.android.auth.NodeListener
import org.forgerock.android.auth.callback.NameCallback
import org.forgerock.android.auth.callback.WebAuthnAuthenticationCallback

class ForgerockBiometricModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ForgerockBiometric"

  @ReactMethod
  fun loginWithBiometrics(username: String, promise: Promise) {
    val appContext = reactContext.applicationContext

    try {
      // Uses native SDK; requires your ForgeRock/Ping config in Android resources.
      FRAuth.start(appContext)
    } catch (e: Exception) {
      promise.reject("FR_SDK_INIT", e)
      return
    }

    FRUser.login(
      appContext,
      object : NodeListener<FRUser> {
        override fun onSuccess(result: FRUser) {
          promise.resolve(
            mapOf(
              "platform" to "android",
              "message" to "Authenticated (FRUser session established).",
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
                is WebAuthnAuthenticationCallback -> {
                  // WebAuthn biometric prompt handled by ForgeRock SDK.
                  CoroutineScope(Dispatchers.Main).launch {
                    try {
                      cb.authenticate(appContext, node)
                      node.next(appContext, this@object)
                    } catch (e: Exception) {
                      promise.reject("FR_WEBAUTHN", e)
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
      },
    )
  }
}

