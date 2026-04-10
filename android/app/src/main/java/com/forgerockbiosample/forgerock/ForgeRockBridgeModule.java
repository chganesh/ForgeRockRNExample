package com.forgerockbiosample.forgerock

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import org.forgerock.android.auth.Node
import org.forgerock.android.auth.NodeListener
import org.forgerock.android.auth.FRSession
import org.forgerock.android.auth.callback.WebAuthnAuthenticationCallback
import org.forgerock.android.auth.callback.WebAuthnRegistrationCallback
import org.json.JSONObject

/**
 * ForgeRock Bridge Module - Handle WebAuthn callbacks
 * 
 * Simple flow:
 * 1. JS detects WebAuthn callback and calls this bridge
 * 2. We find the WebAuthn callback in the step
 * 3. Call ForgeRock SDK's register() or authenticate() method
 * 4. SDK handles EVERYTHING:
 *    - Extract challenge
 *    - Call FIDO2 / AuthenticationServices
 *    - Show biometric prompt
 *    - Create credential (attestation/assertion)
 *    - Validate
 *    - Continue journey
 * 5. Return next step to JS
 */
class ForgeRockBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ForgeRockBridge"

    @ReactMethod
    fun handleWebAuthn(stepJson: String, promise: Promise) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                Log.d("FR", "🎯 WebAuthn callback received from JS")

                // Parse step
                val node = parseNode(stepJson) ?: run {
                    promise.reject("PARSE_ERROR", "Failed to parse step")
                    return@launch
                }

                // Find and handle WebAuthn callback
                for (cb in node.callbacks) {
                    when (cb) {
                        is WebAuthnRegistrationCallback -> {
                            Log.d("FR", "📝 Registration")
                            cb.register(reactContext, node)
                            continueJourney(node, promise)
                            return@launch
                        }
                        is WebAuthnAuthenticationCallback -> {
                            Log.d("FR", "🔓 Authentication")
                            cb.authenticate(reactContext, node)
                            continueJourney(node, promise)
                            return@launch
                        }
                    }
                }

                promise.reject("NO_WEBAUTHN", "No WebAuthn callback found")

            } catch (e: Exception) {
                Log.e("FR", "Error", e)
                promise.reject("ERROR", e.message ?: "Unknown error")
            }
        }
    }

    private fun continueJourney(node: Node, promise: Promise) {
        node.next(reactContext, object : NodeListener<FRSession> {
            override fun onSuccess(result: FRSession) {
                Log.d("FR", "✅ Journey complete")
                promise.resolve(nodeToJson(node))
            }

            override fun onException(e: Exception) {
                Log.e("FR", "Journey error", e)
                promise.reject("JOURNEY_ERROR", e.message)
            }

            override fun onCallbackReceived(nextNode: Node) {
                Log.d("FR", "➡️ Next step")
                promise.resolve(nodeToJson(nextNode))
            }
        })
    }

    private fun parseNode(json: String): Node? = try {
        Node.fromJsonObject(JSONObject(json))
    } catch (e: Exception) {
        null
    }

    private fun nodeToJson(node: Node): String = try {
        node.toJsonObject().toString()
    } catch (e: Exception) {
        "{\"error\": \"${e.message}\"}"
    }
}
