package co.arraigo.app.facetec

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facetec.sdk.FaceTecInitializationError
import com.facetec.sdk.FaceTecSDK
import com.facetec.sdk.FaceTecSDKInstance
import com.facetec.sdk.FaceTecSessionStatus

// Puente React Native ↔ FaceTec SDK (Android) — espejo de
// ios/Arraigo/Facetec/FacetecModule.swift. Expone a JS los mismos 3
// métodos: initialize(deviceKey, endpoint, authToken), enroll(config),
// authenticate(config). config = { refID, endpoint, authToken, checkinId? }
//
// Diferencia clave con iOS: FaceTec en Android lanza su propia Activity
// (startActivityForResult) — el resultado llega acá vía ActivityEventListener
// en onActivityResult, no vía un delegate directo.
class FacetecModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var sdkInstance: FaceTecSDKInstance? = null
  private var pendingPromise: Promise? = null
  private var pendingProcessor: FacetecSessionProcessor? = null

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName() = "FacetecModule"

  private val activityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: android.app.Activity?, requestCode: Int, resultCode: Int, data: android.content.Intent?) {
      val sessionResult = FaceTecSDK.getActivitySessionResult(requestCode, resultCode, data) ?: return
      val promise = pendingPromise ?: return
      val processor = pendingProcessor
      pendingPromise = null
      pendingProcessor = null

      val success = sessionResult.status == FaceTecSessionStatus.SESSION_COMPLETED
      val info = processor?.buildExitInfo(success, sessionResult.status.toString())
        ?: mapOf("success" to success, "sessionStatus" to sessionResult.status.toString())
      promise.resolve(mapToWritable(info))
    }
  }

  @ReactMethod
  fun initialize(deviceKey: String, endpoint: String, authToken: String, promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.reject("facetec_no_activity", "No hay actividad en primer plano")
      return
    }
    activity.runOnUiThread {
      val processor = FacetecSessionProcessor(
        refID = "", endpoint = endpoint, authToken = authToken, kind = "init", checkinId = null,
        onExit = {}
      )
      FaceTecSDK.initializeWithSessionRequest(
        activity,
        deviceKey,
        processor,
        object : FaceTecSDK.InitializeCallback {
          override fun onSuccess(instance: FaceTecSDKInstance) {
            sdkInstance = instance
            promise.resolve(true)
          }

          override fun onError(error: FaceTecInitializationError) {
            promise.reject("facetec_init_error", error.toString())
          }
        }
      )
    }
  }

  @ReactMethod
  fun enroll(config: ReadableMap, promise: Promise) {
    startSession(config, "enroll", promise) { sdk, activity, processor ->
      sdk.start3DLiveness(activity, processor)
    }
  }

  @ReactMethod
  fun authenticate(config: ReadableMap, promise: Promise) {
    startSession(config, "auth", promise) { sdk, activity, processor ->
      sdk.start3DLivenessThen3DFaceMatch(activity, processor)
    }
  }

  private fun startSession(
    config: ReadableMap,
    kind: String,
    promise: Promise,
    launch: (FaceTecSDKInstance, android.app.Activity, FacetecSessionProcessor) -> Unit,
  ) {
    val sdk = sdkInstance
    if (sdk == null) {
      promise.reject("facetec_not_initialized", "FaceTec no inicializado")
      return
    }
    val activity = currentActivity
    if (activity == null) {
      promise.reject("facetec_no_activity", "No hay actividad en primer plano")
      return
    }
    val refID = if (config.hasKey("refID")) config.getString("refID") else null
    val endpoint = if (config.hasKey("endpoint")) config.getString("endpoint") else null
    val authToken = if (config.hasKey("authToken")) config.getString("authToken") else null
    if (refID == null || endpoint == null || authToken == null) {
      promise.reject("facetec_bad_config", "refID, endpoint y authToken son requeridos")
      return
    }
    val checkinId = if (config.hasKey("checkinId")) config.getString("checkinId") else null

    val processor = FacetecSessionProcessor(refID, endpoint, authToken, kind, checkinId, onExit = {})
    pendingPromise = promise
    pendingProcessor = processor

    activity.runOnUiThread {
      launch(sdk, activity, processor)
    }
  }

  private fun mapToWritable(map: Map<String, Any?>): WritableMap {
    val writable = Arguments.createMap()
    for ((key, value) in map) {
      when (value) {
        null -> writable.putNull(key)
        is Boolean -> writable.putBoolean(key, value)
        is Int -> writable.putInt(key, value)
        is Double -> writable.putDouble(key, value)
        is String -> writable.putString(key, value)
        else -> writable.putString(key, value.toString())
      }
    }
    return writable
  }
}
