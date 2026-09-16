package com.cproeis.app.ui.logs

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.cproeis.app.data.model.LogEntryModel
import com.cproeis.app.databinding.ItemLogBinding

class LogsAdapter(private var items: List<LogEntryModel> = emptyList()) :
    RecyclerView.Adapter<LogsAdapter.LogViewHolder>() {

    fun updateList(newItems: List<LogEntryModel>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LogViewHolder {
        val binding = ItemLogBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return LogViewHolder(binding)
    }

    override fun onBindViewHolder(holder: LogViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    class LogViewHolder(private val binding: ItemLogBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(log: LogEntryModel) {
            binding.tvLogTime.text = "[${log.timestamp}]"
            binding.tvLogMessage.text = log.message
        }
    }
}
