package com.cproeis.app.api

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    private var retrofit: Retrofit? = null
    private var currentBaseUrl: String = ""

    fun getServerUrl(context: Context): String {
        val prefs = context.getSharedPreferences("cproeis_prefs", Context.MODE_PRIVATE)
        var url = prefs.getString("server_url", "https://cprsautomacao.devsouza.online") ?: "https://cprsautomacao.devsouza.online"
        url = url.trim().trimEnd('/') + "/"
        return url
    }

    fun setServerUrl(context: Context, url: String) {
        val prefs = context.getSharedPreferences("cproeis_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("server_url", url.trim().trimEnd('/')).apply()
        retrofit = null // Reset retrofit instance
    }

    fun getService(context: Context): ApiService {
        val baseUrl = getServerUrl(context)
        if (retrofit == null || currentBaseUrl != baseUrl) {
            currentBaseUrl = baseUrl

            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val okHttpClient = OkHttpClient.Builder()
                .addInterceptor(AuthInterceptor(context))
                .addInterceptor(logging)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .build()

            retrofit = Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }
        return retrofit!!.create(ApiService::class.java)
    }
}
