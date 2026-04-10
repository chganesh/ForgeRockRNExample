package com.forgerockbiosample.forgerock

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import org.forgerock.android.auth.FRAuth
import org.forgerock.android.auth.Node
import org.forgerock.android.auth.NodeListener
import org.forgerock.android.auth.FRSession
import org.forgerock.android.auth.callback.WebAuthnAuthenticationCallback
import org.forgerock.android.auth.callback.WebAuthnRegistrationCallback
import org.json.JSONObject

/**
 * ForgeRock Bridge Module for React Native
 *
 * Handles WebAuthn callbacks from JavaScript.
 * - Receives step JSON from JS
 * - Calls ForgeRock SDK's native handlers
 * - SDK does ALL the work (FIDO2, biometric, credential creation)
 * - Returns next step to JS
 */
class ForgeRockBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ForgeRockBridge"
    }

    override fun getName(): String = "ForgeRockBridge"

    /**
     * Handle WebAuthn callback from JavaScript
     *
     * Flow:
     * 1. Parse step JSON
     * 2. Find WebAuthn callback
     * 3. Call native SDK handler
     * 4. SDK does: extract challenge → FIDO2 → biometric → credential
     * 5. Return next step
     */
    @ReactMethod
    fun handleWebAuthn(stepJson: String, promise: Promise) {
        CoroutineScope(Dispatchers.Main + Job()).launch {
            try {
                Log.d(TAG, "🎯 Handling WebAuthn callback")

                // Parse step from JS
                val node = parseNodeFromJson(stepJson)
                    ?: run {
                        promise.reject("PARSE_ERROR", "Failed to parse step JSON")
                        return@launch
                    }

                val context = reactContext.applicationContext
                val handled = handleWebAuthnCallbacks(node, context, promise)

                if (!handled) {
                    Log.w(TAG, "⚠️ No WebAuthn callback found in step")
                    promise.reject("NO_WEBAUTHN", "No WebAuthn callback in this step")
                }

            } catch (e: Exception) {
                Log.e(TAG, "❌ Error handling WebAuthn", e)
                promise.reject("WEBAUTHN_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Process WebAuthn callbacks in the node
     *
     * Returns true if WebAuthn callback was handled, false otherwise
     */
    private fun handleWebAuthnCallbacks(
        node: Node,
        context: Context,
        promise: Promise
    ): Boolean {
        for (cb in node.callbacks) {
            when (cb) {
                // Registration callback
                is WebAuthnRegistrationCallback -> {
                    Log.d(TAG, "📝 WebAuthn Registration detected")
                    handleRegistration(cb, node, context, promise)
                    return true
                }

                // Authentication callback
                is WebAuthnAuthenticationCallback -> {
                    Log.d(TAG, "🔓 WebAuthn Authentication detected")
                    handleAuthentication(cb, node, context, promise)
                    return true
                }
            }
        }
        return false
    }

    /**
     * Handle WebAuthn registration
     *
     * SDK automatically:
     * - Extracts challenge
     * - Calls FIDO2 API
     * - Shows biometric prompt
     * - Creates attestation
     * - Validates
     * - Continues journey
     */
    private fun handleRegistration(
        cb: WebAuthnRegistrationCallback,
        node: Node,
        context: Context,
        promise: Promise
    ) {
        try {
            Log.d(TAG, "🔐 Calling ForgeRock SDK's register()")

            // This ONE line does everything!
            cb.register(context, node)

            // Continue journey
            node.next(context, object : NodeListener<FRSession> {
                override fun onSuccess(result: FRSession) {
                    Log.d(TAG, "✅ Registration journey complete")
                    val resultJson = convertNodeToJson(node)
                    promise.resolve(resultJson)
                }

                override fun onException(e: Exception) {
                    Log.e(TAG, "❌ Registration journey error", e)
                    promise.reject("JOURNEY_ERROR", e.message ?: "Registration journey failed", e)
                }

                override fun onCallbackReceived(nextNode: Node) {
                    Log.d(TAG, "➡️ Registration returned next step")
                    val nextJson = convertNodeToJson(nextNode)
                    promise.resolve(nextJson)
                }
            })

        } catch (e: Exception) {
            Log.e(TAG, "❌ Registration failed", e)
            promise.reject("REGISTRATION_FAILED", e.message ?: "Registration failed", e)
        }
    }

    /**
     * Handle WebAuthn authentication
     *
     * SDK automatically:
     * - Extracts challenge
     * - Calls FIDO2 API
     * - Shows biometric prompt
     * - Creates assertion
     * - Validates
     * - Continues journey
     */
    private fun handleAuthentication(
        cb: WebAuthnAuthenticationCallback,
        node: Node,
        context: Context,
        promise: Promise
    ) {
        try {
            Log.d(TAG, "🔐 Calling ForgeRock SDK's authenticate()")

            // This ONE line does everything!
            cb.authenticate(context, node)

            // Continue journey
            node.next(context, object : NodeListener<FRSession> {
                override fun onSuccess(result: FRSession) {
                    Log.d(TAG, "✅ Authentication journey complete")
                    val resultJson = convertNodeToJson(node)
                    promise.resolve(resultJson)
                }

                override fun onException(e: Exception) {
                    Log.e(TAG, "❌ Authentication journey error", e)
                    promise.reject("JOURNEY_ERROR", e.message ?: "Authentication journey failed", e)
                }

                override fun onCallbackReceived(nextNode: Node) {
                    Log.d(TAG, "➡️ Authentication returned next step")
                    val nextJson = convertNodeToJson(nextNode)
                    promise.resolve(nextJson)
                }
            })

        } catch (e: Exception) {
            Log.e(TAG, "❌ Authentication failed", e)
            promise.reject("AUTHENTICATION_FAILED", e.message ?: "Authentication failed", e)
        }
    }

    /**
     * Convert Node to JSON string for transmission to JS
     */
    private fun convertNodeToJson(node: Node): String =
        try {
            Log.d(TAG, "Converting node to JSON")
            node.toJsonObject().toString()
        } catch (e: Exception) {
            Log.e(TAG, "Error converting node to JSON", e)
            JSONObject().apply {
                put("error", e.message ?: "Unknown error")
            }.toString()
        }

    /**
     * Parse Node from JSON string received from JS
     */
    private fun parseNodeFromJson(json: String): Node? =
        try {
            Log.d(TAG, "Parsing node from JSON")
            Node.fromJsonObject(JSONObject(json))
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing node from JSON", e)
            null
        }
}
