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

  @objc(loginWithBiometrics:resolver:rejecter:)
  func loginWithBiometrics(
    _ username: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      // FRAuth.start() must be called before FRUser.login().
      // Configuration is expected to be provided via your iOS app's plist/config.
      FRAuth.start()

      FRUser.login { user, node, error in
        if let error {
          reject("FR_AUTH", error.localizedDescription, error)
          return
        }

        if let user {
          resolve([
            "platform": "ios",
            "message": "Authenticated (FRUser session established).",
          ])
          return
        }

        guard let node else {
          reject("FR_NODE", "No node returned from SDK.", nil)
          return
        }

        self.handleNode(node, username: username, resolve: resolve, reject: reject)
      }
    }
  }

  private func handleNode(
    _ node: Node,
    username: String,
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
            node.next { user, nextNode, error in
              if let error {
                reject("FR_NEXT", error.localizedDescription, error)
                return
              }
              if let user {
                resolve([
                  "platform": "ios",
                  "message": "Authenticated (FRUser session established).",
                ])
                return
              }
              guard let nextNode else {
                reject("FR_NODE", "No next node returned from SDK.", nil)
                return
              }
              self.handleNode(nextNode, username: username, resolve: resolve, reject: reject)
            }
          },
          onError: { error in
            reject("FR_WEBAUTHN", error.localizedDescription, error)
          }
        )
        return
      }
    }

    node.next { user, nextNode, error in
      if let error {
        reject("FR_NEXT", error.localizedDescription, error)
        return
      }
      if let user {
        resolve([
          "platform": "ios",
          "message": "Authenticated (FRUser session established).",
        ])
        return
      }
      guard let nextNode else {
        reject("FR_NODE", "No next node returned from SDK.", nil)
        return
      }
      self.handleNode(nextNode, username: username, resolve: resolve, reject: reject)
    }
  }
}

