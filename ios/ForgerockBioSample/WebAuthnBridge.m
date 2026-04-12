// ios/YourApp/WebAuthnBridge.m

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WebAuthnBridge, NSObject)

// NEW: must be called first to pass node from JS to native
RCT_EXTERN_METHOD(
  setCurrentNode:(NSString *)nodeJSON
  resolve:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  registerBiometric:(NSDictionary *)options
  resolve:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  authenticateBiometric:(NSDictionary *)options
  resolve:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end


Step 3 — Xcode Capabilities
In Xcode → your Target → Signing & Capabilities:

Click + → add Associated Domains
Add: webcredentials:your-am-domain.example.com