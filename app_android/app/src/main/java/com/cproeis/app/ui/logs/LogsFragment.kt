package com.cproeis.app.ui.logs

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.cproeis.app.api.ApiClient
import com.cproeis.app.databinding.FragmentLogsBinding
import kotlinx.coroutines.*

class LogsFragment : Fragment() {

    private var _binding: FragmentLogsBinding? = null
    private val binding get() = _binding!!
    private val adapter = LogsAdapter()
    private var pollJob: Job? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLogsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val layoutManager = LinearLayoutManager(requireContext())
        layoutManager.stackFromEnd = true
        binding.rvLogs.layoutManager = layoutManager
        binding.rvLogs.adapter = adapter

        binding.btnClearLogs.setOnClickListener {
            adapter.updateList(emptyList())
        }

        startPollingLogs()
    }

    private fun startPollingLogs() {
        pollJob?.cancel()
        pollJob = viewLifecycleOwner.lifecycleScope.launch {
            while (isActive) {
                try {
                    val api = ApiClient.getService(requireContext())
                    val res = api.getBotLogs(0)
                    if (res.isSuccessful && res.body() != null) {
                        val logs = res.body()!!.logs
                        adapter.updateList(logs)
                        if (logs.isNotEmpty()) {
                            binding.rvLogs.scrollToPosition(logs.size - 1)
                        }
                    }
                } catch (e: Exception) {
                    // Falha de rede
                }
                delay(2000)
            }
        }
    }

    override fun onDestroyView() {
        pollJob?.cancel()
        _binding = null
        super.onDestroyView()
    }
}
