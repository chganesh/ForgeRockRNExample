import Foundation
import FRAuth

@objc(ForgeRockBridge)
class ForgeRockBridge: NSObject {

  @objc(handleWebAuthn:resolver:rejecter:)
  func handleWebAuthn(stepJson: String,
                      resolver: @escaping RCTPromiseResolveBlock,
                      rejecter: @escaping RCTPromiseRejectBlock) {

    do {
      guard let data = stepJson.data(using: .utf8) else {
        rejecter("INVALID_JSON", "Invalid JSON", nil)
        return
      }

      let node = try Node.fromJson(data)

      #if targetEnvironment(simulator)
      node.next { result in
        switch result {
        case .success(let nextNode):
          let json = try! nextNode.toJson()
          resolver(String(data: json, encoding: .utf8))
        case .failure(let error):
          rejecter("SIM_ERROR", error.localizedDescription, error)
        }
      }
      return
      #endif

      for callback in node.callbacks ?? [] {

        if let reg = callback as? WebAuthnRegistrationCallback {
          reg.register { result in
            switch result {
            case .success:
              node.next { res in
                switch res {
                case .success(let nextNode):
                  let json = try! nextNode.toJson()
                  resolver(String(data: json, encoding: .utf8))
                case .failure(let err):
                  rejecter("NEXT_ERROR", err.localizedDescription, err)
                }
              }
            case .failure(let err):
              rejecter("REG_ERROR", err.localizedDescription, err)
            }
          }
          return
        }

        if callback is WebAuthnAuthenticationCallback {
          node.next { result in
            switch result {
            case .success(let nextNode):
              let json = try! nextNode.toJson()
              resolver(String(data: json, encoding: .utf8))
            case .failure(let error):
              rejecter("AUTH_ERROR", error.localizedDescription, error)
            }
          }
          return
        }
      }

      rejecter("NO_CALLBACK", "No WebAuthn callback", nil)

    } catch {
      rejecter("ERROR", error.localizedDescription, error)
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return true

  }
}



#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ForgeRockBridge, NSObject)

RCT_EXTERN_METHOD(handleWebAuthn:(NSString *)stepJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end


const handleWebAuthnBridge = async (step) => {
  try {
    const stepJson = JSON.stringify(step);

    const response = await ForgeRockBridge.handleWebAuthn(stepJson);

    return JSON.parse(response);
  } catch (error) {
    console.log('❌ WebAuthn Bridge Error:', error);
    throw error;
  }
};

