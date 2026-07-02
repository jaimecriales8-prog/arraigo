import Foundation
import UIKit
import FaceTecSDK

// Procesador de sesión FaceTec. Sigue la estructura obligatoria del SDK:
// recibe el sessionRequestBlob → lo manda al servidor → devuelve el responseBlob.
// En Managed Testing el "servidor" es api.facetec.com con las cabeceras de testing.
class FacetecSessionProcessor: NSObject, FaceTecSessionRequestProcessor, URLSessionTaskDelegate {

  private let refID: String
  private let endpoint: String
  private let deviceKey: String
  private let completion: ([String: Any]) -> Void
  private var latestServerResult: [String: Any]? = nil
  private var errorCount = 0
  private static let MAX_RETRIES = 4

  init(refID: String, endpoint: String, deviceKey: String, completion: @escaping ([String: Any]) -> Void) {
    self.refID = refID
    self.endpoint = endpoint
    self.deviceKey = deviceKey
    self.completion = completion
    super.init()
  }

  // Llamado por el SDK cuando necesita procesar una sesión
  func onSessionRequest(sessionRequestBlob: String, sessionRequestCallback: FaceTecSessionRequestProcessorCallback) {
    var payload: [String: Any] = ["requestBlob": sessionRequestBlob]
    if !refID.isEmpty { payload["externalDatabaseRefID"] = refID }

    var request = URLRequest(url: URL(string: endpoint)!)
    request.httpMethod = "POST"
    request.addValue("application/json", forHTTPHeaderField: "Content-Type")
    // Cabeceras SOLO para Managed Testing — remover al usar tu middleware + FaceTec Server
    request.addValue(deviceKey, forHTTPHeaderField: "X-Device-Key")
    request.addValue(FaceTec.sdk.getTestingAPIHeader(), forHTTPHeaderField: "X-Testing-API-Header")
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
    // Guardar el resultado del servidor para exponerlo a JS (descubrir el contrato en las 1ras pruebas)
    self.latestServerResult = json
    guard let blob = json["responseBlob"] as? String else {
      callback.abortOnCatastrophicError()
      return ""
    }
    return blob
  }

  // Progreso de subida → barra de progreso del SDK
  func urlSession(_ session: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64, totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
    // El callback de progreso se maneja internamente por el SDK vía processResponse; omitido aquí.
  }

  // Llamado cuando el SDK termina o se cancela
  func onFaceTecExit(sessionResult: FaceTecSessionResult) {
    let status = sessionResult.sessionStatus
    let success = status == .sessionCompleted

    var info: [String: Any] = [
      "success": success,
      "sessionStatus": String(describing: status),
    ]
    // Campos del servidor (Managed Testing) — útiles para leer el veredicto de match/liveness
    if let server = latestServerResult {
      info["wasProcessed"] = server["wasProcessed"] ?? NSNull()
      if let result = server["result"] { info["result"] = result }
      if let scanResultBlob = server["scanResultBlob"] { info["hasScanResultBlob"] = !(scanResultBlob is NSNull) }
    }
    DispatchQueue.main.async { self.completion(info) }
  }
}
