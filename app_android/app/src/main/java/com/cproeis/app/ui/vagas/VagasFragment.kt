package com.cproeis.app.ui.vagas

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.cproeis.app.api.ApiClient
import com.cproeis.app.databinding.FragmentVagasBinding
import kotlinx.coroutines.launch

class VagasFragment : Fragment() {

    private var _binding: FragmentVagasBinding? = null
    private val binding get() = _binding!!
    private val adapter = VagasAdapter()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentVagasBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.rvVagas.layoutManager = LinearLayoutManager(requireContext())
        binding.rvVagas.adapter = adapter

        binding.swipeRefreshVagas.setOnRefreshListener {
            loadVagas()
        }

        loadVagas()
    }

    private fun loadVagas() {
        binding.pbLoading.visibility = View.VISIBLE
        binding.tvEmptyState.visibility = View.GONE

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val api = ApiClient.getService(requireContext())
                val res = api.getVagasReport()

                if (res.isSuccessful && res.body() != null) {
                    val list = res.body()!!.vagas ?: emptyList()
                    adapter.updateList(list)

                    binding.tvTotalVagasHeader.text = "${list.size} vaga(s)"
                    if (list.isEmpty()) {
                        binding.tvEmptyState.visibility = View.VISIBLE
                    }
                } else {
                    binding.tvEmptyState.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                binding.tvEmptyState.text = "Falha ao carregar vagas: ${e.localizedMessage}"
                binding.tvEmptyState.visibility = View.VISIBLE
            } finally {
                binding.pbLoading.visibility = View.GONE
                _binding?.swipeRefreshVagas?.isRefreshing = false
            }
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
