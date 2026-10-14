package com.wedoccms.myapplication.data.remote

import com.wedoccms.myapplication.data.local.AppPreferences
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    fun createApiService(prefs: AppPreferences): CcmsApiService {
        val authInterceptor = Interceptor { chain ->
            val originalRequest = chain.request()
            val requestBuilder = originalRequest.newBuilder()
                .header("x-dashboard-key", prefs.dashboardKey)
                .header("x-admin-key", prefs.adminKey)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")

            chain.proceed(requestBuilder.build())
        }

        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(8, TimeUnit.SECONDS)
            .writeTimeout(8, TimeUnit.SECONDS)
            .build()

        var formattedBaseUrl = prefs.baseUrl
        if (!formattedBaseUrl.startsWith("http://") && !formattedBaseUrl.startsWith("https://")) {
            formattedBaseUrl = "https://$formattedBaseUrl"
        }
        if (!formattedBaseUrl.endsWith("/")) {
            formattedBaseUrl = "$formattedBaseUrl/"
        }

        val retrofit = Retrofit.Builder()
            .baseUrl(formattedBaseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        return retrofit.create(CcmsApiService::class.java)
    }
}
