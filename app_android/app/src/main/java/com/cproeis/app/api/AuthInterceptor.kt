package com.cproeis.app.api

import android.content.Context
import android.content.SharedPreferences
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val context: Context) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val prefs = context.getSharedPreferences("cproeis_prefs", Context.MODE_PRIVATE)
        val token = prefs.getString("auth_token", null)

        val requestBuilder = chain.request().newBuilder()
        if (!token.isNullOrEmpty()) {
            requestBuilder.addHeader("Authorization", "Bearer $token")
        }
        requestBuilder.addHeader("Accept", "application/json")

        return chain.proceed(requestBuilder.build())
    }
}
