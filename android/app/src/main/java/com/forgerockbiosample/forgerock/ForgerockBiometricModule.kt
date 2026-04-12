package com.yourapp

import android.os.Build
import com.facebook.react.bridge.*
import org.forgerock.android.auth.*
import org.forgerock.android.auth.callback.WebAuthnAuthenticationCallback
import org.forgerock.android.auth.callback.WebAuthnRegistrationCallback
import org.forgerock.android.auth.webauthn.WebAuthnKeySelector
import org.forgerock.android.auth.webauthn.WebAuthnResponseException
import org.json.JSONObject

class WebAuthnBridgeModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WebAuthnBridge"

    // Holds the reconstructed Node from JS payload
    private var currentNode: Node? = null

    // ─────────────────────────────────────────────────────────────────────────
    // JS calls this first, passing the raw step payload as JSON string
    // ─────────────────────────────────────────────────────────────────────────
    @ReactMethod
    fun setCurrentNode(nodeJSON: String, promise: Promise) {
        try {
            FRAuth.start(reactContext)
        } catch (e: Exception) {
            // Already started — ignore
        }

        try {
            val json = JSONObject(nodeJSON)
            // Node can be constructed from its raw JSON representation
            // This is how the Android SDK deserialises nodes internally
            val node = Node.fromJson(json)
            currentNode = node
            promise.resolve(WritableNativeMap().apply {
                putBoolean("success", true)
            })
        } catch (e: Exception) {
            promise.reject("NODE_PARSE_ERROR", "Failed to parse node: ${e.message}", e)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BIOMETRIC REGISTRATION
    // ─────────────────────────────────────────────────────────────────────────
    @ReactMethod
    fun registerBiometric(options: ReadableMap, promise: Promise) {
        val activity = currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "No foreground activity")
            return
        }

        val node = currentNode ?: run {
            promise.reject("NO_NODE", "Call setCurrentNode before registerBiometric")
            return
        }

        val deviceName = if (options.hasKey("deviceName"))
            options.getString("deviceName") ?: Build.MODEL
        else Build.MODEL

        val registrationCallback = node.getCallback(WebAuthnRegistrationCallback::class.java)
            ?: run {
                promise.reject("CALLBACK_NOT_FOUND", "WebAuthnRegistrationCallback not found")
                return
            }

        // Pass node → SDK handles HiddenValueCallback + node.next() internally
        registrationCallback.register(
            activity,
            deviceName,
            node,
            object : FRListener<Void> {
                override fun onSuccess(result: Void?) {
                    currentNode = null
                    promise.resolve(WritableNativeMap().apply {
                        putBoolean("success", true)
                        putString("type", "WebAuthnRegistrationSuccess")
                    })
                }
                override fun onException(e: Exception) {
                    currentNode = null
                    // Resolve so JS can call FRAuth.next() for AM fallback
                    promise.resolve(WritableNativeMap().apply {
                        putBoolean("success", false)
                        putString("type", "WebAuthnRegistrationError")
                        putString("errorCode", mapError(e))
                        putString("message", e.message ?: "")
                    })
                }
            }
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BIOMETRIC AUTHENTICATION
    // ─────────────────────────────────────────────────────────────────────────
    @ReactMethod
    fun authenticateBiometric(options: ReadableMap, promise: Promise) {
        val activity = currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "No foreground activity")
            return
        }

        val node = currentNode ?: run {
            promise.reject("NO_NODE", "Call setCurrentNode before authenticateBiometric")
            return
        }

        val authCallback = node.getCallback(WebAuthnAuthenticationCallback::class.java)
            ?: run {
                promise.reject("CALLBACK_NOT_FOUND", "WebAuthnAuthenticationCallback not found")
                return
            }

        authCallback.authenticate(
            activity,
            node,
            WebAuthnKeySelector.DEFAULT,
            object : FRListener<Void> {
                override fun onSuccess(result: Void?) {
                    currentNode = null
                    promise.resolve(WritableNativeMap().apply {
                        putBoolean("success", true)
                        putString("type", "WebAuthnAuthSuccess")
                    })
                }
                override fun onException(e: Exception) {
                    currentNode = null
                    promise.resolve(WritableNativeMap().apply {
                        putBoolean("success", false)
                        putString("type", "WebAuthnAuthError")
                        putString("errorCode", mapError(e))
                        putString("message", e.message ?: "")
                    })
                }
            }
        )
    }

    private fun mapError(e: Exception): String {
        if (e is WebAuthnResponseException) {
            return when (e.errorCode) {
                com.google.android.gms.fido.fido2.api.common.ErrorCode.NOT_SUPPORTED_ERR
                    -> "BIOMETRIC_UNSUPPORTED"
                com.google.android.gms.fido.fido2.api.common.ErrorCode.NOT_ALLOWED_ERR
                    -> "BIOMETRIC_NOT_ALLOWED"
                com.google.android.gms.fido.fido2.api.common.ErrorCode.INVALID_STATE_ERR
                    -> "BIOMETRIC_INVALID_STATE"
                com.google.android.gms.fido.fido2.api.common.ErrorCode.ABORT_ERR
                    -> "BIOMETRIC_CANCELLED"
                else -> "BIOMETRIC_CLIENT_ERROR"
            }
        }
        return if (e.message?.contains("cancel", ignoreCase = true) == true)
            "BIOMETRIC_CANCELLED"
        else "BIOMETRIC_CLIENT_ERROR"
    }
}