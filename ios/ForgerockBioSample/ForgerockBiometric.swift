import Foundation
import FRAuth
import React
import UIKit

/**
 * Native bridge for WebAuthn biometric operations.
 * Uses ForgeRock SDK's built-in WebAuthn callback handlers.
 * 
 * The SDK automatically handles:
 * - Challenge extraction
 * - AuthenticationServices API calls
 * - Biometric/Passkey prompts
 * - Attestation/Assertion creation
 * - Journey continuation
 * 
 * NO manual payload extraction needed!
 */
@objc(ForgerockBiometric)
class ForgerockBiometric: NSObject {
  
  @objc static func requiresMainQueueSetup() -> Bool {
    true
  }

  /**
   * Register with WebAuthn biometric.
   * The SDK's WebAuthnRegistrationCallback handles the entire flow.
   */
  @objc(registerWithBiometrics:journeyName:resolver:rejecter:)
  func registerWithBiometrics(
    _ username: String,
    journeyName: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      self.runJourney(
        username: username,
        journeyName: journeyName,
        action: "register",
        resolve: resolve,
        reject: reject
      )
    }
  }

  /**
   * Authenticate with WebAuthn biometric.
   * The SDK's WebAuthnAuthenticationCallback handles the entire flow.
   */
  @objc(loginWithBiometrics:journeyName:resolver:rejecter:)
  func loginWithBiometrics(
    _ username: String,
    journeyName: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      self.runJourney(
        username: username,
        journeyName: journeyName,
        action: "login",
        resolve: resolve,
        reject: reject
      )
    }
  }

  /**
   * Start the authentication journey.
   * The SDK's callback handlers manage WebAuthn automatically.
   * 
   * When WebAuthnRegistrationCallback or WebAuthnAuthenticationCallback is encountered:
   * - SDK extracts challenge
   * - SDK calls AuthenticationServices API
   * - SDK shows biometric prompt (Face ID / Touch ID)
   * - SDK automatically continues journey
   * - JS receives final result (success/failure)
   */
  private func runJourney(
    username: String,
    journeyName: String,
    action: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    // FRAuth.start() must be called before authenticate
    FRAuth.start()

    FRSession.authenticate(authIndexValue: journeyName, authIndexType: "service") { token, node, error in
      if let error {
        reject("FR_AUTH", error.localizedDescription, error)
        return
      }

      if token != nil {
        resolve([
          "platform": "ios",
          "message": "Success (\(action)) - biometric authentication completed",
        ])
        return
      }

      guard let node else {
        reject("FR_NODE", "No node returned from SDK.", nil)
        return
      }

      self.handleNode(
        node,
        username: username,
        journeyName: journeyName,
        action: action,
        resolve: resolve,
        reject: reject
      )
    }
  }

  /**
   * Recursively handle nodes in the journey.
   * When WebAuthn callbacks are encountered, SDK handles them automatically.
   */
  private func handleNode(
    _ node: Node,
    username: String,
    journeyName: String,
    action: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    for cb in node.callbacks {
      // SDK handles NameCallback for username
      if let nameCb = cb as? NameCallback {
        nameCb.setValue(username)
      }

      // SDK's WebAuthnRegistrationCallback - let SDK handle EVERYTHING
      if let webAuthnCb = cb as? WebAuthnRegistrationCallback {
        let window = UIApplication.shared.windows.first
        
        // Simple call - SDK does ALL the work:
        // - Extracts challenge from callback
        // - Calls AuthenticationServices
        // - Shows Face ID / Touch ID prompt
        // - Receives attestation
        // - Validates and continues journey
        webAuthnCb.authenticate(
          node: node,
          window: window,
          preferImmediatelyAvailableCredentials: false,
          usePasskeysIfAvailable: true,  // Enable Passkeys on iOS 16+
          onSuccess: { _ in
            // SDK already continued the journey
            // Recursively handle next node
            node.next { token, nextNode, error in
              if let error {
                reject("FR_NEXT", error.localizedDescription, error)
                return
              }
              if token != nil {
                resolve([
                  "platform": "ios",
                  "message": "Success (\(action)) - biometric authentication completed",
                ])
                return
              }
              guard let nextNode else {
                reject("FR_NODE", "No next node returned from SDK.", nil)
                return
              }
              self.handleNode(
                nextNode,
                username: username,
                journeyName: journeyName,
                action: action,
                resolve: resolve,
                reject: reject
              )
            }
          },
          onError: { error in
            reject("FR_WEBAUTHN", error.localizedDescription, error)
          }
        )
        return
      }
    }

    // No WebAuthn callback - continue to next node
    node.next { token, nextNode, error in
      if let error {
        reject("FR_NEXT", error.localizedDescription, error)
        return
      }
      if token != nil {
        resolve([
          "platform": "ios",
          "message": "Success (\(action)) - biometric authentication completed",
        ])
        return
      }
      guard let nextNode else {
        reject("FR_NODE", "No next node returned from SDK.", nil)
        return
      }
      self.handleNode(
        nextNode,
        username: username,
        journeyName: journeyName,
        action: action,
        resolve: resolve,
        reject: reject
      )
    }
  }
}

