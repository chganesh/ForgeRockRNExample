import Foundation
import FRAuth
import UIKit

@objc(WebAuthnBridge)
class WebAuthnBridge: NSObject {

  // Stores the live Node reconstructed from JS payload
  private var currentNode: Node?

  @objc static func requiresMainQueueSetup() -> Bool { return true }

  // ─────────────────────────────────────────────────────────────────────────
  // JS calls this passing the raw step payload when it detects
  // WebAuthnRegistrationCallback. We store the node reference.
  // ─────────────────────────────────────────────────────────────────────────
  @objc func setCurrentNode(
    _ nodeJSON: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock) {

    // Ensure SDK is started
    if FRAuth.shared == nil {
      do {
        try FRAuth.start()
      } catch {
        reject("SDK_INIT_ERROR", error.localizedDescription, error)
        return
      }
    }

    // Deserialize the node from the JSON string that JS passes
    guard let data = nodeJSON.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let authId = json["authId"] as? String else {
      reject("NODE_PARSE_ERROR", "Could not parse node JSON from JS SDK", nil)
      return
    }

    // Reconstruct a Node from the authId + raw JSON
    // FRAuth provides Node(authId:authServiceId:authServiceName:content:)
    // Use the same journey name configured in FRAuthConfig.plist
    let serviceName = FRAuth.shared?.authServiceName ?? "testwebauth"

    do {
      let node = try Node(
        authId,
        authServiceId: serviceName,
        authServiceName: serviceName,
        content: data
      )
      self.currentNode = node
      resolve(["success": true])
    } catch {
      reject("NODE_INIT_ERROR", "Failed to create Node: \(error.localizedDescription)", error)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BIOMETRIC REGISTRATION
  // ─────────────────────────────────────────────────────────────────────────
  @objc func registerBiometric(
    _ options: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock) {

    guard let node = self.currentNode else {
      reject("NO_NODE", "Call setCurrentNode first before registerBiometric", nil)
      return
    }

    guard let registrationCallback = node.callbacks
      .compactMap({ $0 as? WebAuthnRegistrationCallback })
      .first else {
      reject("CALLBACK_NOT_FOUND", "WebAuthnRegistrationCallback not found in node", nil)
      return
    }

    let deviceName = options["deviceName"] as? String ?? UIDevice.current.name

    DispatchQueue.main.async {
      registrationCallback.delegate = self

      // Pass node → SDK handles HiddenValueCallback + node.next() internally
      registrationCallback.register(
        node: node,
        window: self.keyWindow(),
        deviceName: deviceName,
        usePasskeysIfAvailable: false
      ) { _ in
        self.currentNode = nil
        resolve(["success": true, "type": "WebAuthnRegistrationSuccess"])
      } onError: { [weak self] error in
        self?.currentNode = nil
        // Resolve — not reject — so JS can call FRAuth.next() for AM fallback
        resolve([
          "success": false,
          "type": "WebAuthnRegistrationError",
          "errorCode": self?.mapError(error) ?? "UNKNOWN",
          "message": error.localizedDescription
        ])
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BIOMETRIC AUTHENTICATION
  // ─────────────────────────────────────────────────────────────────────────
  @objc func authenticateBiometric(
    _ options: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock) {

    guard let node = self.currentNode else {
      reject("NO_NODE", "Call setCurrentNode first before authenticateBiometric", nil)
      return
    }

    guard let authCallback = node.callbacks
      .compactMap({ $0 as? WebAuthnAuthenticationCallback })
      .first else {
      reject("CALLBACK_NOT_FOUND", "WebAuthnAuthenticationCallback not found in node", nil)
      return
    }

    DispatchQueue.main.async {
      authCallback.delegate = self

      authCallback.authenticate(
        node: node,
        window: self.keyWindow(),
        preferImmediatelyAvailableCredentials: false,
        usePasskeysIfAvailable: false
      ) { _ in
        self.currentNode = nil
        resolve(["success": true, "type": "WebAuthnAuthSuccess"])
      } onError: { [weak self] error in
        self?.currentNode = nil
        resolve([
          "success": false,
          "type": "WebAuthnAuthError",
          "errorCode": self?.mapError(error) ?? "UNKNOWN",
          "message": error.localizedDescription
        ])
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Replaces deprecated UIApplication.shared.windows.first
  // Correct for iOS 13+ (which includes all versions FRAuth 4.8.5 supports)
  // ─────────────────────────────────────────────────────────────────────────
  private func keyWindow() -> UIWindow? {
    return UIApplication.shared
      .connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }

  private func mapError(_ error: Error) -> String {
    guard let webAuthnError = error as? WebAuthnError else {
      return "UNKNOWN_ERROR"
    }
    switch webAuthnError {
    case .cancelled:    return "BIOMETRIC_CANCELLED"
    case .unsupported:  return "BIOMETRIC_UNSUPPORTED"
    case .notAllowed:   return "BIOMETRIC_NOT_ALLOWED"
    case .invalidState: return "BIOMETRIC_INVALID_STATE"
    case .constraint:   return "BIOMETRIC_CONSTRAINT"
    case .timeout:      return "BIOMETRIC_TIMEOUT"
    case .badData:      return "BIOMETRIC_BAD_DATA"
    default:            return "BIOMETRIC_CLIENT_ERROR"
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
extension WebAuthnBridge: PlatformAuthenticatorRegistrationDelegate {

  func excludeCredentialDescriptorConsent(
    consentCallback: @escaping WebAuthnUserConsentCallback) {
    DispatchQueue.main.async {
      let alert = UIAlertController(
        title: "Replace credentials?",
        message: "This device already has registered credentials. Create new ones?",
        preferredStyle: .alert)
      alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
        consentCallback(.reject)
      })
      alert.addAction(UIAlertAction(title: "Allow", style: .default) { _ in
        consentCallback(.allow)
      })
      self.keyWindow()?.rootViewController?.present(alert, animated: true)
    }
  }

  func createNewCredentialConsent(
    keyName: String, rpName: String, rpId: String?,
    userName: String, userDisplayName: String,
    consentCallback: @escaping WebAuthnUserConsentCallback) {
    DispatchQueue.main.async {
      let alert = UIAlertController(
        title: "Register Biometric",
        message: "Register biometric for \(userDisplayName) on \(rpName)?",
        preferredStyle: .alert)
      alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
        consentCallback(.reject)
      })
      alert.addAction(UIAlertAction(title: "Allow", style: .default) { _ in
        consentCallback(.allow)
      })
      self.keyWindow()?.rootViewController?.present(alert, animated: true)
    }
  }
}

extension WebAuthnBridge: PlatformAuthenticatorAuthenticationDelegate {

  func localKeyExistsAndPasskeysAreAvailable() {}

  func selectCredential(
    keyNames: [String],
    selectionCallback: @escaping WebAuthnCredentialsSelectionCallback) {
    DispatchQueue.main.async {
      let sheet = UIAlertController(
        title: "Select credential",
        message: nil,
        preferredStyle: .actionSheet)
      for keyName in keyNames {
        sheet.addAction(UIAlertAction(title: keyName, style: .default) { _ in
          selectionCallback(keyName)
        })
      }
      sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
        selectionCallback(nil)
      })
      self.keyWindow()?.rootViewController?.present(sheet, animated: true)
    }
  }
}