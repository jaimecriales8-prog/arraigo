#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FacetecModule, NSObject)

RCT_EXTERN_METHOD(initialize:(NSString *)deviceKey
                  endpoint:(NSString *)endpoint
                  authToken:(NSString *)authToken
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(enroll:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(authenticate:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup { return YES; }

@end
