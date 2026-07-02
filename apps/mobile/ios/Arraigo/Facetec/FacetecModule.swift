import Foundation
import UIKit
import FaceTecSDK

// Puente React Native ↔ FaceTec SDK (v10.1.5)
// Expone: initialize(deviceKey, endpoint, authToken), enroll(config), authenticate(config)
// config = { refID, endpoint, authToken, checkinId? }
//
// Milestone 2: los blobs viajan vía facetec-proxy (Edge Function) — el veredicto
// se registra server-side; lo que este módulo devuelve a JS es solo informativo.

@objc(FacetecModule)
class FacetecModule: NSObject, FaceTecInitializeCallback {

  private var sdkInstance: FaceTecSDKInstance?

  // Config de la sesión de init pendiente
  private var initResolve: RCTPromiseResolveBlock?
  private var initReject: RCTPromiseRejectBlock?

  @objc static func requiresMainQueueSetup() -> Bool { return true }

  // MARK: - Initialize

  @objc(initialize:endpoint:authToken:resolver:rejecter:)
  func initialize(_ deviceKey: String, endpoint: String, authToken: String,
                  resolver resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    self.initResolve = resolve
    self.initReject = reject
    DispatchQueue.main.async {
      FaceTec.sdk.initializeWithSessionRequest(
        deviceKeyIdentifier: deviceKey,
        sessionRequestProcessor: FacetecSessionProcessor(refID: "", endpoint: endpoint, authToken: authToken, kind: "init", checkinId: nil, completion: { _ in }),
        completion: self
      )
    }
  }

  func onFaceTecSDKInitializeSuccess(sdkInstance: FaceTecSDKInstance) {
    self.sdkInstance = sdkInstance
    self.initResolve?(true)
    self.initResolve = nil; self.initReject = nil
  }

  func onFaceTecSDKInitializeError(error: FaceTecInitializationError) {
    let msg = FaceTec.sdk.description(for: error)
    self.initReject?("facetec_init_error", msg, nil)
    self.initResolve = nil; self.initReject = nil
  }

  // MARK: - Enroll (técnico: captura FaceMap de referencia)

  @objc(enroll:resolver:rejecter:)
  func enroll(_ config: NSDictionary,
              resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
    startSession(config: config, kind: "enroll", resolve: resolve, reject: reject) { sdk, processor in
      sdk.start3DLiveness(with: processor)
    }
  }

  // MARK: - Authenticate (imputado: liveness + match 3D:3D contra el enrolamiento)

  @objc(authenticate:resolver:rejecter:)
  func authenticate(_ config: NSDictionary,
                    resolver resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    startSession(config: config, kind: "auth", resolve: resolve, reject: reject) { sdk, processor in
      sdk.start3DLivenessThen3DFaceMatch(with: processor)
    }
  }

  // MARK: - Helpers

  private func startSession(config: NSDictionary, kind: String,
                            resolve: @escaping RCTPromiseResolveBlock,
                            reject: @escaping RCTPromiseRejectBlock,
                            makeVC: @escaping (FaceTecSDKInstance, FacetecSessionProcessor) -> UIViewController) {
    guard let sdk = sdkInstance else {
      reject("facetec_not_initialized", "FaceTec no inicializado", nil); return
    }
    guard let refID = config["refID"] as? String,
          let endpoint = config["endpoint"] as? String,
          let authToken = config["authToken"] as? String else {
      reject("facetec_bad_config", "refID, endpoint y authToken son requeridos", nil); return
    }
    let checkinId = config["checkinId"] as? String

    DispatchQueue.main.async {
      let processor = FacetecSessionProcessor(refID: refID, endpoint: endpoint, authToken: authToken, kind: kind, checkinId: checkinId, completion: { info in
        resolve(info)
      })
      let vc = makeVC(sdk, processor)
      FacetecModule.presentedVC()?.present(vc, animated: true, completion: nil)
    }
  }

  private static func presentedVC() -> UIViewController? {
    var root = UIApplication.shared.connectedScenes
      .compactMap { ($0 as? UIWindowScene)?.keyWindow }
      .first?.rootViewController
    while let presented = root?.presentedViewController { root = presented }
    return root
  }
}
