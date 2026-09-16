package com.cproeis.app.ui.vagas

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.cproeis.app.data.model.VagaModel
import com.cproeis.app.databinding.ItemVagaBinding

class VagasAdapter(private var items: List<VagaModel> = emptyList()) :
    RecyclerView.Adapter<VagasAdapter.VagaViewHolder>() {

    fun updateList(newItems: List<VagaModel>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VagaViewHolder {
        val binding = ItemVagaBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VagaViewHolder(binding)
    }

    override fun onBindViewHolder(holder: VagaViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    class VagaViewHolder(private val binding: ItemVagaBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(vaga: VagaModel) {
            binding.tvDataEvento.text = vaga.data_evento ?: "-"
            binding.tvEvento.text = vaga.evento ?: "Vaga Confirmada"
            binding.tvConvenio.text = vaga.convenio ?: "HCPM - RAS"
            binding.tvHorario.text = vaga.horario ?: "07 às 19"
            binding.tvTipoVaga.text = (vaga.tipo_vaga ?: "Titular").uppercase()
            binding.tvDataAgendamento.text = "Agendamento: ${vaga.data_agendamento ?: "-"}"
        }
    }
}
