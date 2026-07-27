package co.arraigo.app.facetec

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facetec.sdk.FaceTecSDK
import com.facetec.sdk.FaceTecSessionRequestProcessor
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

// Procesador de sesión FaceTec — espejo de
// ios/Arraigo/Facetec/FacetecSessionProcessor.swift. Sigue la estructura
// obligatoria del SDK: recibe el sessionRequestBlob → lo manda a
// facetec-proxy (Edge Function, sin cambios entre plataformas) →
// devuelve el responseBlob.
//
// Milestone 2 (proxy): el teléfono nunca decide el resultado — solo
// transporta blobs encriptados; el veredicto se registra server-side.
class FacetecSessionProcessor(
  private val refID: String,
  private val endpoint: String,
  private val authToken: String,
  private val kind: String, // "init" | "enroll" | "auth"
  private val checkinId: String?,
  private val onExit: (Map<String, Any?>) -> Unit,
) : FaceTecSessionRequestProcessor {

  var latestServerResult: JSONObject? = null
    private set

  private var errorCount = 0

  companion object {
    private const val MAX_RETRIES = 4
    private val DELAYS_MS = longArrayOf(0, 0, 2000, 5000, 10000)
    private val client = OkHttpClient.Builder()
      .callTimeout(120, TimeUnit.SECONDS)
      .build()
  }

  override fun onSessionRequest(
    sessionRequestBlob: String,
    sessionRequestCallback: FaceTecSessionRequestProcessor.Callback,
  ) {
    val payload = JSONObject().apply {
      put("requestBlob", sessionRequestBlob)
      put("kind", kind)
      // El proxy exige que el refID sea el usuario del JWT — anti-suplantación
      put("externalDatabaseRefID", refID)
      // Header que la Testing API exige; lo genera el SDK en el dispositivo
      put("testingApiHeader", FaceTecSDK.getTestingAPIHeader())
      if (checkinId != null) put("checkinId", checkinId)
    }

    val body = payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
    val request = Request.Builder()
      .url(endpoint)
      .header("Content-Type", "application/json")
      .header("Authorization", "Bearer $authToken")
      .post(body)
      .build()

    sendWithRetry(request, sessionRequestCallback)
  }

  private fun sendWithRetry(request: Request, callback: FaceTecSessionRequestProcessor.Callback) {
    client.newCall(request).enqueue(object : Callback {
      override fun onFailure(call: Call, e: IOException) {
        if (errorCount < MAX_RETRIES) {
          errorCount += 1
          Handler(Looper.getMainLooper()).postDelayed(
            { sendWithRetry(request, callback) },
            DELAYS_MS[errorCount.coerceAtMost(4)]
          )
        } else {
          callback.abortOnCatastrophicError()
        }
      }

      override fun onResponse(call: Call, response: okhttp3.Response) {
        response.use { resp ->
          val bodyStr = resp.body?.string()
          if (!resp.isSuccessful || bodyStr == null) {
            Log.d("FacetecModule", "Respuesta no exitosa del proxy: ${resp.code}")
            callback.abortOnCatastrophicError()
            return
          }
          try {
            val json = JSONObject(bodyStr)
            latestServerResult = json
            val responseBlob = json.getString("responseBlob")
            callback.processResponse(responseBlob)
          } catch (e: Exception) {
            Log.d("FacetecModule", "Error parseando respuesta del proxy: ${e.message}")
            callback.abortOnCatastrophicError()
          }
        }
      }
    })
  }

  // Llamado cuando el SDK termina o se cancela — construye la info que se resuelve a JS.
  fun buildExitInfo(success: Boolean, sessionStatus: String): Map<String, Any?> {
    val info = mutableMapOf<String, Any?>(
      "success" to success,
      "sessionStatus" to sessionStatus,
    )
    latestServerResult?.let { server ->
      if (server.has("wasProcessed")) info["wasProcessed"] = server.opt("wasProcessed")
      if (server.has("result")) info["result"] = server.opt("result").toString()
    }
    return info
  }
}
