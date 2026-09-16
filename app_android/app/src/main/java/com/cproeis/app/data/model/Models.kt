package com.cproeis.app.data.model

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    val email: String,
    val password: String,
    val username: String? = null
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
    @SerializedName("id") val id: Int,
    @SerializedName("name") val name: String,
    @SerializedName("document") val document: String?,
    @SerializedName("document_type") val document_type: String?,
    @SerializedName("convenio") val convenio: String?,
    @SerializedName("preferred_events") val preferred_events: String?,
    @SerializedName("preferred_hours") val preferred_hours: String?,
    @SerializedName("only_listed_events") val only_listed_events: Boolean? = false,
    @SerializedName("only_titular") val only_titular: Boolean? = false,
    @SerializedName("tipo_data") val tipo_data: String? = "dias_frente",
    @SerializedName("data_inicio") val data_inicio: String? = null,
    @SerializedName("data_fim") val data_fim: String? = null,
    @SerializedName("days_forward_initial") val days_forward_initial: Int? = 6,
    @SerializedName("days_forward_max") val days_forward_max: Int? = 7,
    @SerializedName("interval_seconds") val interval_seconds: Int? = 6,
    @SerializedName("meta_vagas") val meta_vagas: Int? = 1,
    @SerializedName("max_attempts") val max_attempts: Int? = 120,
    @SerializedName("is_active") val is_active: Boolean? = true
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
