package com.cproeis.app.ui.main

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.cproeis.app.R
import com.cproeis.app.api.ApiClient
import kotlinx.coroutines.launch
import com.cproeis.app.databinding.ActivityMainBinding
import com.cproeis.app.ui.dashboard.DashboardFragment
import com.cproeis.app.ui.login.LoginActivity
import com.cproeis.app.ui.logs.LogsFragment
import com.cproeis.app.ui.vagas.VagasFragment

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val prefs = getSharedPreferences("cproeis_prefs", Context.MODE_PRIVATE)
        val userEmail = prefs.getString("user_email", "conectado")
        binding.tvUserEmail.text = userEmail

        binding.btnLogout.setOnClickListener {
            prefs.edit().remove("auth_token").apply()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        binding.bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_dashboard -> {
                    replaceFragment(DashboardFragment())
                    true
                }
                R.id.nav_vagas -> {
                    replaceFragment(VagasFragment())
                    true
                }
                R.id.nav_logs -> {
                    replaceFragment(LogsFragment())
                    true
                }
                else -> false
            }
        }

        if (savedInstanceState == null) {
            limparLogsAntigos()
            replaceFragment(DashboardFragment())
        }
    }

    // limpa os logs da execucao anterior a cada abertura do app,
    // exceto se o bot ainda estiver rodando (nao descarta log ao vivo)
    private fun limparLogsAntigos() {
        lifecycleScope.launch {
            try {
                val api = ApiClient.getService(this@MainActivity)
                val status = api.getBotStatus()
                val rodando = status.body()?.status?.lowercase() in listOf("running", "rodando")
                if (!rodando) {
                    api.clearBotLogs()
                }
            } catch (e: Exception) {
                // Falha de rede
            }
        }
    }

    private fun replaceFragment(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragmentContainer, fragment)
            .commit()
    }
}
