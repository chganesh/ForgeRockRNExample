import Foundation
import FRAuth
import UIKit

@objc(FRWebAuthnBiometricModule)
class FRWebAuthnBiometricModule: NSObject {

  // MARK: - Registration (WebAuthn Enroll)

  @objc
  func startRegistration(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {

    guard let node = getCurrentNode() else {
      reject("NO_NODE", "No active authentication node found", nil)
      return
    }

    guard let callback = node.callbacks.first(where: {
      $0 is WebAuthnRegistrationCallback
    }) as? WebAuthnRegistrationCallback else {

      reject("NO_CALLBACK", "WebAuthnRegistrationCallback not found", nil)
      return
    }

    DispatchQueue.main.async {

      callback.register(
        node: node,
        window: UIApplication.shared.windows.first,
        deviceName: UIDevice.current.name,
        usePasskeysIfAvailable: true
      ) { attestation in

        resolve([
          "status": "success",
          "flow": "registration"
        ])

      } onError: { error in

        reject("REG_FAILED", error.localizedDescription, error)
      }
    }
  }

  // MARK: - Authentication (WebAuthn Login)

  @objc
  func startAuthentication(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {

    guard let node = getCurrentNode() else {
      reject("NO_NODE", "No active authentication node found", nil)
      return
    }

    guard let callback = node.callbacks.first(where: {
      $0 is WebAuthnAuthenticationCallback
    }) as? WebAuthnAuthenticationCallback else {

      reject("NO_CALLBACK", "WebAuthnAuthenticationCallback not found", nil)
      return
    }

    DispatchQueue.main.async {

      callback.authenticate(
        node: node,
        window: UIApplication.shared.windows.first
      ) { assertion in

        resolve([
          "status": "success",
          "flow": "authentication"
        ])

      } onError: { error in

        reject("AUTH_FAILED", error.localizedDescription, error)
      }
    }
  }

  // MARK: - SAFE NODE ACCESS (NO JSON, NO TRANSFER FROM JS)

  private func getCurrentNode() -> Node? {

    // BEST PRACTICE:
    // ForgeRock SDK maintains session state internally.
    // We always rely on FRAuth shared session.

    return FRUser.currentUser()?.getCurrentNode()
  }
}

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FRWebAuthnBiometricModule, NSObject)

RCT_EXTERN_METHOD(startRegistration:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startAuthentication:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

export const handleRegistration = async (node) => {
  try {
    const hasCallback = node.callbacks?.some(
      cb => cb.type === 'WebAuthnRegistrationCallback'
    );

    if (!hasCallback) return node;

    await FRWebAuthnBiometricModule.startRegistration();

    return await node.next();

  } catch (e) {
    console.log('Registration error:', e);
    return await node.next();
  }
};
