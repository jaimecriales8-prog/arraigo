import Foundation
import UIKit
import FaceTecSDK

// Procesador de sesión FaceTec. Sigue la estructura obligatoria del SDK:
// recibe el sessionRequestBlob → lo manda al servidor → devuelve el responseBlob.
//
// Milestone 2 (proxy): los blobs van a NUESTRO Edge Function (facetec-proxy),
// que los reenvía a FaceTec y registra el veredicto server-side.
// El teléfono nunca decide el resultado — solo transporta blobs encriptados.
class FacetecSessionProcessor: NSObject, FaceTecSessionRequestProcessor, URLSessionTaskDelegate {

  private let refID: String
  private let endpoint: String
  private let authToken: String
  private let kind: String          // "enroll" | "auth"
  private let checkinId: String?
  private let completion: ([String: Any]) -> Void
  private var latestServerResult: [String: Any]? = nil
  private var errorCount = 0
  private static let MAX_RETRIES = 4

  init(refID: String, endpoint: String, authToken: String, kind: String, checkinId: String?,
       completion: @escaping ([String: Any]) -> Void) {
    self.refID = refID
    self.endpoint = endpoint
    self.authToken = authToken
    self.kind = kind
    self.checkinId = checkinId
    self.completion = completion
    super.init()
  }

  // Llamado por el SDK cuando necesita procesar una sesión
  func onSessionRequest(sessionRequestBlob: String, sessionRequestCallback: FaceTecSessionRequestProcessorCallback) {
    var payload: [String: Any] = [
      "requestBlob": sessionRequestBlob,
      "kind": kind,
      // El proxy exige que el refID sea el usuario del JWT — anti-suplantación
      "externalDatabaseRefID": refID,
      // Header que la Testing API exige; lo genera el SDK en el dispositivo
      "testingApiHeader": FaceTec.sdk.getTestingAPIHeader(),
    ]
    if let checkinId = checkinId { payload["checkinId"] = checkinId }

    var request = URLRequest(url: URL(string: endpoint)!)
    request.httpMethod = "POST"
    request.addValue("application/json", forHTTPHeaderField: "Content-Type")
    request.addValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
    request.httpBody = try! JSONSerialization.data(withJSONObject: payload, options: [])

    let config = URLSessionConfiguration.default
    config.timeoutIntervalForResource = 120
    let session = URLSession(configuration: config, delegate: self, delegateQueue: OperationQueue.main)

    sendWithRetry(session: session, request: request) { data, _, _ in
      let responseBlob = self.responseBlobOrAbort(data: data, callback: sessionRequestCallback)
      if !responseBlob.isEmpty {
        sessionRequestCallback.processResponse(responseBlob)
      }
    }
  }

  private func sendWithRetry(session: URLSession, request: URLRequest, handler: @escaping (Data?, URLResponse?, Error?) -> Void) {
    let task = session.dataTask(with: request) { data, response, error in
      if error != nil && self.errorCount < FacetecSessionProcessor.MAX_RETRIES {
        self.errorCount += 1
        let delay: Double = [0, 0, 2, 5, 10][min(self.errorCount, 4)]
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
          self.sendWithRetry(session: session, request: request, handler: handler)
        }
      } else {
        handler(data, response, error)
      }
    }
    task.resume()
  }

  private func responseBlobOrAbort(data: Data?, callback: FaceTecSessionRequestProcessorCallback) -> String {
    guard let data = data,
          let json = try? JSONSerialization.jsonObject(with: data, options: .allowFragments) as? [String: Any] else {
      callback.abortOnCatastrophicError()
      return ""
    }
    self.latestServerResult = json
    guard let blob = json["responseBlob"] as? String else {
      callback.abortOnCatastrophicError()
      return ""
    }
    return blob
  }

  // Llamado cuando el SDK termina o se cancela
  func onFaceTecExit(sessionResult: FaceTecSessionResult) {
    let status = sessionResult.sessionStatus
    let success = status == .sessionCompleted

    var info: [String: Any] = [
      "success": success,
      "sessionStatus": String(describing: status),
    ]
    if let server = latestServerResult {
      info["wasProcessed"] = server["wasProcessed"] ?? NSNull()
      if let result = server["result"] { info["result"] = result }
    }
    DispatchQueue.main.async { self.completion(info) }
  }
}
