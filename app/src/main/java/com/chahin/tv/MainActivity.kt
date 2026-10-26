package com.chahin.tv

import android.app.Activity
import android.app.UiModeManager
import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout

class MainActivity : Activity() {
    private lateinit var web: WebView
    private var customView: View? = null
    private var customCb: WebChromeClient.CustomViewCallback? = null

    @Suppress("DEPRECATION")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        web.setBackgroundColor(0xFF001020.toInt())

        val s = web.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = false
        s.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        s.allowFileAccess = true
        s.allowUniversalAccessFromFileURLs = true
        s.allowFileAccessFromFileURLs = true

        web.webViewClient = WebViewClient()
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                customView = view
                customCb = callback
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
                web.visibility = View.VISIBLE
            }
        }

        val ui = getSystemService(UI_MODE_SERVICE) as UiModeManager
        val tv = ui.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION
        web.loadUrl("file:///android_asset/index.html" + if (tv) "?tv=1" else "")
        web.requestFocus()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (customView != null) {
            web.webChromeClient?.onHideCustomView()
            return
        }
        val js = "(function(){var p=document.getElementById('pl');if(p&&p.classList.contains('open')){document.getElementById('cl').click();return 'c'}return 'x'})()"
        web.evaluateJavascript(js) { r ->
            if (r == null || r.contains("x")) {
                finish()
            }
        }
    }

    override fun onPause() {
        super.onPause()
        web.onPause()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }
}
