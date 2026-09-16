package com.cproeis.app.ui.dashboard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.cproeis.app.R
import com.cproeis.app.api.ApiClient
import com.cproeis.app.data.model.BotStartRequest
import com.cproeis.app.data.model.ClientProfileModel
import com.cproeis.app.databinding.FragmentDashboardBinding
import com.cproeis.app.service.BotForegroundService
import kotlinx.coroutines.*

class DashboardFragment : Fragment() {

    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!

    private var currentClient: ClientProfileModel? = null
    private var isRunning = false
    private var pollJob: Job? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.swipeRefresh.setOnRefreshListener {
            loadDashboardData()
        }

        binding.btnStartHomolog.setOnClickListener {
            startAutomation("homologacao")
        }

        binding.btnStartProd.setOnClickListener {
            startAutomation("producao")
        }

        binding.btnStop.setOnClickListener {
            stopAutomation()
        }

        binding.cardClient.setOnClickListener {
            currentClient?.let { showClientDetailsDialog(it) }
        }

        loadDashboardData(showSkeleton = true)
        startPolling()
    }

    private fun loadDashboardData(showSkeleton: Boolean = false) {
        if (showSkeleton) {
            binding.skeletonDashboard.root.visibility = View.VISIBLE
            val pulse = android.view.animation.AnimationUtils.loadAnimation(requireContext(), R.anim.skeleton_pulse)
            binding.skeletonDashboard.root.startAnimation(pulse)
            binding.layoutDashboardContent.visibility = View.GONE
        } else {
            binding.swipeRefresh.isRefreshing = true
        }

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val api = ApiClient.getService(requireContext())

                // 1. Carregar dados do cliente do servidor
                val clientsRes = api.listClients()
                if (clientsRes.isSuccessful && !clientsRes.body().isNullOrEmpty()) {
                    val activeClient = clientsRes.body()!!.firstOrNull { it.is_active == true } ?: clientsRes.body()!!.first()
                    currentClient = activeClient
                    updateClientUI(activeClient)
                }

                // 2. Carregar status
                val statusRes = api.getBotStatus()
                if (statusRes.isSuccessful && statusRes.body() != null) {
                    updateStatusUI(statusRes.body()!!.status, statusRes.body()!!.mode)
                }

                // 3. Carregar resumo de vagas
                val reportRes = api.getVagasReport()
                if (reportRes.isSuccessful && reportRes.body() != null) {
                    val summary = reportRes.body()!!.summary
                    val total = summary?.total ?: (reportRes.body()!!.vagas?.size ?: 0)
                    val titular = summary?.titular ?: 0
                    val reserva = summary?.reserva ?: 0

                    binding.tvStatTotal.text = total.toString()
                    binding.tvStatTitular.text = titular.toString()
                    binding.tvStatReserva.text = reserva.toString()
                }
            } catch (e: Exception) {
                // Erro de conexão
            } finally {
                _binding?.let { b ->
                    b.swipeRefresh.isRefreshing = false
                    if (b.skeletonDashboard.root.visibility == View.VISIBLE) {
                        b.skeletonDashboard.root.clearAnimation()
                        b.skeletonDashboard.root.visibility = View.GONE
                        b.layoutDashboardContent.visibility = View.VISIBLE
                    }
                }
            }
        }
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = viewLifecycleOwner.lifecycleScope.launch {
            var pollCounter = 0
            while (isActive) {
                try {
                    val api = ApiClient.getService(requireContext())

                    // Sincronizar dados do cliente a cada ~5s para refletir alterações da web imediatamente
                    if (pollCounter % 2 == 0) {
                        val clientsRes = api.listClients()
                        if (clientsRes.isSuccessful && !clientsRes.body().isNullOrEmpty()) {
                            val activeClient = clientsRes.body()!!.firstOrNull { it.is_active == true } ?: clientsRes.body()!!.first()
                            currentClient = activeClient
                            updateClientUI(activeClient)
                        }
                    }
                    pollCounter++

                    val statusRes = api.getBotStatus()
                    if (statusRes.isSuccessful && statusRes.body() != null) {
                        val status = statusRes.body()!!.status
                        val mode = statusRes.body()!!.mode
                        updateStatusUI(status, mode)
                    }

                    // Obter logs para atualizar ciclo em tempo real
                    val logsRes = api.getBotLogs(0)
                    if (logsRes.isSuccessful && logsRes.body() != null) {
                        parseProgressFromLogs(logsRes.body()!!.logs)
                    }
                } catch (e: Exception) {
                    // Ignora falhas pontuais de poll
                }
                delay(2500)
            }
        }
    }

    private fun parseProgressFromLogs(logs: List<com.cproeis.app.data.model.LogEntryModel>) {
        if (logs.isEmpty()) return

        var currentCycle = 1
        val maxCycles = currentClient?.max_attempts ?: 60
        var currentVagas = 0
        val metaVagas = currentClient?.meta_vagas ?: 1

        for (i in logs.indices.reversed()) {
            val msg = logs[i].message

            val cycleMatch = Regex("Ciclo\\s+(\\d+)/(\\d+)", RegexOption.IGNORE_CASE).find(msg)
            if (cycleMatch != null && currentCycle == 1) {
                currentCycle = cycleMatch.groupValues[1].toIntOrNull() ?: 1
            }

            val vagaMatch = Regex("(?:Progresso:\\s*|\\()(\\d+)/(\\d+)", RegexOption.IGNORE_CASE).find(msg)
            if (vagaMatch != null && currentVagas == 0) {
                currentVagas = vagaMatch.groupValues[1].toIntOrNull() ?: 0
            }
        }

        binding.tvCycleCount.text = "Tentativa: $currentCycle de $maxCycles"
        binding.tvVagasCount.text = "Meta: $currentVagas de $metaVagas vaga(s)"
        val percent = if (maxCycles > 0) (currentCycle * 100) / maxCycles else 0
        binding.pbAttempts.progress = percent
    }

    private fun updateClientUI(client: ClientProfileModel) {
        binding.tvClientName.text = client.name
        binding.tvClientDoc.text = "${client.document_type ?: "Doc"}: ${client.document ?: "-"}"
        binding.tvClientConvenio.text = client.convenio ?: "HCPM - RAS"

        val isActive = client.is_active != false
        binding.tvClientStatusBadge.text = if (isActive) "ATIVO" else "INATIVO"
        binding.tvClientStatusBadge.setTextColor(
            resources.getColor(if (isActive) R.color.success else R.color.text_muted, null)
        )

        // Horários preferenciais
        val hours = client.preferred_hours?.trim()
        binding.tvClientHours.text = if (!hours.isNullOrEmpty()) hours else "Todos os horários"

        // Período de busca / datas
        if (!client.data_inicio.isNullOrEmpty() || !client.data_fim.isNullOrEmpty()) {
            if (client.data_inicio == client.data_fim && !client.data_inicio.isNullOrEmpty()) {
                binding.tvClientDates.text = "Dia ${client.data_inicio}"
            } else {
                binding.tvClientDates.text = "${client.data_inicio ?: "Início"} até ${client.data_fim ?: "Fim"}"
            }
        } else {
            val ini = client.days_forward_initial ?: 6
            val max = client.days_forward_max ?: 7
            if (ini == max) {
                binding.tvClientDates.text = "+$ini dia à frente"
            } else {
                binding.tvClientDates.text = "+$ini a +$max dias à frente"
            }
        }

        // Postos / Eventos
        val events = client.preferred_events?.trim()
        binding.tvClientEvents.text = if (!events.isNullOrEmpty()) "Postos: $events" else "Postos: Todos os cadastrados"

        // Parâmetros do robô e atualização imediata do card de progresso
        val meta = client.meta_vagas ?: 1
        val maxCycles = client.max_attempts ?: 120
        val interval = client.interval_seconds ?: 6
        val titularOnly = if (client.only_titular == true) " | Apenas Titular" else ""
        binding.tvClientBotParams.text = "Meta: $meta vaga(s) | Ciclos: $maxCycles | Intervalo: ${interval}s$titularOnly"

        if (!isRunning) {
            binding.tvVagasCount.text = "Meta: 0 de $meta vaga(s)"
            binding.tvCycleCount.text = "Tentativa: 0 de $maxCycles"
        }
    }

    private fun showClientDetailsDialog(client: ClientProfileModel) {
        val dialog = com.google.android.material.bottomsheet.BottomSheetDialog(requireContext())
        val dialogBinding = com.cproeis.app.databinding.DialogClientDetailsBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)

        dialogBinding.dialogTvName.text = client.name
        dialogBinding.dialogTvDoc.text = "${client.document_type ?: "Doc"}: ${client.document ?: "-"}"
        dialogBinding.dialogTvConvenio.text = client.convenio ?: "HCPM - RAS"

        val isActive = client.is_active != false
        dialogBinding.dialogTvStatusBadge.text = if (isActive) "ATIVO" else "INATIVO"
        dialogBinding.dialogTvStatusBadge.setTextColor(
            resources.getColor(if (isActive) R.color.success else R.color.text_muted, null)
        )

        val hours = client.preferred_hours?.trim()
        dialogBinding.dialogTvHours.text = if (!hours.isNullOrEmpty()) hours else "Todos os horários cadastrados"

        if (!client.data_inicio.isNullOrEmpty() || !client.data_fim.isNullOrEmpty()) {
            if (client.data_inicio == client.data_fim && !client.data_inicio.isNullOrEmpty()) {
                dialogBinding.dialogTvDates.text = "Dia ${client.data_inicio}"
            } else {
                dialogBinding.dialogTvDates.text = "${client.data_inicio ?: "Início"} até ${client.data_fim ?: "Fim"}"
            }
        } else {
            val ini = client.days_forward_initial ?: 6
            val max = client.days_forward_max ?: 7
            if (ini == max) {
                dialogBinding.dialogTvDates.text = "+$ini dia à frente"
            } else {
                dialogBinding.dialogTvDates.text = "+$ini a +$max dias à frente"
            }
        }

        val titularText = if (client.only_titular == true) "Apenas Titular: Sim (ignora vagas de reserva)" else "Apenas Titular: Não (aceita titulares e reservas)"
        dialogBinding.dialogTvVagaCriteria.text = titularText

        val events = client.preferred_events?.trim()
        dialogBinding.dialogTvEvents.text = if (!events.isNullOrEmpty()) "Postos selecionados: $events" else "Postos: Todos os cadastrados no PROEIS"

        val meta = client.meta_vagas ?: 1
        val maxCycles = client.max_attempts ?: 120
        val interval = client.interval_seconds ?: 6
        dialogBinding.dialogTvBotParams.text = "Meta: $meta vaga(s) | Ciclos: $maxCycles tentativas | Intervalo: ${interval}s"

        dialogBinding.dialogBtnClose.setOnClickListener {
            dialog.dismiss()
        }

        dialog.show()
    }

    private fun updateStatusUI(status: String, mode: String) {
        isRunning = status == "running"

        binding.tvRobotStatus.text = "STATUS: ${status.uppercase()}"
        binding.tvModeBadge.text = mode.uppercase()

        if (isRunning) {
            binding.tvRobotStatus.setTextColor(resources.getColor(R.color.success, null))
            binding.btnStartHomolog.visibility = View.GONE
            binding.btnStartProd.visibility = View.GONE
            binding.btnStop.visibility = View.VISIBLE
        } else {
            binding.tvRobotStatus.setTextColor(resources.getColor(R.color.text_primary, null))
            binding.btnStartHomolog.visibility = View.VISIBLE
            binding.btnStartProd.visibility = View.VISIBLE
            binding.btnStop.visibility = View.GONE
        }
    }

    private fun startAutomation(mode: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val api = ApiClient.getService(requireContext())
                val res = api.startBot(BotStartRequest(mode = mode, client_id = currentClient?.id))
                if (res.isSuccessful && res.body()?.success == true) {
                    Toast.makeText(context, "Automação iniciada em modo $mode!", Toast.LENGTH_SHORT).show()
                    BotForegroundService.startService(requireContext())
                    loadDashboardData()
                } else {
                    Toast.makeText(context, res.body()?.message ?: "Falha ao iniciar", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Erro: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun stopAutomation() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val api = ApiClient.getService(requireContext())
                val res = api.stopBot()
                if (res.isSuccessful) {
                    Toast.makeText(context, "Automação interrompida", Toast.LENGTH_SHORT).show()
                    BotForegroundService.stopService(requireContext())
                    loadDashboardData()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Erro ao parar: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroyView() {
        pollJob?.cancel()
        _binding = null
        super.onDestroyView()
    }
}
