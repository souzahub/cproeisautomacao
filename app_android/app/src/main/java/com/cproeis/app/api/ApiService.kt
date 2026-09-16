package com.cproeis.app.api

import com.cproeis.app.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    @POST("api/auth/login")
    suspend fun login(@Body req: LoginRequest): Response<LoginResponse>

    @GET("api/auth/me")
    suspend fun getMe(): Response<UserModel>

    @GET("api/clients")
    suspend fun listClients(): Response<List<ClientProfileModel>>

    @GET("api/bot/status")
    suspend fun getBotStatus(): Response<BotStatusResponse>

    @POST("api/bot/start")
    suspend fun startBot(@Body req: BotStartRequest): Response<BotStartResponse>

    @POST("api/bot/stop")
    suspend fun stopBot(): Response<BotStartResponse>

    @POST("api/bot/consult")
    suspend fun consultBot(@Body req: BotStartRequest): Response<BotStartResponse>

    @GET("api/bot/logs")
    suspend fun getBotLogs(@Query("since") since: Int = 0): Response<BotLogsResponse>

    @GET("api/comprovantes/vagas-report")
    suspend fun getVagasReport(): Response<VagasReportResponse>
}
