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

import android.view.animation.AnimationUtils
import com.cproeis.app.R

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
            loadVagas(showSkeleton = false)
        }

        loadVagas(showSkeleton = true)
    }

    private fun loadVagas(showSkeleton: Boolean = false) {
        if (showSkeleton) {
            binding.skeletonVagas.root.visibility = View.VISIBLE
            val pulse = AnimationUtils.loadAnimation(requireContext(), R.anim.skeleton_pulse)
            binding.skeletonVagas.root.startAnimation(pulse)
            binding.rvVagas.visibility = View.GONE
        }
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
                    } else {
                        binding.rvVagas.visibility = View.VISIBLE
                    }
                } else {
                    binding.tvEmptyState.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                binding.tvEmptyState.text = "Falha ao carregar vagas: ${e.localizedMessage}"
                binding.tvEmptyState.visibility = View.VISIBLE
            } finally {
                _binding?.let { b ->
                    if (b.skeletonVagas.root.visibility == View.VISIBLE) {
                        b.skeletonVagas.root.clearAnimation()
                        b.skeletonVagas.root.visibility = View.GONE
                    }
                    b.swipeRefreshVagas.isRefreshing = false
                }
            }
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
