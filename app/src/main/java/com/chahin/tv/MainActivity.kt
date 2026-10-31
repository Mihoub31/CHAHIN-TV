package com.chahin.tv

import android.Manifest
import android.app.Activity
import android.app.UiModeManager
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : Activity() {
    private lateinit var web: WebView
    private var customView: View? = null
    private var customCb: WebChromeClient.CustomViewCallback? = null
    private var pendingGeo: Pair<String, GeolocationPermissions.Callback>? = null

    @Suppress("DEPRECATION")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        web.setBackgroundColor(0xFF040B12.toInt())

        val s = web.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = false
        s.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        s.allowFileAccess = true
        s.allowUniversalAccessFromFileURLs = true
        s.allowFileAccessFromFileURLs = true
        s.setGeolocationEnabled(true)

        web.addJavascriptInterface(Bridge(), "ChahinNative")

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "file") return false
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (e: Exception) {
                    true
                }
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                customView = view
                customCb = callback
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                (window.decorView as FrameLayout).addView(
                    view,
                    FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                )
                web.visibility = View.GONE
            }

            override fun onHideCustomView() {
                customView?.let { (window.decorView as FrameLayout).removeView(it) }
                customView = null
                customCb?.onCustomViewHidden()
                customCb = null
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                web.visibility = View.VISIBLE
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false)
                    return
                }
                pendingGeo = origin to callback
                requestPermissions(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    ),
                    GEO_REQUEST
                )
            }
        }

        val ui = getSystemService(UI_MODE_SERVICE) as UiModeManager
        val tv = ui.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION
        web.loadUrl("file:///android_asset/index.html" + if (tv) "?tv=1" else "")
        web.requestFocus()
    }

    private fun hasLocationPermission(): Boolean =
        checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != GEO_REQUEST) return
        val granted = grantResults.isNotEmpty() && grantResults.any { it == PackageManager.PERMISSION_GRANTED }
        pendingGeo?.let { (origin, callback) -> callback.invoke(origin, granted, false) }
        pendingGeo = null
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        web.evaluateJavascript(
            "window.chahinSystemTheme&&window.chahinSystemTheme();window.chahinSystemLang&&window.chahinSystemLang()",
            null
        )
    }

    private inner class Bridge {
        @JavascriptInterface
        fun systemDark(): String {
            val night = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
            return if (night == Configuration.UI_MODE_NIGHT_YES) "1" else "0"
        }

        @JavascriptInterface
        fun systemLang(): String {
            val conf = resources.configuration
            val locale = if (Build.VERSION.SDK_INT >= 24) conf.locales.get(0) else conf.locale
            return locale.language
        }

        @JavascriptInterface
        fun fetchText(url: String): String {
            val parsed = try {
                URL(url)
            } catch (e: Exception) {
                return "ERR:URL invalide"
            }
            if (parsed.protocol != "http" && parsed.protocol != "https") {
                return "ERR:protocole non supporté"
            }
            return try {
                val connection = parsed.openConnection() as HttpURLConnection
                try {
                    connection.connectTimeout = 15000
                    connection.readTimeout = 30000
                    connection.instanceFollowRedirects = true
                    connection.setRequestProperty("User-Agent", "CHAHIN-TV/2.4")
                    connection.setRequestProperty("Accept", "*/*")
                    val code = connection.responseCode
                    if (code !in 200..299) {
                        "ERR:HTTP $code"
                    } else {
                        connection.inputStream.bufferedReader().use { it.readText() }
                    }
                } finally {
                    connection.disconnect()
                }
            } catch (e: Exception) {
                "ERR:" + (e.message ?: "réseau")
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (customView != null) {
            web.webChromeClient?.onHideCustomView()
            return
        }
        val js = "(function(){try{return (window.chahinBack&&window.chahinBack())?'1':'0'}catch(e){return '0'}})()"
        web.evaluateJavascript(js) { result ->
            if (result != "1" && result != "\"1\"") finish()
        }
    }

    override fun onPause() {
        web.evaluateJavascript("window.chahinPause&&window.chahinPause()", null)
        super.onPause()
        web.onPause()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    companion object {
        private const val GEO_REQUEST = 41
    }
}
