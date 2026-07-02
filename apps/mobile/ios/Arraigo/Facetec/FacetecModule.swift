import Foundation
import UIKit
import FaceTecSDK

// Puente React Native ↔ FaceTec SDK (v10.1.5)
// Expone: initialize(deviceKey), enroll(refID), authenticate(refID)
//
// NOTA DE SEGURIDAD: en Managed Testing la app habla directo con api.facetec.com.
// En producción el veredicto de match debe determinarlo el middleware/FaceTec Server,
// no el cliente. Ver src/lib/facetec.ts y process-checkin.

@objc(FacetecModule)
class FacetecModule: NSObject, FaceTecInitializeCallback {

  private var sdkInstance: FaceTecSDKInstance?
  private var deviceKey: String = ""

  // Callbacks de init pendientes
  private var initResolve: RCTPromiseResolveBlock?
  private var initReject: RCTPromiseRejectBlock?

  // Managed Testing endpoint (reemplazar por tu middleware en producción)
  static let TESTING_API = "https://api.facetec.com/api/v4/biometrics/process-request"

  @objc static func requiresMainQueueSetup() -> Bool { return true }

  // MARK: - Initialize

  @objc(initialize:resolver:rejecter:)
  func initialize(_ deviceKey: String,
                  resolver resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    self.deviceKey = deviceKey
    self.initResolve = resolve
    self.initReject = reject
    DispatchQueue.main.async {
      FaceTec.sdk.initializeWithSessionRequest(
        deviceKeyIdentifier: deviceKey,
        sessionRequestProcessor: FacetecSessionProcessor(refID: "", endpoint: FacetecModule.TESTING_API, deviceKey: deviceKey, completion: { _ in }),
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
  func enroll(_ refID: String,
              resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sdk = sdkInstance else {
      reject("facetec_not_initialized", "FaceTec no inicializado", nil); return
    }
    DispatchQueue.main.async {
      let processor = FacetecSessionProcessor(refID: refID, endpoint: FacetecModule.TESTING_API, deviceKey: self.deviceKey, completion: { info in
        resolve(info)
      })
      let vc = sdk.start3DLiveness(with: processor)
      FacetecModule.presentedVC()?.present(vc, animated: true, completion: nil)
    }
  }

  // MARK: - Authenticate (imputado: liveness + match 3D:3D contra el enrolamiento)

  @objc(authenticate:resolver:rejecter:)
  func authenticate(_ refID: String,
                    resolver resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sdk = sdkInstance else {
      reject("facetec_not_initialized", "FaceTec no inicializado", nil); return
    }
    DispatchQueue.main.async {
      let processor = FacetecSessionProcessor(refID: refID, endpoint: FacetecModule.TESTING_API, deviceKey: self.deviceKey, completion: { info in
        resolve(info)
      })
      let vc = sdk.start3DLivenessThen3DFaceMatch(with: processor)
      FacetecModule.presentedVC()?.present(vc, animated: true, completion: nil)
    }
  }

  // MARK: - Helpers

  private static func presentedVC() -> UIViewController? {
    var root = UIApplication.shared.connectedScenes
      .compactMap { ($0 as? UIWindowScene)?.keyWindow }
      .first?.rootViewController
    while let presented = root?.presentedViewController { root = presented }
    return root
  }
}
