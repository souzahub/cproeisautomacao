package com.cproeis.app.ui.login

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.cproeis.app.api.ApiClient
import com.cproeis.app.data.model.LoginRequest
import com.cproeis.app.databinding.ActivityLoginBinding
import com.cproeis.app.ui.main.MainActivity
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Verificar se já está autenticado
        val prefs = getSharedPreferences("cproeis_prefs", Context.MODE_PRIVATE)
        val token = prefs.getString("auth_token", null)
        if (!token.isNullOrEmpty()) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val savedUrl = ApiClient.getServerUrl(this)
        binding.etServerUrl.setText(savedUrl.trimEnd('/'))

        binding.btnLogin.setOnClickListener {
            doLogin()
        }
    }

    private fun doLogin() {
        val username = binding.etEmail.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()
        val serverUrl = binding.etServerUrl.text.toString().trim()

        if (username.isEmpty()) {
            binding.tilEmail.error = "Informe o e-mail ou usuário"
            return
        }
        binding.tilEmail.error = null

        if (password.isEmpty()) {
            binding.tilPassword.error = "Informe a senha"
            return
        }
        binding.tilPassword.error = null

        if (serverUrl.isNotEmpty()) {
            ApiClient.setServerUrl(this, serverUrl)
        }

        binding.progressBar.visibility = View.VISIBLE
        binding.btnLogin.isEnabled = false
        binding.tvError.visibility = View.GONE

        lifecycleScope.launch {
            try {
                val api = ApiClient.getService(this@LoginActivity)
                val res = api.login(LoginRequest(email = username, password = password, username = username))

                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val token = body.accessToken ?: ""

                    val prefs = getSharedPreferences("cproeis_prefs", Context.MODE_PRIVATE)
                    prefs.edit()
                        .putString("auth_token", token)
                        .putString("user_email", body.user?.email ?: username)
                        .putString("user_name", body.user?.name ?: username)
                        .putString("user_role", body.user?.role ?: "user")
                        .apply()

                    startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                    finish()
                } else {
                    binding.tvError.text = "Credenciais inválidas ou erro no servidor."
                    binding.tvError.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                binding.tvError.text = "Falha ao conectar: ${e.localizedMessage ?: "Verifique a URL e a internet"}"
                binding.tvError.visibility = View.VISIBLE
            } finally {
                binding.progressBar.visibility = View.GONE
                binding.btnLogin.isEnabled = true
            }
        }
    }
}
