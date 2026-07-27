package co.arraigo.app.facetec

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

// Puente React Native ↔ FaceTec SDK (Android) — espejo de
// ios/Arraigo/Facetec/FacetecModule.swift. Misma API expuesta a JS:
// initialize(deviceKey, endpoint, authToken), enroll(config), authenticate(config)
// config = { refID, endpoint, authToken, checkinId? }
//
// TODO(FaceTec Android): este módulo compila y registra el bridge, pero el
// cuerpo de initialize/enroll/authenticate todavía no llama al SDK real —
// falta agregar la dependencia del SDK de FaceTec para Android (.aar / Maven)
// y portar la lógica de session-request-processor desde
// FacetecSessionProcessor.swift (ver ese archivo para la referencia completa
// del flujo: blob de sesión → facetec-proxy → responseBlob).
class FacetecModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "FacetecModule"

  private var initialized = false

  @ReactMethod
  fun initialize(deviceKey: String, endpoint: String, authToken: String, promise: Promise) {
    // TODO: FaceTecSDK.initializeInDevelopmentMode(reactApplicationContext, deviceKey, callback)
    // (o el inicializador equivalente para Managed Testing una vez confirmado en la doc del SDK)
    promise.reject(
      "facetec_not_implemented",
      "FaceTec Android SDK todavía no está integrado — falta portar FacetecModule.kt"
    )
  }

  @ReactMethod
  fun enroll(config: ReadableMap, promise: Promise) {
    startSession(config, "enroll", promise)
  }

  @ReactMethod
  fun authenticate(config: ReadableMap, promise: Promise) {
    startSession(config, "auth", promise)
  }

  private fun startSession(config: ReadableMap, kind: String, promise: Promise) {
    if (!initialized) {
      promise.reject("facetec_not_initialized", "FaceTec no inicializado")
      return
    }
    val refID = config.getString("refID")
    val endpoint = config.getString("endpoint")
    val authToken = config.getString("authToken")
    if (refID == null || endpoint == null || authToken == null) {
      promise.reject("facetec_bad_config", "refID, endpoint y authToken son requeridos")
      return
    }
    val checkinId = if (config.hasKey("checkinId")) config.getString("checkinId") else null

    // TODO: iniciar sesión FaceTec real (3D liveness para "enroll",
    // liveness + match 3D:3D para "auth") usando FacetecSessionProcessor.kt
    // (ver FacetecSessionProcessor.swift como referencia del flujo con el proxy).
    promise.reject("facetec_not_implemented", "Sesión '$kind' pendiente de portar desde iOS")
  }
}
