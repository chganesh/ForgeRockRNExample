#import <React/RCTBridgeModule.h>

// Swift implementation is exported via RCT_EXTERN_MODULE.
@interface RCT_EXTERN_MODULE(ForgerockBiometric, NSObject)

RCT_EXTERN_METHOD(loginWithBiometrics:(NSString *)username
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

