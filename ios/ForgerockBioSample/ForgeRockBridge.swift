/**
 * ForgeRock Native Bridge for iOS
 * 
 * Handles WebAuthn callbacks from JavaScript by delegating to ForgeRock's native SDK.
 * 
 * Responsibilities:
 * - Receive WebAuthn callback steps from JS
 * - Call native SDK's WebAuthn handlers
 * - Return next step to JS
 * 
 * The ForgeRock SDK's handlers automatically:
 * - Extract challenge from callback
 * - Call AuthenticationServices API (Face ID / Touch ID / Passkeys)
 * - Show biometric prompt
 * - Create attestation/assertion
 * - Continue journey
 */
import Foundation
import FRAuth
import React

@objc(ForgeRockBridge)
class ForgeRockBridge: NSObject {
  
  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }

  /**
   * Handle WebAuthn callback from JavaScript
   * 
   * The JavaScript layer detects WebAuthn callbacks and passes the step to this method.
   * This method:
   * 1. Parses the step JSON
   * 2. Finds the WebAuthn callback
   * 3. Calls the native SDK's callback handler (register or authenticate)
   * 4. Returns the next step
   */
  @objc(handleWebAuthn:resolver:rejecter:)
  func handleWebAuthn(
    _ stepJson: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async { [weak self] in
      do {
        print("🎯 [iOS] Handling WebAuthn callback")

        // Parse the step from JS
        guard let stepData = stepJson.data(using: .utf8),
              let stepDict = try JSONSerialization.jsonObject(with: stepData) as? [String: Any] else {
          reject("PARSE_ERROR", "Failed to parse step JSON", nil)
          return
        }

        // Convert to Node (ForgeRock SDK object)
        guard let node = try Node.init(json: stepDict as [String : AnyObject]) else {
          reject("NODE_ERROR", "Failed to create Node from JSON", nil)
          return
        }

        // Handle WebAuthn callbacks
        let handled = self?.handleWebAuthnCallbacks(node: node, resolve: resolve, reject: reject) ?? false

        if !handled {
          print("⚠️ No WebAuthn callback found in step")
          reject("NO_WEBAUTHN", "No WebAuthn callback in this step", nil)
        }

      } catch {
        print("❌ Error handling WebAuthn:", error)
        reject("WEBAUTHN_ERROR", error.localizedDescription, error)
      }
    }
  }

  /**
   * Handle WebAuthn callbacks in the node
   * 
   * Returns true if WebAuthn callback was found and handled
   */
  private func handleWebAuthnCallbacks(
    node: Node,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) -> Bool {
    let window = UIApplication.shared.windows.first

    for callback in node.callbacks {
      // Registration - SDK handles everything
      if let webAuthnCb = callback as? WebAuthnRegistrationCallback {
        print("📝 [iOS] WebAuthn Registration detected")
        
        // Simple call - SDK does ALL the work:
        // - Extract challenge from callback
        // - Call AuthenticationServices API
        // - Show Face ID / Touch ID / Passkey prompt
        // - Create attestation
        // - Validate and continue journey
        webAuthnCb.authenticate(
          node: node,
          window: window,
          preferImmediatelyAvailableCredentials: false,
          usePasskeysIfAvailable: true,
          onSuccess: { _ in
            print("✅ WebAuthn registration success")
            // Continue journey
            node.next { token, nextNode, error in
              if let error = error {
                reject("NEXT_ERROR", error.localizedDescription, error)
                return
              }

              // Convert next node to JSON and return to JS
              self.convertNodeToJSON(nextNode) { result in
                resolve(result)
              }
            }
          },
          onError: { error in
            print("❌ WebAuthn registration failed:", error)
            reject("REGISTRATION_FAILED", error.localizedDescription, error)
          }
        )
        return true
      }

      // Authentication - SDK handles everything
      if let webAuthnCb = callback as? WebAuthnAuthenticationCallback {
        print("🔓 [iOS] WebAuthn Authentication detected")
        
        // Simple call - SDK does ALL the work:
        // - Extract challenge from callback
        // - Call AuthenticationServices API
        // - Show Face ID / Touch ID / Passkey prompt
        // - Create assertion
        // - Validate and continue journey
        webAuthnCb.authenticate(
          node: node,
          window: window,
          preferImmediatelyAvailableCredentials: false,
          usePasskeysIfAvailable: true,
          onSuccess: { _ in
            print("✅ WebAuthn authentication success")
            // Continue journey
            node.next { token, nextNode, error in
              if let error = error {
                reject("NEXT_ERROR", error.localizedDescription, error)
                return
              }

              // Convert next node to JSON and return to JS
              self.convertNodeToJSON(nextNode) { result in
                resolve(result)
              }
            }
          },
          onError: { error in
            print("❌ WebAuthn authentication failed:", error)
            reject("AUTHENTICATION_FAILED", error.localizedDescription, error)
          }
        )
        return true
      }
    }

    return false
  }

  /**
   * Convert Node to JSON for transmission to JavaScript
   */
  private func convertNodeToJSON(
    _ node: Node?,
    completion: @escaping (String) -> Void
  ) {
    do {
      if let node = node {
        let json = try node.toJSON()
        let jsonString = String(data: json, encoding: .utf8) ?? "{}"
        completion(jsonString)
      } else {
        completion("{}")
      }
    } catch {
      print("Error converting node to JSON:", error)
      completion("{\"error\": \"\(error.localizedDescription)\"}")
    }
  }
}
