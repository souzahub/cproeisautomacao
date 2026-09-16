package com.cproeis.app.data.model

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    val username: String,
    val password: String
)

data class LoginResponse(
    @SerializedName("access_token") val accessToken: String?,
    @SerializedName("token_type") val tokenType: String?,
    val user: UserModel?
)

data class UserModel(
    val id: Int,
    val email: String,
    val name: String?,
    val role: String?
)

data class ClientProfileModel(
    val id: Int,
    val name: String,
    val document: String?,
    val document_type: String?,
    val convenio: String?,
    val preferred_events: String?,
    val preferred_hours: String?,
    val meta_vagas: Int?,
    val max_attempts: Int?,
    val is_active: Boolean?
)

data class BotStatusResponse(
    val status: String,
    val mode: String,
    val started_at: String?,
    val pid: Int?,
    val logs_count: Int?,
    val client_name: String?
)

data class BotStartRequest(
    val mode: String = "homologacao",
    val client_id: Int? = null
)

data class BotStartResponse(
    val success: Boolean,
    val message: String
)

data class BotLogsResponse(
    val logs: List<LogEntryModel>,
    val total_count: Int
)

data class LogEntryModel(
    val timestamp: String,
    val message: String
)

data class VagasReportResponse(
    val vagas: List<VagaModel>?,
    val executions: List<ExecutionModel>?,
    val summary: VagasSummaryModel?
)

data class VagaModel(
    val id: String?,
    val execution_id: Int?,
    val cliente: String?,
    val evento: String?,
    val convenio: String?,
    val data_evento: String?,
    val horario: String?,
    val tipo_vaga: String?,
    val status: String?,
    val modo: String?,
    val data_agendamento: String?
)

data class ExecutionModel(
    val id: Int,
    val label: String?,
    val client_name: String?,
    val mode: String?,
    val status: String?,
    val started_at: String?
)

data class VagasSummaryModel(
    val total: Int,
    val titular: Int,
    val reserva: Int
)
