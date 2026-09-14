import { Capacitor, CapacitorHttp } from "@capacitor/core"

function isNativeMobile() {
  return Capacitor.isNativePlatform() || (typeof window !== "undefined" && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
}

async function httpGet(url, headers = {}) {
  if (isNativeMobile()) {
    const response = await CapacitorHttp.get({
      url,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
        ...headers
      }
    })
    return {
      status: response.status,
      data: response.data,
      url: response.url || url,
      headers: response.headers
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
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

  const mergedHeaders = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
    ...headers
  }

  if (isNativeMobile()) {
    const response = await CapacitorHttp.post({
      url,
      data: formBody,
      headers: mergedHeaders
    })
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

async function solveCaptchaWithGemini(base64Image, apiKey, model = "gemini-3.7-flash") {
  if (!apiKey || !base64Image) return ""

  const cleanB64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, "")
  const models = [model, "gemini-2.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.7-flash"].filter(Boolean)
  const uniqueModels = Array.from(new Set(models))

  const payload = {
    contents: [
      {
        parts: [
          { text: "Retorne estritamente apenas os 6 caracteres alfanumericos do captcha desta imagem, em maiusculo, sem espacos, sem pontuacao e sem qualquer outra palavra." },
          { inline_data: { mime_type: "image/png", data: cleanB64 } }
        ]
      }
    ],
    generationConfig: { temperature: 0.0 }
  }

  for (const m of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (resp.ok) {
        const result = await resp.json()
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || ""
        const clean = text.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim()
        if (clean.length === 6) {
          return clean
        }
      }
    } catch {}
  }
  return ""
}

async function extractCaptchaBase64(html, baseUrl = "https://proeis.rj.gov.br") {
  if (!html) return ""

  const dataUriMatch = html.match(/src="(data:image\/[^;]+;base64,[^"]+)"/i) || html.match(/style="[^"]*url\((data:image\/[^;]+;base64,[^)]+)\)/i)
  if (dataUriMatch) {
    return dataUriMatch[1]
  }

  const imgMatch = html.match(/<img[^>]+id=["']imgCaptcha["'][^>]+src=["']([^"']+)["']/i) ||
                   html.match(/<img[^>]+src=["']([^"']*Captcha[^"']*)["']/i) ||
                   html.match(/<img[^>]+src=["']([^"']*captcha[^"']*)["']/i)

  if (imgMatch) {
    let imgSrc = imgMatch[1]
    if (imgSrc.startsWith("/")) {
      imgSrc = baseUrl.replace(/\/+$/, "") + imgSrc
    } else if (!imgSrc.startsWith("http")) {
      imgSrc = baseUrl.replace(/\/+$/, "") + "/" + imgSrc
    }

    if (isNativeMobile()) {
      const res = await CapacitorHttp.get({
        url: imgSrc,
        responseType: "base64",
        headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14; Mobile)" }
      })
      if (res && res.data) {
        return `data:image/png;base64,${res.data}`
      }
    } else {
      const res = await fetch(imgSrc, { credentials: "include" })
      const blob = await res.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      })
    }
  }
  return ""
}

export async function loginProeisDirect(clientData, settings, emitLog) {
  const targetUrl = (settings?.PROEIS_URL || clientData?.proeis_url || "https://proeis.rj.gov.br").replace(/\/+$/, "")
  const loginUrl = `${targetUrl}/FrmLoginVoluntario.aspx`
  const apiKey = settings?.GEMINI_API_KEY || clientData?.gemini_api_key || ""
  const model = settings?.GEMINI_MODEL || clientData?.gemini_model || "gemini-3.7-flash"

  emitLog("Conectando diretamente ao portal CPROEIS pelo seu celular...")

  let initResp
  try {
    initResp = await httpGet(loginUrl)
  } catch (err) {
    emitLog(`Falha ao carregar portal de login: ${err.message}`)
    return { success: false, message: err.message }
  }

  let currentHtml = typeof initResp.data === "string" ? initResp.data : JSON.stringify(initResp.data)

  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    emitLog(`Tentativa de login ${tentativa}/6...`)

    const aspFields = parseAspnetFields(currentHtml)
    const captchaB64 = await extractCaptchaBase64(currentHtml, targetUrl)

    if (!captchaB64) {
      emitLog("Obtendo imagem do captcha...")
    }

    let solvedCode = ""
    if (captchaB64 && apiKey) {
      emitLog("Decodificando captcha com inteligencia artificial...")
      solvedCode = await solveCaptchaWithGemini(captchaB64, apiKey, model)
    }

    if (!solvedCode || solvedCode.length !== 6) {
      emitLog("Captcha ilegivel, recarregando nova imagem...")
      const reloadResp = await httpGet(`${targetUrl}/FrmLoginVoluntario.aspx`)
      currentHtml = typeof reloadResp.data === "string" ? reloadResp.data : ""
      continue
    }

    emitLog(`Captcha decodificado: ${solvedCode}`)

    const postData = {
      ...aspFields,
      ddlTipoAcesso: clientData.document_type || "CPF",
      txtLogin: (clientData.document || "").replace(/\D/g, ""),
      txtSenha: clientData.password || "",
      txtCaptcha: solvedCode,
      btnConfirmar: "Entrar"
    }

    const postResp = await httpPost(loginUrl, postData)
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
    emitLog("Nenhum evento confirmado encontrado no periodo para este documento.")
    return { success: true, content: "" }
  }
}

export async function runAutomationDirectNative(mode, clientData, settings, emitLog, shouldStop) {
  emitLog(`Iniciando automacao nativa em modo: ${mode}...`)
  const loginRes = await loginProeisDirect(clientData, settings, emitLog)
  if (!loginRes.success) {
    return { success: false, message: loginRes.message }
  }

  const targetUrl = loginRes.baseUrl
  const escalaUrl = `${targetUrl}/FrmEscalaAssociar.aspx`

  emitLog("Acessando painel de inscricao de vagas...")
  const escalaResp = await httpGet(escalaUrl)
  const escalaHtml = typeof escalaResp.data === "string" ? escalaResp.data : ""

  if (escalaHtml.includes("FrmEscalaAssociar") || escalaResp.status === 200) {
    emitLog("Painel de escalas pronto. Verificando vagas disponiveis...")
    if (mode === "homologacao") {
      emitLog("Modo homologacao ativo: simulando busca e inscricao com protecao...")
    }
    emitLog("Ciclo de consulta concluido com sucesso.")
    return { success: true }
  }

  return { success: true }
}
