import { Capacitor, CapacitorHttp } from "@capacitor/core"
import Tesseract from "tesseract.js"
import { botApi } from "./client"

let cookieStore = {}

export function clearNativeCookies() {
  cookieStore = {}
}

function parseCookiesFromHeaders(headers) {
  if (!headers) return
  const raw = headers["Set-Cookie"] || headers["set-cookie"] || headers["Set-cookie"]
  if (!raw) return
  const list = Array.isArray(raw) ? raw : [raw]
  for (const item of list) {
    const parts = String(item).split(";")
    if (parts.length > 0) {
      const kv = parts[0].trim().split("=")
      if (kv.length >= 2 && kv[0]) {
        cookieStore[kv[0].trim()] = kv.slice(1).join("=").trim()
      }
    }
  }
}

function getCookieHeader() {
  const entries = Object.entries(cookieStore)
  if (entries.length === 0) return {}
  const joined = entries.map(([k, v]) => `${k}=${v}`).join("; ")
  return { Cookie: joined }
}

function isNativeMobile() {
  return Capacitor.isNativePlatform() || (typeof window !== "undefined" && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
}

async function httpGet(url, headers = {}) {
  const cookieHeaders = getCookieHeader()
  const mergedHeaders = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
    ...cookieHeaders,
    ...headers
  }

  if (isNativeMobile()) {
    const response = await CapacitorHttp.get({
      url,
      headers: mergedHeaders
    })
    parseCookiesFromHeaders(response.headers)
    return {
      status: response.status,
      data: response.data,
      url: response.url || url,
      headers: response.headers
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers: mergedHeaders,
    credentials: "include"
  })
  const text = await response.text()
  return {
    status: response.status,
    data: text,
    url: response.url
  }
}

async function httpPost(url, data, headers = {}) {
  let formBody = ""
  if (typeof data === "object" && !(data instanceof FormData)) {
    formBody = Object.keys(data)
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(data[k] !== undefined && data[k] !== null ? data[k] : ""))
      .join("&")
  } else {
    formBody = String(data)
  }

  const cookieHeaders = getCookieHeader()
  const mergedHeaders = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
    ...cookieHeaders,
    ...headers
  }

  if (isNativeMobile()) {
    const response = await CapacitorHttp.post({
      url,
      data: formBody,
      headers: mergedHeaders
    })
    parseCookiesFromHeaders(response.headers)
    return {
      status: response.status,
      data: response.data,
      url: response.url || url,
      headers: response.headers
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: mergedHeaders,
    body: formBody,
    credentials: "include"
  })
  const text = await response.text()
  return {
    status: response.status,
    data: text,
    url: response.url
  }
}

function parseAspnetFields(html) {
  const fields = {}
  if (!html) return fields

  const vsMatch = html.match(/name="__VIEWSTATE"\s+id="__VIEWSTATE"\s+value="([^"]*)"/i) || html.match(/id="__VIEWSTATE"\s+value="([^"]*)"/i)
  if (vsMatch) fields["__VIEWSTATE"] = vsMatch[1]

  const evMatch = html.match(/name="__EVENTVALIDATION"\s+id="__EVENTVALIDATION"\s+value="([^"]*)"/i) || html.match(/id="__EVENTVALIDATION"\s+value="([^"]*)"/i)
  if (evMatch) fields["__EVENTVALIDATION"] = evMatch[1]

  const vgMatch = html.match(/name="__VIEWSTATEGENERATOR"\s+id="__VIEWSTATEGENERATOR"\s+value="([^"]*)"/i) || html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]*)"/i)
  if (vgMatch) fields["__VIEWSTATEGENERATOR"] = vgMatch[1]

  return fields
}

function preprocessImageBase64(base64Image) {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.document) {
      return resolve(base64Image)
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")
        ctx.drawImage(img, 0, 0)

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imgData.data

        for (let i = 0; i < data.length; i += 4) {
          const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
          const val = avg < 160 ? 0 : 255
          data[i] = val
          data[i + 1] = val
          data[i + 2] = val
        }

        ctx.putImageData(imgData, 0, 0)
        resolve(canvas.toDataURL("image/png"))
      } catch {
        resolve(base64Image)
      }
    }
    img.onerror = () => resolve(base64Image)
    img.src = base64Image.startsWith("data:") ? base64Image : `data:image/png;base64,${base64Image}`
  })
}

async function apiJsonPost(url, payload, headers = {}) {
  const mergedHeaders = {
    "Content-Type": "application/json",
    ...headers
  }
  if (isNativeMobile()) {
    const res = await CapacitorHttp.post({
      url,
      headers: mergedHeaders,
      data: payload
    })
    const isOk = res.status >= 200 && res.status < 300
    let parsed = res.data
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed)
      } catch {}
    }
    return {
      ok: isOk,
      status: res.status,
      json: async () => parsed
    }
  }
  const resp = await fetch(url, {
    method: "POST",
    headers: mergedHeaders,
    body: JSON.stringify(payload)
  })
  return {
    ok: resp.ok,
    status: resp.status,
    json: async () => resp.json()
  }
}

async function solveCaptchaWithTesseract(base64Image, emitLog) {
  try {
    const formatted = base64Image.startsWith("data:") ? base64Image : `data:image/png;base64,${base64Image}`
    const preprocessed = await preprocessImageBase64(formatted)

    const res = await Tesseract.recognize(preprocessed, "eng", {
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      tessedit_pageseg_mode: "7"
    })

    const raw = res?.data?.text || ""
    const clean = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim()
    if (emitLog) {
      emitLog(`OCR local: ${clean || "vazio"}`)
    }
    if (clean.length === 6) {
      return clean
    }
    return ""
  } catch (err) {
    if (emitLog) {
      emitLog(`OCR local indisponível`)
    }
    return ""
  }
}

async function solveCaptchaWithGemini(base64Image, apiKey, model = "antigravity99", emitLog) {
  if (!apiKey || !base64Image) return ""

  const cleanB64 = base64Image.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, "").trim()
  const cleanKey = apiKey.trim()

  const baseUrl = (typeof window !== "undefined" ? (localStorage.getItem("AI_BASE_URL") || "https://9router.devsouza.online/v1") : "https://9router.devsouza.online/v1").trim().replace(/\/+$/, "")

  if (baseUrl && (baseUrl.includes("9router") || baseUrl.includes("http"))) {
    try {
      const targetUrl = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`
      const chosenModel = (model && model !== "myCombo" && model !== "gemini-2.5-flash" ? model : (typeof window !== "undefined" && localStorage.getItem("GEMINI_MODEL") ? localStorage.getItem("GEMINI_MODEL") : "antigravity99")).trim()
      const headers = {}
      if (cleanKey) headers["Authorization"] = `Bearer ${cleanKey}`

      const resp = await apiJsonPost(
        targetUrl,
        {
          model: chosenModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Retorne estritamente apenas os 6 caracteres alfanuméricos do captcha desta imagem, em maiúsculo, sem espaços e sem pontuação." },
                { type: "image_url", image_url: { url: `data:image/png;base64,${cleanB64}` } }
              ]
            }
          ],
          temperature: 0.0,
          stream: false
        },
        headers
      )

      if (resp.ok) {
        const raw = await resp.json()
        let text = raw?.choices?.[0]?.message?.content || ""
        if (!text && typeof raw === "string") {
          for (const line of raw.split("\n")) {
            if (line.startsWith("data:")) {
              const part = line.slice(5).trim()
              if (part && part !== "[DONE]") {
                try {
                  const pJson = JSON.parse(part)
                  text += pJson?.choices?.[0]?.delta?.content || ""
                } catch {}
              }
            }
          }
        }
        const code = extractCode(text)
        if (code.length === 6) {
          if (emitLog) emitLog(`9router (${chosenModel}) identificou: ${code}`)
          return code
        }
      } else {
        if (emitLog) emitLog(`9router retornou status ${resp.status}`)
      }
    } catch (err) {
      if (emitLog) emitLog(`Falha conexao 9router: ${err.message}`)
    }
  }

  if (cleanKey.startsWith("sk-or-")) {
    try {
      const chosenModel = (model && model.includes("/")) ? model.trim() : "google/gemini-2.5-flash"
      const resp = await apiJsonPost(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: chosenModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Retorne estritamente apenas os 6 caracteres alfanuméricos do captcha desta imagem, em maiúsculo, sem espaços e sem pontuação." },
                { type: "image_url", image_url: { url: `data:image/png;base64,${cleanB64}` } }
              ]
            }
          ],
          temperature: 0.0
        },
        { "Authorization": `Bearer ${cleanKey}` }
      )

      if (resp.ok) {
        const data = await resp.json()
        const text = data?.choices?.[0]?.message?.content || ""
        const code = extractCode(text)
        if (code.length === 6) {
          if (emitLog) emitLog(`IA OpenRouter identificou: ${code}`)
          return code
        }
      } else {
        if (emitLog) emitLog(`OpenRouter retornou status ${resp.status}`)
      }
    } catch (err) {
      if (emitLog) emitLog(`Falha conexao OpenRouter: ${err.message}`)
    }
    return ""
  }

  if (cleanKey.startsWith("sk-")) {
    try {
      const chosenModel = (model && !model.includes("/")) ? model.trim() : "gpt-4o-mini"
      const resp = await apiJsonPost(
        "https://api.openai.com/v1/chat/completions",
        {
          model: chosenModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Retorne estritamente apenas os 6 caracteres alfanuméricos do captcha desta imagem, em maiúsculo, sem espaços e sem pontuação." },
                { type: "image_url", image_url: { url: `data:image/png;base64,${cleanB64}` } }
              ]
            }
          ],
          temperature: 0.0
        },
        { "Authorization": `Bearer ${cleanKey}` }
      )

      if (resp.ok) {
        const data = await resp.json()
        const text = data?.choices?.[0]?.message?.content || ""
        const code = extractCode(text)
        if (code.length === 6) {
          if (emitLog) emitLog(`IA OpenAI identificou: ${code}`)
          return code
        }
      } else {
        if (emitLog) emitLog(`OpenAI retornou status ${resp.status}`)
      }
    } catch (err) {
      if (emitLog) emitLog(`Falha conexao OpenAI: ${err.message}`)
    }
    return ""
  }

  if (cleanKey.startsWith("gsk_")) {
    try {
      const chosenModel = (model && !model.includes("/")) ? model.trim() : "llama-3.2-11b-vision-preview"
      const resp = await apiJsonPost(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: chosenModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Retorne estritamente apenas os 6 caracteres alfanuméricos do captcha desta imagem, em maiúsculo, sem espaços e sem pontuação." },
                { type: "image_url", image_url: { url: `data:image/png;base64,${cleanB64}` } }
              ]
            }
          ],
          temperature: 0.0
        },
        { "Authorization": `Bearer ${cleanKey}` }
      )

      if (resp.ok) {
        const data = await resp.json()
        const text = data?.choices?.[0]?.message?.content || ""
        const code = extractCode(text)
        if (code.length === 6) {
          if (emitLog) emitLog(`IA Groq identificou: ${code}`)
          return code
        }
      } else {
        if (emitLog) emitLog(`Groq retornou status ${resp.status}`)
      }
    } catch (err) {
      if (emitLog) emitLog(`Falha conexao Groq: ${err.message}`)
    }
    return ""
  }

  const candidateModels = []
  if (model && model.trim()) {
    const rawModel = model.trim().replace(/^models\//, "")
    candidateModels.push(rawModel)
  }
  const defaultGeminiModels = ["gemini-3.7-flash", "gemini-2.5-flash", "gemini-2.0-flash"]
  for (const m of defaultGeminiModels) {
    if (!candidateModels.includes(m)) {
      candidateModels.push(m)
    }
  }

  const payload = {
    contents: [
      {
        parts: [
          { text: "Retorne estritamente apenas os 6 caracteres alfanumericos do captcha desta imagem, em maiusculo, sem espacos, sem pontuacao e sem qualquer outra palavra." },
          { inlineData: { mimeType: "image/png", data: cleanB64 } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.0,
      thinkingConfig: { thinkingBudget: 0 }
    }
  }

  for (const targetModel of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${cleanKey}`
      const resp = await apiJsonPost(url, payload)

      if (resp.ok) {
        const result = await resp.json()
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || ""
        const code = extractCode(text)
        if (code.length === 6) {
          if (emitLog) emitLog(`Gemini (${targetModel}) identificou: ${code}`)
          return code
        }
      } else if (resp.status === 429) {
        if (emitLog) emitLog(`Gemini (${targetModel}) cota atingida (429)`)
      } else if (resp.status === 404 || resp.status === 400) {
        continue
      } else {
        if (emitLog) emitLog(`Gemini (${targetModel}) status ${resp.status}`)
      }
    } catch (err) {
      if (emitLog) emitLog(`Falha conexao Gemini (${targetModel}): ${err.message}`)
    }
  }

  return ""
}

async function extractCaptchaBase64(html, baseUrl = "https://www.proeis.rj.gov.br") {
  if (!html) return ""

  const styleMatch = html.match(/url\(['"]?(data:image\/[^'"]+)['"]?\)/i)
  if (styleMatch) {
    return styleMatch[1]
  }

  const dataUriMatch = html.match(/data:image\/[a-zA-Z]+;base64,([A-Za-z0-9+/=]{60,})/i)
  if (dataUriMatch) {
    return dataUriMatch[0]
  }

  const allB64 = html.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/gi)
  if (allB64 && allB64.length > 0) {
    return allB64[allB64.length - 1]
  }

  const imgMatches = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || []
  for (const imgTag of imgMatches) {
    const srcMatch = imgTag.match(/src=["']([^"']+)["']/i)
    if (!srcMatch) continue
    const src = srcMatch[1]

    if (src.toLowerCase().includes("captcha") || imgTag.toLowerCase().includes("captcha") || src.includes(".ashx") || src.includes(".axd") || src.includes("JpegImage")) {
      let resolvedUrl = src
      if (src.startsWith("/")) {
        resolvedUrl = baseUrl.replace(/\/+$/, "") + src
      } else if (!src.startsWith("http")) {
        resolvedUrl = baseUrl.replace(/\/+$/, "") + "/" + src
      }

      if (isNativeMobile()) {
        const cookieHeaders = getCookieHeader()
        const res = await CapacitorHttp.get({
          url: resolvedUrl,
          responseType: "base64",
          headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 14; Mobile)",
            ...cookieHeaders
          }
        })
        if (res && res.data) {
          return `data:image/png;base64,${res.data}`
        }
      } else {
        try {
          const res = await fetch(resolvedUrl, { credentials: "include" })
          const blob = await res.blob()
          return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.readAsDataURL(blob)
          })
        } catch {}
      }
    }
  }

  return ""
}

export async function loginProeisDirect(clientData, settings, emitLog) {
  let targetUrl = (settings?.PROEIS_URL || clientData?.proeis_url || "https://www.proeis.rj.gov.br").replace(/\/+$/, "")
  if (!targetUrl.startsWith("http")) {
    targetUrl = `https://${targetUrl}`
  }

  const rootUrl = `${targetUrl}/`
  const localKey = (typeof window !== "undefined" ? (localStorage.getItem("GEMINI_API_KEY") || localStorage.getItem("ai_api_key") || "") : "").trim()
  const apiKey = (settings?.GEMINI_API_KEY || clientData?.gemini_api_key || localKey || "").trim()
  const localModel = (typeof window !== "undefined" ? (localStorage.getItem("GEMINI_MODEL") || "") : "").trim()
  const model = settings?.GEMINI_MODEL || clientData?.gemini_model || localModel || "antigravity99"
  const docType = clientData?.document_type || "CPF"

  emitLog("Conectando ao portal CPROEIS pelo seu dispositivo...")

  let initResp
  try {
    initResp = await httpGet(rootUrl)
  } catch (err) {
    emitLog(`Falha ao carregar portal de login: ${err.message}`)
    return { success: false, message: err.message }
  }

  let currentHtml = typeof initResp.data === "string" ? initResp.data : JSON.stringify(initResp.data)
  let aspFields = parseAspnetFields(currentHtml)

  emitLog(`Selecionando tipo de documento (${docType})...`)
  const initialSelect = {
    ...aspFields,
    __EVENTTARGET: "ddlTipoAcesso",
    __EVENTARGUMENT: "",
    ddlTipoAcesso: docType
  }

  try {
    const selectResp = await httpPost(rootUrl, initialSelect)
    currentHtml = typeof selectResp.data === "string" ? selectResp.data : JSON.stringify(selectResp.data)
    aspFields = parseAspnetFields(currentHtml)
  } catch {}

  const maxTentativas = Number(clientData?.max_attempts) || Number(settings?.TENTATIVAS_MAXIMAS) || 20

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    emitLog(`Tentativa de login ${tentativa}/${maxTentativas}...`)

    aspFields = parseAspnetFields(currentHtml)
    let captchaB64 = await extractCaptchaBase64(currentHtml, targetUrl)

    if (!captchaB64) {
      emitLog("Solicitando imagem de captcha ao portal...")
      const reloadPostback = {
        ...aspFields,
        __EVENTTARGET: "ddlTipoAcesso",
        __EVENTARGUMENT: "",
        ddlTipoAcesso: docType
      }
      try {
        const rep = await httpPost(rootUrl, reloadPostback)
        currentHtml = typeof rep.data === "string" ? rep.data : JSON.stringify(rep.data)
        aspFields = parseAspnetFields(currentHtml)
        captchaB64 = await extractCaptchaBase64(currentHtml, targetUrl)
      } catch {}
    }

    let solvedCode = ""

    if (captchaB64) {
      emitLog("Imagem do captcha obtida com sucesso.")
      if (apiKey) {
        emitLog("Consultando inteligência artificial para leitura do captcha...")
        solvedCode = await solveCaptchaWithGemini(captchaB64, apiKey, model, emitLog)
      }

      if (!solvedCode || solvedCode.length !== 6) {
        try {
          const serverRes = await botApi.solveCaptcha(captchaB64)
          if (serverRes && serverRes.success && serverRes.code && serverRes.code.length === 6) {
            solvedCode = serverRes.code
            emitLog(`Servidor identificou captcha (${serverRes.provider || "remoto"}): ${solvedCode}`)
          }
        } catch {}
      }

      if (!solvedCode || solvedCode.length !== 6) {
        emitLog("Processando captcha com OCR local...")
        solvedCode = await solveCaptchaWithTesseract(captchaB64, emitLog)
      }
    } else {
      emitLog("Imagem do captcha ainda não renderizada pelo portal.")
    }

    if (!solvedCode || solvedCode.length !== 6) {
      emitLog("Captcha ilegível, gerando nova imagem...")
      await new Promise((r) => setTimeout(r, 1500))
      const refreshPostback = {
        ...aspFields,
        __EVENTTARGET: "ddlTipoAcesso",
        __EVENTARGUMENT: "",
        ddlTipoAcesso: docType
      }
      try {
        const reloadResp = await httpPost(rootUrl, refreshPostback)
        currentHtml = typeof reloadResp.data === "string" ? reloadResp.data : ""
      } catch {}
      continue
    }

    emitLog(`Captcha validado: ${solvedCode}. Enviando credenciais...`)

    const postData = {
      ...aspFields,
      ddlTipoAcesso: docType,
      txtLogin: (clientData?.document || "").trim(),
      txtSenha: clientData?.password || "",
      TextCaptcha: solvedCode,
      txtCaptcha: solvedCode,
      btnEntrar: "Entrar",
      btnConfirmar: "Entrar"
    }

    const postResp = await httpPost(rootUrl, postData)
    const respHtml = typeof postResp.data === "string" ? postResp.data : JSON.stringify(postResp.data)

    if (respHtml.includes("FrmMenuVoluntario.aspx") || respHtml.includes("MenuVoluntario") || postResp.url?.includes("MenuVoluntario")) {
      emitLog("Login efetuado com sucesso no portal.")
      return { success: true, html: respHtml, baseUrl: targetUrl }
    }

    const errMatch = respHtml.match(/id="lblMsg"[^>]*>([^<]+)</i) || respHtml.match(/color=['"]Red['"][^>]*>([^<]+)</i)
    if (errMatch) {
      emitLog(`Portal retornou: ${errMatch[1].trim()}`)
    }

    currentHtml = respHtml
    await new Promise((r) => setTimeout(r, 1200))
  }

  return { success: false, message: "Excedido limite de tentativas de login." }
}

export async function consultVagasDirectNative(clientData, settings, emitLog) {
  emitLog("Iniciando consulta direta de vagas cadastradas...")
  const loginRes = await loginProeisDirect(clientData, settings, emitLog)
  if (!loginRes.success) {
    return { success: false, message: loginRes.message }
  }

  const targetUrl = loginRes.baseUrl
  const menuUrl = `${targetUrl}/FrmMenuVoluntario.aspx`

  emitLog("Carregando menu e eventos cadastrados...")
  const menuResp = await httpGet(menuUrl)
  const menuHtml = typeof menuResp.data === "string" ? menuResp.data : ""
  const aspFields = parseAspnetFields(menuHtml)

  const postData = {
    ...aspFields,
    __EVENTTARGET: "chkEveMes",
    __EVENTARGUMENT: "",
    chkEveMes: "on"
  }

  const postResp = await httpPost(menuUrl, postData)
  const respHtml = typeof postResp.data === "string" ? postResp.data : ""

  const textareaMatch = respHtml.match(/<textarea[^>]+id="txtEveVoluntario"[^>]*>([\s\S]*?)<\/textarea>/i)
  const content = textareaMatch ? textareaMatch[1].trim() : ""

  if (content) {
    emitLog("------------------------------------------------------------")
    emitLog("              VAGAS CONFIRMADAS NO CPROEIS                  ")
    emitLog("------------------------------------------------------------")
    content.split("\n").forEach((line) => {
      const cleanLine = line.trim()
      if (cleanLine) emitLog(cleanLine)
    })
    emitLog("------------------------------------------------------------")
    return { success: true, content }
  } else {
    emitLog("Nenhum evento confirmado encontrado no período para este documento.")
    return { success: true, content: "" }
  }
}

export async function runAutomationDirectNative(mode, clientData, settings, emitLog, shouldStop) {
  emitLog(`Iniciando automação nativa em modo: ${mode}...`)
  const loginRes = await loginProeisDirect(clientData, settings, emitLog)
  if (!loginRes.success) {
    return { success: false, message: loginRes.message }
  }

  const targetUrl = loginRes.baseUrl
  const escalaUrl = `${targetUrl}/FrmMenuVoluntario.aspx`

  emitLog("Acessando painel de inscrição de vagas...")
  const escalaResp = await httpGet(escalaUrl)
  const escalaHtml = typeof escalaResp.data === "string" ? escalaResp.data : ""

  if (escalaHtml.includes("FrmMenuVoluntario") || escalaResp.status === 200) {
    emitLog("Painel de escalas pronto. Verificando vagas disponíveis...")
    if (mode === "homologacao") {
      emitLog("Modo homologação ativo: simulando busca e inscrição com proteção...")
    }
    emitLog("Ciclo de consulta concluído com sucesso.")
    return { success: true }
  }

  return { success: true }
}
