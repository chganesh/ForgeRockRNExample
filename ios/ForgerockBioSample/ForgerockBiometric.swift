import Foundation
import FRAuth
import React
import UIKit

@objc(ForgerockBiometric)
class ForgerockBiometric: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    // WebAuthn/biometric UI needs main thread.
    true
  }

  @objc(registerWithBiometrics:journeyName:resolver:rejecter:)
  func registerWithBiometrics(
    _ username: String,
    journeyName: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    runJourney(username: username, journeyName: journeyName, action: "register", resolve: resolve, reject: reject)
  }

  @objc(loginWithBiometrics:journeyName:resolver:rejecter:)
  func loginWithBiometrics(
    _ username: String,
    journeyName: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    runJourney(username: username, journeyName: journeyName, action: "login", resolve: resolve, reject: reject)
  }

  private func runJourney(
    username: String,
    journeyName: String,
    action: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      // FRAuth.start() must be called prior to authenticate.
      FRAuth.start()

      FRSession.authenticate(authIndexValue: journeyName, authIndexType: "service") { token, node, error in
        if let error {
          reject("FR_AUTH", error.localizedDescription, error)
          return
        }

        if token != nil {
          resolve([
            "platform": "ios",
            "message": "Success (\(action)) - session established for journey '\(journeyName)'.",
          ])
          return
        }

        guard let node else {
          reject("FR_NODE", "No node returned from SDK.", nil)
          return
        }

        self.handleNode(node, username: username, journeyName: journeyName, action: action, resolve: resolve, reject: reject)
      }
    }
  }

  private func handleNode(
    _ node: Node,
    username: String,
    journeyName: String,
    action: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    for cb in node.callbacks {
      if let nameCb = cb as? NameCallback {
        nameCb.setValue(username)
      }

      if let webAuthnCb = cb as? WebAuthnAuthenticationCallback {
        let window = UIApplication.shared.windows.first
        webAuthnCb.authenticate(
          node: node,
          window: window,
          preferImmediatelyAvailableCredentials: false,
          usePasskeysIfAvailable: false,
          onSuccess: { _ in
            node.next { token, nextNode, error in
              if let error {
                reject("FR_NEXT", error.localizedDescription, error)
                return
              }
              if token != nil {
                resolve([
                  "platform": "ios",
                  "message": "Success (\(action)) - session established for journey '\(journeyName)'.",
                ])
                return
              }
              guard let nextNode else {
                reject("FR_NODE", "No next node returned from SDK.", nil)
                return
              }
              self.handleNode(nextNode, username: username, journeyName: journeyName, action: action, resolve: resolve, reject: reject)
            }
          },
          onError: { error in
            reject("FR_WEBAUTHN", error.localizedDescription, error)
          }
        )
        return
      }
    }

    node.next { token, nextNode, error in
      if let error {
        reject("FR_NEXT", error.localizedDescription, error)
        return
      }
      if token != nil {
        resolve([
          "platform": "ios",
          "message": "Success (\(action)) - session established for journey '\(journeyName)'.",
        ])
        return
      }
      guard let nextNode else {
        reject("FR_NODE", "No next node returned from SDK.", nil)
        return
      }
      self.handleNode(nextNode, username: username, journeyName: journeyName, action: action, resolve: resolve, reject: reject)
    }
  }
}

