// ===============================
// CONFIGURAÇÕES (WHATSAPP POR UNIDADE + PIXEL)
// ===============================
const META_PIXEL_ID = "1248570742456849";
const QUIZ_NAME = "Quiz E-FIT";

// ===============================
// TRACKING VIA BACKEND
// ===============================
// O front não grava mais direto no Supabase.
// Agora os eventos são enviados para /api/quiz-event
// e o server.js salva usando a service_role.

const WHATSAPP_BY_UNIDADE = {
  "São Caetano": "5511976970921",
  "Tatuapé": "5511976970921"
};

const DEFAULT_WHATSAPP = "5511976970921";

// Slides do carrossel
const METODO_SLIDES = [
  "./metodo-1.jpg",
  "./metodo-2.jpg",
  "./metodo-3.jpg",
  "./metodo-4.jpg",
  "./metodo-5.jpg",
  "./metodo-6.jpg"
];

// Copy fixa do resultado
const FIXED_PROMISE_TITLE = "Treino E-FIT: resultado com eficiência";
const FIXED_PROMISE_TEXT =
  "Em apenas 25 minutos, a eletroestimulação (EMS) ativa profundamente os músculos, intensifica o treino e otimiza o seu tempo, trabalhando força, resistência e definição de forma eficiente.\n\n" +
  "É tecnologia, desempenho e cuidado com o seu corpo em um método moderno, seguro e altamente eficaz para quem busca resultados reais, mesmo com a rotina corrida.";

// ===============================
// UTM CAPTURE (URL -> sessionStorage)
// ===============================
function getUTMsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    utm_term: params.get("utm_term") || ""
  };
}

function getStoredUTMs() {
  try {
    const raw = sessionStorage.getItem("efit_quiz_utms");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveUTMsToSession(utms) {
  try {
    sessionStorage.setItem("efit_quiz_utms", JSON.stringify(utms));
  } catch {}
}

function resolveUTMs() {
  const fromUrl = getUTMsFromUrl();
  const hasAny = Object.values(fromUrl).some(Boolean);

  if (hasAny) {
    saveUTMsToSession(fromUrl);
    return fromUrl;
  }

  return getStoredUTMs() || {
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: ""
  };
}

// ===============================
// ESTADO
// ===============================
const quizState = {
  currentStep: 0,
  sessionId: getOrCreateSessionId(),
  utms: resolveUTMs(),
  meta: {
    started: false,
    completed: false
  },
  steps: [],
  answers: {
    objetivo: "",
    altura_cm: "",
    peso_kg: "",
    idade: "",
    rotina: "",
    dificuldade: "",
    dor_intensidade: "",
    tempo_parado: "",
    unidade: "",
    horario: "",
    interesse: "",
    nome: "",
    whatsapp: "",
    email: ""
  }
};

// ===============================
// UI
// ===============================
const ui = {
  questionContainer: document.getElementById("questionContainer"),
  helperText: document.getElementById("helperText"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText")
};

// ===============================
// UTILITÁRIOS
// ===============================
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizePhone(value = "") {
  return String(value).replace(/\D/g, "");
}

function sanitizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizeName(value = "") {
  return String(value).trim();
}

function getFirstName(value = "") {
  return normalizeName(value).split(/\s+/).filter(Boolean)[0] || "";
}

function getLastName(value = "") {
  const parts = normalizeName(value).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return "";
  return parts.slice(1).join(" ");
}

function isValidName(name) {
  return typeof name === "string" && name.trim().length >= 2;
}

function isValidPhone(phone) {
  const digits = sanitizePhone(phone);
  return digits.length >= 10 && digits.length <= 13;
}

function isValidEmail(email) {
  const v = sanitizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidNumber(v, min, max) {
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return false;
  if (min != null && n < min) return false;
  if (max != null && n > max) return false;
  return true;
}

function getOrCreateSessionId() {
  const key = "efit_quiz_session_id";
  let id = sessionStorage.getItem(key);

  if (!id) {
    id = `efit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, id);
  }

  return id;
}

function withUTMs(params = {}) {
  const utm = quizState.utms || {};
  return {
    ...params,
    utm_source: utm.utm_source || "",
    utm_medium: utm.utm_medium || "",
    utm_campaign: utm.utm_campaign || "",
    utm_content: utm.utm_content || "",
    utm_term: utm.utm_term || ""
  };
}

function getCookie(name) {
  const value = `; ${document.cookie || ""}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(";").shift() || "";
  }
  return "";
}

function getFbclidFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("fbclid") || "";
}

function getOrCreateFbc() {
  const existingFbc = getCookie("_fbc");
  if (existingFbc) return existingFbc;

  const fbclid = getFbclidFromUrl();
  if (!fbclid) return "";

  const fbc = `fb.1.${Date.now()}.${fbclid}`;
  return fbc;
}

function getTrackingContext() {
  return {
    fbp: getCookie("_fbp") || "",
    fbc: getOrCreateFbc() || "",
    page_url: window.location.href,
    user_agent: navigator.userAgent || "",
    referrer: document.referrer || ""
  };
}

function buildEventId(eventName) {
  const safe = String(eventName || "event")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
  return `${safe}_${quizState.sessionId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ===============================
// BUILD PAYLOAD BACKEND
// ===============================
function buildSupabaseEventPayload(eventName, extra = {}) {
  const step = getCurrentStep();
  const a = quizState.answers || {};
  const utm = quizState.utms || {};
  const tracking = getTrackingContext();

  const eventId = extra.event_id || buildEventId(eventName);

  return {
    session_id: quizState.sessionId,
    external_id: quizState.sessionId,
    quiz_name: QUIZ_NAME,
    event_name: eventName,
    event_source: "web",
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),

    step_id: extra.step_id ?? step?.id ?? null,
    step_index: extra.step_index ?? (quizState.currentStep + 1),

    answer_value: extra.answer_value ?? null,
    unidade: extra.unidade ?? a.unidade ?? null,
    objetivo: extra.objetivo ?? a.objetivo ?? null,
    interesse: extra.interesse ?? a.interesse ?? null,

    nome: a.nome || null,
    whatsapp: a.whatsapp || null,
    email: a.email || null,

    utm_source: utm.utm_source || null,
    utm_medium: utm.utm_medium || null,
    utm_campaign: utm.utm_campaign || null,
    utm_content: utm.utm_content || null,
    utm_term: utm.utm_term || null,

    page_url: tracking.page_url || null,
    user_agent: tracking.user_agent || null,
    referrer: tracking.referrer || null,
    fbp: tracking.fbp || null,
    fbc: tracking.fbc || null,

    meta_event_name: extra.meta_event_name || null,
    meta_event_type: extra.meta_event_type || null,
    meta_enabled: extra.meta_enabled ?? false
  };
}

async function saveQuizEventToSupabase(eventName, extra = {}) {
  const payload = buildSupabaseEventPayload(eventName, extra);
  console.log("[Tracking payload -> backend]", eventName, payload.step_id, payload.step_index, payload.event_id);

  try {
    const response = await fetch("/api/quiz-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn(`[Tracking] erro ao enviar ${eventName} para o backend:`, result);
      return { ok: false, error: result };
    }

    console.log(`[Tracking] ${eventName} enviado via backend ✅ id=${result?.id ?? "?"}`);
    return { ok: true, id: result?.id ?? null, event_id: payload.event_id };
  } catch (err) {
    console.warn(`[Tracking] falha inesperada ao enviar ${eventName}:`, err);
    return { ok: false, error: err };
  }
}

// ===============================
// META PIXEL
// ===============================
function hasFbq() {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

function buildAdvancedMatchingPayload() {
  const nome = normalizeName(quizState.answers.nome);
  const whatsappDigits = sanitizePhone(quizState.answers.whatsapp);
  const email = sanitizeEmail(quizState.answers.email);

  const payload = { external_id: quizState.sessionId };

  const fn = getFirstName(nome);
  const ln = getLastName(nome);

  if (fn) payload.fn = fn;
  if (ln) payload.ln = ln;
  if (whatsappDigits) payload.ph = whatsappDigits;
  if (email) payload.em = email;

  return payload;
}

function applyAdvancedMatching() {
  if (!hasFbq()) return;
  try {
    window.fbq("init", META_PIXEL_ID, buildAdvancedMatchingPayload());
  } catch (err) {
    console.warn("[PIXEL] falha ao aplicar advanced matching:", err);
  }
}

function trackCustom(eventName, params = {}, eventId = null) {
  if (!hasFbq()) return;
  try {
    if (eventId) {
      window.fbq("trackCustom", eventName, withUTMs(params), { eventID: eventId });
    } else {
      window.fbq("trackCustom", eventName, withUTMs(params));
    }
  } catch (err) {
    console.warn(`[PIXEL] falha trackCustom ${eventName}:`, err);
  }
}

function trackStandard(eventName, params = {}, eventId = null) {
  if (!hasFbq()) return;
  try {
    if (eventId) {
      window.fbq("track", eventName, withUTMs(params), { eventID: eventId });
    } else {
      window.fbq("track", eventName, withUTMs(params));
    }
  } catch (err) {
    console.warn(`[PIXEL] falha track ${eventName}:`, err);
  }
}

function trackQuizStartOnce() {
  if (quizState.meta.started) return;
  quizState.meta.started = true;

  const eventId = buildEventId("QuizStart");

  trackCustom(
    "QuizStart",
    {
      quiz_name: QUIZ_NAME,
      session_id: quizState.sessionId
    },
    eventId
  );

  saveQuizEventToSupabase("QuizStart", {
    event_id: eventId,
    meta_event_name: "QuizStart",
    meta_event_type: "custom",
    meta_enabled: true,
    step_id: getCurrentStep()?.id || "objetivo",
    step_index: quizState.currentStep + 1
  });
}

function trackStepView(step) {
  if (!step) return;

  const eventId = buildEventId("QuizStepView");

  trackCustom(
    "QuizStepView",
    {
      quiz_name: QUIZ_NAME,
      session_id: quizState.sessionId,
      step_id: step.id,
      step_type: step.type,
      step_index: quizState.currentStep + 1
    },
    eventId
  );

  saveQuizEventToSupabase("QuizStepView", {
    event_id: eventId,
    meta_event_name: "QuizStepView",
    meta_event_type: "custom",
    meta_enabled: true,
    step_id: step.id,
    step_index: quizState.currentStep + 1
  });
}

function trackAnswer(step, value) {
  if (!step) return;

  const eventId = buildEventId("QuizAnswer");

  trackCustom(
    "QuizAnswer",
    {
      quiz_name: QUIZ_NAME,
      session_id: quizState.sessionId,
      step_id: step.id,
      step_index: quizState.currentStep + 1,
      answer_value: String(value || ""),
      objetivo: quizState.answers.objetivo || "",
      unidade: quizState.answers.unidade || ""
    },
    eventId
  );

  saveQuizEventToSupabase("QuizAnswer", {
    event_id: eventId,
    meta_event_name: "QuizAnswer",
    meta_event_type: "custom",
    meta_enabled: true,
    step_id: step.id,
    step_index: quizState.currentStep + 1,
    answer_value: String(value || ""),
    unidade: quizState.answers.unidade || null,
    objetivo: quizState.answers.objetivo || null
  });
}

function trackQuizCompleteOnce() {
  if (quizState.meta.completed) return;
  quizState.meta.completed = true;

  const eventId = buildEventId("QuizComplete");

  trackCustom(
    "QuizComplete",
    {
      quiz_name: QUIZ_NAME,
      session_id: quizState.sessionId,
      objetivo: quizState.answers.objetivo || "",
      unidade: quizState.answers.unidade || "",
      interesse: quizState.answers.interesse || ""
    },
    eventId
  );

  saveQuizEventToSupabase("QuizComplete", {
    event_id: eventId,
    meta_event_name: "QuizComplete",
    meta_event_type: "custom",
    meta_enabled: true,
    unidade: quizState.answers.unidade || null,
    objetivo: quizState.answers.objetivo || null,
    interesse: quizState.answers.interesse || null
  });
}

// ===============================
// FUNIL DINÂMICO
// ===============================
function buildStepsForObjective(obj) {
  const baseStart = [
    {
      id: "objetivo",
      type: "options",
      label: "🎯 OBJETIVO",
      title: "Qual seu objetivo principal hoje?",
      subtitle: "Escolha uma opção para fazermos sua avaliação.",
      field: "objetivo",
      options: [
        { value: "Emagrecimento", text: "Emagrecimento", emoji: "⚡" },
        { value: "Fortalecimento", text: "Fortalecimento / Tonificação", emoji: "💪" },
        { value: "Condicionamento", text: "Condicionamento / Mais energia", emoji: "🔥" },
        { value: "Dores/Postura", text: "Melhorar dores / postura", emoji: "🧍" },
        { value: "Retomada", text: "Voltar a treinar com segurança", emoji: "🔄" }
      ]
    }
  ];

  let specific = [];

  if (obj === "Emagrecimento") {
    specific = [
      {
        id: "altura_cm",
        type: "input_number",
        label: "📏 AVALIAÇÃO",
        title: "Qual sua altura (em cm)?",
        subtitle: "Ex.: 165",
        field: "altura_cm",
        placeholder: "Ex.: 165",
        validate: (v) => isValidNumber(v, 120, 220),
        errorMsg: "Digite uma altura válida (120 a 220 cm)."
      },
      {
        id: "peso_kg",
        type: "input_number",
        label: "⚖️ AVALIAÇÃO",
        title: "Qual seu peso (em kg)?",
        subtitle: "Ex.: 72",
        field: "peso_kg",
        placeholder: "Ex.: 72",
        validate: (v) => isValidNumber(v, 30, 250),
        errorMsg: "Digite um peso válido (30 a 250 kg)."
      },
      {
        id: "idade",
        type: "input_number",
        label: "🎂 AVALIAÇÃO",
        title: "Qual sua idade?",
        subtitle: "Ex.: 34",
        field: "idade",
        placeholder: "Ex.: 34",
        validate: (v) => isValidNumber(v, 16, 80),
        errorMsg: "Digite uma idade válida (16 a 80)."
      }
    ];
  } else if (obj === "Fortalecimento") {
    specific = [
      {
        id: "rotina",
        type: "options",
        label: "📋 AVALIAÇÃO",
        title: "Como está sua rotina de treinos hoje?",
        subtitle: "Isso ajuda a ajustar a recomendação.",
        field: "rotina",
        options: [
          { value: "Não treino atualmente", text: "Não treino atualmente", emoji: "🛋️" },
          { value: "Treino às vezes", text: "Treino às vezes", emoji: "🙂" },
          { value: "Treino com frequência", text: "Treino com frequência", emoji: "🏋️" }
        ]
      },
      {
        id: "dificuldade",
        type: "options",
        label: "🎯 AVALIAÇÃO",
        title: "Qual sua maior dificuldade hoje?",
        subtitle: "Escolha a principal.",
        field: "dificuldade",
        options: [
          { value: "Falta de tempo", text: "Falta de tempo", emoji: "⏱️" },
          { value: "Constância", text: "Constância", emoji: "📌" },
          { value: "Falta de resultado", text: "Falta de resultado", emoji: "📉" }
        ]
      }
    ];
  } else if (obj === "Condicionamento") {
    specific = [
      {
        id: "rotina",
        type: "options",
        label: "🔥 AVALIAÇÃO",
        title: "Como está sua rotina de treinos hoje?",
        subtitle: "Para ajustar a recomendação.",
        field: "rotina",
        options: [
          { value: "Não treino atualmente", text: "Não treino atualmente", emoji: "🛋️" },
          { value: "Treino às vezes", text: "Treino às vezes", emoji: "🙂" },
          { value: "Treino com frequência", text: "Treino com frequência", emoji: "🏃" }
        ]
      },
      {
        id: "dificuldade",
        type: "options",
        label: "⚡ AVALIAÇÃO",
        title: "Qual seu foco agora?",
        subtitle: "O que você quer melhorar primeiro?",
        field: "dificuldade",
        options: [
          { value: "Mais energia", text: "Mais energia no dia a dia", emoji: "🔋" },
          { value: "Resistência", text: "Resistência / condicionamento", emoji: "🔥" },
          { value: "Fôlego", text: "Fôlego", emoji: "🌬️" }
        ]
      }
    ];
  } else if (obj === "Dores/Postura") {
    specific = [
      {
        id: "dor_intensidade",
        type: "options",
        label: "🩺 AVALIAÇÃO",
        title: "Como está a intensidade do incômodo hoje?",
        subtitle: "Isso ajuda no cuidado do início.",
        field: "dor_intensidade",
        options: [
          { value: "Leve", text: "Leve", emoji: "🙂" },
          { value: "Moderada", text: "Moderada", emoji: "😐" },
          { value: "Forte", text: "Forte", emoji: "😣" }
        ]
      },
      {
        id: "rotina",
        type: "options",
        label: "📋 AVALIAÇÃO",
        title: "Você treina atualmente?",
        subtitle: "Só para ajustar a recomendação.",
        field: "rotina",
        options: [
          { value: "Não treino", text: "Não treino", emoji: "🛋️" },
          { value: "Às vezes", text: "Às vezes", emoji: "🙂" },
          { value: "Sim", text: "Sim, com frequência", emoji: "🏋️" }
        ]
      }
    ];
  } else if (obj === "Retomada") {
    specific = [
      {
        id: "tempo_parado",
        type: "options",
        label: "🔄 AVALIAÇÃO",
        title: "Há quanto tempo você está parado(a)?",
        subtitle: "Para ajustar o ritmo do retorno.",
        field: "tempo_parado",
        options: [
          { value: "0-3 meses", text: "0–3 meses", emoji: "🟢" },
          { value: "3-12 meses", text: "3–12 meses", emoji: "🟡" },
          { value: "1 ano+", text: "1 ano ou mais", emoji: "🔴" }
        ]
      },
      {
        id: "dificuldade",
        type: "options",
        label: "🎯 AVALIAÇÃO",
        title: "Qual o principal motivo de estar voltando agora?",
        subtitle: "Escolha o mais forte.",
        field: "dificuldade",
        options: [
          { value: "Saúde", text: "Saúde e bem-estar", emoji: "❤️" },
          { value: "Falta de tempo", text: "Falta de tempo", emoji: "⏱️" },
          { value: "Retomar rotina", text: "Retomar rotina", emoji: "📌" }
        ]
      }
    ];
  }

  const commonMid = [
    {
      id: "carrossel_metodo",
      type: "carousel",
      label: "📌 O MÉTODO EM 6 SLIDES",
      title: "Veja como funciona o método E-FIT (rápido)",
      subtitle: "Deslize como no Instagram. Depois continue sua avaliação.",
      helper: "Deslize para ver os slides e toque em continuar."
    },
    
    {
      id: "horario",
      type: "options",
      label: "🕒 HORÁRIO",
      title: "Se você fosse começar, qual horário seria mais confortável?",
      subtitle: "Isso ajuda a indicar um plano mais realista para a sua rotina.",
      field: "horario",
      options: [
        { value: "Manhã", text: "Manhã", emoji: "🌅" },
        { value: "Tarde", text: "Tarde", emoji: "🌤️" },
        { value: "Noite", text: "Noite", emoji: "🌙" },
        { value: "Sábado", text: "Sábado", emoji: "📅" }
      ]
    },
    {
      id: "resultado_avaliacao",
      type: "result_preview",
      label: "✅ SEU RESULTADO",
      title: "Sua avaliação ficou pronta",
      subtitle: "Veja sua recomendação e decida se quer agendar a aula experimental cortesia."
    },
    {
      id: "interesse",
      type: "options",
      label: "✅ AULA EXPERIMENTAL",
      title: "Você gostaria de agendar uma aula experimental cortesia?",
      subtitle: "Se sim, pedimos seus dados somente agora para agilizar o atendimento. Sem spam. Sem compromisso.",
      field: "interesse",
      options: [
        { value: "Sim, quero agendar", text: "Sim, quero agendar", emoji: "🎯" },
        { value: "Quero só tirar dúvidas", text: "Quero só tirar dúvidas", emoji: "💬" },
        { value: "Agora não", text: "Agora não", emoji: "⏳" }
      ]
    }
  ];

  const captureTail = [
    {
      id: "nome",
      type: "input_text",
      label: "📋 DADOS",
      title: "Qual seu nome?",
      subtitle: "Para personalizar seu atendimento.",
      field: "nome",
      placeholder: "Digite seu nome",
      validate: (v) => isValidName(v),
      errorMsg: "Digite seu nome para continuar."
    },
    {
      id: "whatsapp",
      type: "input_phone",
      label: "📱 DADOS",
      title: "Qual seu WhatsApp?",
      subtitle: "Para agilizar seu atendimento com a unidade escolhida.",
      field: "whatsapp",
      placeholder: "Ex.: (11) 99999-9999",
      validate: (v) => isValidPhone(v),
      errorMsg: "Digite um WhatsApp válido para continuar."
    },
    {
      id: "email",
      type: "input_email",
      label: "📧 DADOS",
      title: "Qual seu melhor e-mail?",
      subtitle: "Opcional, mas ajuda na continuidade do atendimento.",
      field: "email",
      placeholder: "voce@email.com (opcional)",
      optional: true
    },
    {
      id: "resultado_final",
      type: "final_cta",
      label: "✅ PRONTO",
      title: "Agora é só falar com a atendente",
      subtitle: "Seu resumo será enviado automaticamente no WhatsApp."
    }
  ];

  if (!obj) return baseStart;

  return [...baseStart, ...specific, ...commonMid, ...captureTail];
}

// ===============================
// PROGRESSO
// ===============================
function getSteps() {
  return quizState.steps;
}

function getProgressCount() {
  const steps = getSteps();
  return steps.length;
}

function updateProgress() {
  const steps = getSteps();
  const total = steps.length || 1;
  const current = Math.min(quizState.currentStep + 1, total);
  const percent = Math.round((current / total) * 100);

  ui.progressBar.style.width = `${percent}%`;
  ui.progressText.textContent = `PERGUNTA ${current} DE ${total}`;
}

// ===============================
// WHATSAPP / RESULTADOS
// ===============================
function getWhatsappNumberByUnidade() {
  const unidade = quizState.answers.unidade;
  return WHATSAPP_BY_UNIDADE[unidade] || DEFAULT_WHATSAPP;
}

function buildWhatsappMessage() {
  const a = quizState.answers;
  const nome = a.nome?.trim() || "Lead";

  let extra = "";

  if (a.objetivo === "Emagrecimento") {
    extra = `\n• Altura: ${a.altura_cm || "-"} cm\n• Peso: ${a.peso_kg || "-"} kg\n• Idade: ${a.idade || "-"}`;
  } else if (a.tempo_parado) {
    extra = `\n• Tempo parado: ${a.tempo_parado || "-"}`;
  } else if (a.dor_intensidade) {
    extra = `\n• Intensidade do incômodo: ${a.dor_intensidade || "-"}`;
  } else if (a.rotina || a.dificuldade) {
    extra = `\n• Rotina atual: ${a.rotina || "-"}\n• Principal ponto: ${a.dificuldade || "-"}`;
  }

  return `Olá! Vim pelo Quiz da E-FIT e quero atendimento.

*Resumo do meu perfil:*
• Objetivo: ${a.objetivo || "-"}${extra}
• Unidade: ${a.unidade || "-"}
• Horário preferido: ${a.horario || "-"}
• Interesse: ${a.interesse || "-"}

*Meus dados:*
• Nome: ${nome}
• WhatsApp: ${a.whatsapp || "-"}
• E-mail: ${a.email || "-"}

Quero seguir com o atendimento, por favor.`;
}

function getWhatsappUrl() {
  const text = encodeURIComponent(buildWhatsappMessage());
  const phone = getWhatsappNumberByUnidade();
  return `https://wa.me/${phone}?text=${text}`;
}

function trackLeadAndOpenWhatsApp(url) {
  applyAdvancedMatching();

  const unidade = quizState.answers.unidade || "";
  const objetivo = quizState.answers.objetivo || "";
  const interesse = quizState.answers.interesse || "";
  const destino = getWhatsappNumberByUnidade();

  const isAgendar = interesse === "Sim, quero agendar";
  const isDuvidas = interesse === "Quero só tirar dúvidas";

  let leadEventId = null;
  let whatsappEventId = null;

  if (isAgendar) {
    leadEventId = buildEventId("Lead");

    trackStandard(
      "Lead",
      {
        content_name: QUIZ_NAME,
        content_category: "Lead Qualification",
        source: "quiz_efit",
        unidade,
        objetivo,
        interesse,
        whatsapp_destino: destino,
        session_id: quizState.sessionId
      },
      leadEventId
    );

    saveQuizEventToSupabase("Lead", {
      event_id: leadEventId,
      meta_event_name: "Lead",
      meta_event_type: "standard",
      meta_enabled: true,
      unidade,
      objetivo,
      interesse,
      answer_value: "whatsapp_cta_click"
    });
  }

  if (isAgendar || isDuvidas) {
    whatsappEventId = buildEventId("WhatsAppCTA");

    trackCustom(
      "WhatsAppCTA",
      {
        quiz_name: QUIZ_NAME,
        unidade,
        objetivo,
        interesse,
        whatsapp_destino: destino,
        session_id: quizState.sessionId
      },
      whatsappEventId
    );

    saveQuizEventToSupabase("WhatsAppCTA", {
      event_id: whatsappEventId,
      meta_event_name: "WhatsAppCTA",
      meta_event_type: "custom",
      meta_enabled: true,
      unidade,
      objetivo,
      interesse,
      answer_value: destino
    });
  }

  setTimeout(() => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, 280);
}

// ===============================
// CÁLCULOS (Emagrecimento: IMC)
// ===============================
function calcBMI(alturaCm, pesoKg) {
  const h = Number(alturaCm) / 100;
  const w = Number(pesoKg);

  if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0) return null;
  return w / (h * h);
}

function bmiLabel(bmi) {
  if (bmi == null) return { label: "Indicativo", note: "Dados insuficientes." };
  if (bmi < 18.5) return { label: "Abaixo do recomendado", note: "Um ajuste de estratégia pode ajudar." };
  if (bmi < 25) return { label: "Faixa saudável", note: "Boa base — dá pra evoluir com consistência." };
  if (bmi < 30) return { label: "Acima do recomendado", note: "Há espaço para reduzir medidas com constância." };
  return { label: "Atenção ao perfil", note: "Um plano eficiente pode ajudar com segurança e acompanhamento." };
}

function bmiToPercent(bmi) {
  const min = 16;
  const max = 35;
  const v = Math.max(min, Math.min(max, bmi || min));
  return ((v - min) / (max - min)) * 100;
}

// ===============================
// RENDER / TRANSIÇÃO
// ===============================
function transitionContent(renderFn) {
  const container = ui.questionContainer;
  container.classList.remove("fade-enter", "fade-enter-active", "fade-exit", "fade-exit-active");
  container.classList.add("fade-exit");

  requestAnimationFrame(() => {
    container.classList.add("fade-exit-active");

    setTimeout(() => {
      renderFn();
      container.classList.remove("fade-exit", "fade-exit-active");
      container.classList.add("fade-enter");
      requestAnimationFrame(() => container.classList.add("fade-enter-active"));
    }, 150);
  });
}

function getCurrentStep() {
  return getSteps()[quizState.currentStep] || null;
}

function renderStep() {
  const steps = getSteps();
  const step = steps[quizState.currentStep];
  if (!step) return;

  updateProgress();
  ui.helperText.textContent = step.helper || "Toque para continuar.";

  transitionContent(() => {
    if (step.type === "options") renderOptionsStep(step);
    else if (step.type === "info") renderInfoStep(step);
    else if (step.type === "carousel") renderCarouselStep(step);
    else if (step.type === "result_preview") renderResultPreview(step);
    else if (step.type === "final_cta") renderFinalCTA(step);
    else if (step.type.startsWith("input_")) renderInputStep(step);
  });

  trackStepView(step);
}

function renderInfoStep(step) {
  const bulletsHtml = (step.content?.bullets || [])
    .map((item) => `<div class="info-bullet">• ${escapeHtml(item)}</div>`)
    .join("");

  ui.questionContainer.innerHTML = `
    <div class="question-badge">${escapeHtml(step.label || "ℹ️ INFORMAÇÃO")}</div>
    <h2 class="question-title">${escapeHtml(step.title)}</h2>
    <p class="question-subtitle">${escapeHtml(step.subtitle || "")}</p>

    <div class="info-card">
      <p>${escapeHtml(step.content?.text || "")}</p>
      <div class="info-bullets">${bulletsHtml}</div>
    </div>

    <div class="actions-row" style="margin-top:14px;">
      ${quizState.currentStep > 0 ? `<button class="btn btn-secondary" id="btnBack">Voltar</button>` : ""}
      <button class="btn btn-primary" id="btnNext">Continuar</button>
    </div>
  `;

  document.getElementById("btnBack")?.addEventListener("click", () => goBack());
  document.getElementById("btnNext")?.addEventListener("click", () => {
    trackQuizStartOnce();
    trackAnswer(step, "continue");
    goNext();
  });
}

function renderOptionsStep(step) {
  const currentValue = quizState.answers[step.field] || "";

  const optionsHtml = step.options
    .map((opt) => `
      <button class="option-btn ${currentValue === opt.value ? "selected" : ""}" data-value="${escapeHtml(opt.value)}">
        <span class="option-emoji">${escapeHtml(opt.emoji || "•")}</span>
        <span>${escapeHtml(opt.text)}</span>
      </button>
    `)
    .join("");

  ui.questionContainer.innerHTML = `
    <div class="question-badge">${escapeHtml(step.label || "📋 PERGUNTA")}</div>
    <h2 class="question-title">${escapeHtml(step.title)}</h2>
    <p class="question-subtitle">${escapeHtml(step.subtitle || "")}</p>

    <div class="options-list">${optionsHtml}</div>

    <div class="actions-row" style="margin-top:14px;">
      ${quizState.currentStep > 0 ? `<button class="btn btn-secondary" id="btnBack">Voltar</button>` : ""}
    </div>
  `;

  document.querySelectorAll(".option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      trackQuizStartOnce();

      const value = btn.getAttribute("data-value");
      if (!value) return;

      document.querySelectorAll(".option-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");

      quizState.answers[step.field] = value;
      trackAnswer(step, value);

      if (step.id === "objetivo") {
        quizState.steps = buildStepsForObjective(value);
      }

      if (step.id === "interesse" && value === "Agora não") {
        const targetIndex = quizState.steps.findIndex((s) => s.id === "resultado_final");
        if (targetIndex >= 0) {
          setTimeout(() => {
            quizState.currentStep = targetIndex;
            renderStep();
          }, 200);
          return;
        }
      }

      setTimeout(() => goNext(), 220);
    });
  });

  document.getElementById("btnBack")?.addEventListener("click", () => goBack());
}

function renderInputStep(step) {
  const currentValue = quizState.answers[step.field] || "";

  let inputType = "text";
  let inputMode = "text";

  if (step.type === "input_number") {
    inputType = "text";
    inputMode = "numeric";
  }
  if (step.type === "input_phone") {
    inputType = "text";
    inputMode = "tel";
  }
  if (step.type === "input_email") {
    inputType = "email";
    inputMode = "email";
  }

  ui.questionContainer.innerHTML = `
    <div class="question-badge">${escapeHtml(step.label || "📋 PERGUNTA")}</div>
    <h2 class="question-title">${escapeHtml(step.title)}</h2>
    <p class="question-subtitle">${escapeHtml(step.subtitle || "")}</p>

    <div class="input-wrap">
      <input
        id="textInput"
        class="text-input"
        type="${inputType}"
        inputmode="${inputMode}"
        placeholder="${escapeHtml(step.placeholder || "")}"
        value="${escapeHtml(currentValue)}"
        autocomplete="off"
      />

      <div class="actions-row">
        ${quizState.currentStep > 0 ? `<button class="btn btn-secondary" id="btnBack">Voltar</button>` : ""}
        <button class="btn btn-primary" id="btnNext">Continuar</button>
      </div>
    </div>
  `;

  const input = document.getElementById("textInput");
  const btnNext = document.getElementById("btnNext");
  const btnBack = document.getElementById("btnBack");

  input?.focus();

  if (step.type === "input_phone") {
    input.addEventListener("input", (e) => {
      let digits = e.target.value.replace(/\D/g, "").slice(0, 13);

      if (digits.length <= 10) {
        digits = digits.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) => {
          let out = "";
          if (a) out += `(${a}`;
          if (a.length === 2) out += ") ";
          if (b) out += b;
          if (c) out += `-${c}`;
          return out;
        });
      } else {
        digits = digits.replace(/^(\d{0,2})(\d{0,5})(\d{0,4}).*/, (_, a, b, c) => {
          let out = "";
          if (a) out += `(${a}`;
          if (a.length === 2) out += ") ";
          if (b) out += b;
          if (c) out += `-${c}`;
          return out;
        });
      }

      e.target.value = digits;
    });
  }

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnNext?.click();
    }
  });

  btnBack?.addEventListener("click", () => goBack());

  btnNext?.addEventListener("click", () => {
    trackQuizStartOnce();

    const raw = (input?.value || "").trim();
    let value = raw;

    if (step.type === "input_email" && step.optional && !raw) {
      quizState.answers[step.field] = "";
      trackAnswer(step, "skipped");
      goNext();
      return;
    }

    if (step.type === "input_number") {
      if (!step.validate?.(raw)) {
        alert(step.errorMsg || "Valor inválido.");
        input?.focus();
        return;
      }
      value = raw.replace(",", ".");
    }

    if (step.type === "input_text") {
      if (!step.validate?.(raw)) {
        alert(step.errorMsg || "Valor inválido.");
        input?.focus();
        return;
      }
      value = normalizeName(raw);
    }

    if (step.type === "input_phone") {
      if (!step.validate?.(raw)) {
        alert(step.errorMsg || "WhatsApp inválido.");
        input?.focus();
        return;
      }
      value = raw;
    }

    if (step.type === "input_email") {
      if (raw && !isValidEmail(raw)) {
        alert("Digite um e-mail válido ou deixe vazio.");
        input?.focus();
        return;
      }
      value = raw ? sanitizeEmail(raw) : "";
    }

    quizState.answers[step.field] = value;

    if (["nome", "whatsapp", "email"].includes(step.field)) {
      applyAdvancedMatching();
    }

    trackAnswer(step, value);
    goNext();
  });
}

function renderCarouselStep(step) {
  const educationViewEventId = buildEventId("EducationView");

  saveQuizEventToSupabase("EducationView", {
    event_id: educationViewEventId,
    meta_event_name: "EducationView",
    meta_event_type: "custom",
    meta_enabled: true,
    step_id: step.id,
    step_index: quizState.currentStep + 1
  });

  const slidesHtml = METODO_SLIDES
    .map(
      (src, idx) => `
        <div class="ig-slide ${idx === 0 ? "active" : ""}" data-idx="${idx}">
          <img src="${src}" alt="Método E-FIT ${idx + 1}" />
        </div>
      `
    )
    .join("");

  const dotsHtml = METODO_SLIDES
    .map((_, idx) => `<div class="ig-dot ${idx === 0 ? "active" : ""}" data-idx="${idx}"></div>`)
    .join("");

  ui.questionContainer.innerHTML = `
    <div class="question-badge">${escapeHtml(step.label)}</div>
    <h2 class="question-title">${escapeHtml(step.title)}</h2>
    <p class="question-subtitle">${escapeHtml(step.subtitle || "")}</p>

    <div class="ig-card" id="igCard">
      <div class="ig-header">
        <div class="mono">E-FIT • Método EMS</div>
        <div class="ig-counter" id="igCounter">1/6</div>
      </div>

      <div class="ig-viewport" id="igViewport">
        ${slidesHtml}
        <button class="ig-nav-btn ig-nav-left" id="igPrev" aria-label="Anterior">‹</button>
        <button class="ig-nav-btn ig-nav-right" id="igNext" aria-label="Próximo">›</button>
      </div>

      <div class="ig-dots" id="igDots">${dotsHtml}</div>

      <div class="ig-actions">
        <button class="btn btn-primary" id="btnContinue">Continuar avaliação</button>
      </div>
    </div>

    <div class="actions-row" style="margin-top:14px;">
      ${quizState.currentStep > 0 ? `<button class="btn btn-secondary" id="btnBack">Voltar</button>` : ""}
    </div>
  `;

  let active = 0;
  const total = METODO_SLIDES.length;

  const viewport = document.getElementById("igViewport");
  const counter = document.getElementById("igCounter");
  const slides = Array.from(document.querySelectorAll(".ig-slide"));
  const dots = Array.from(document.querySelectorAll(".ig-dot"));

  function setActive(i, reason = "nav") {
    active = (i + total) % total;
    slides.forEach((s) => s.classList.remove("active"));
    dots.forEach((d) => d.classList.remove("active"));
    slides[active].classList.add("active");
    dots[active].classList.add("active");
    counter.textContent = `${active + 1}/${total}`;

    const slideEventId = buildEventId("EducationSlideView");

    trackCustom(
      "EducationSlideView",
      {
        quiz_name: QUIZ_NAME,
        session_id: quizState.sessionId,
        slide_index: active + 1,
        slide_total: total,
        reason
      },
      slideEventId
    );

    saveQuizEventToSupabase("EducationSlideView", {
      event_id: slideEventId,
      meta_event_name: "EducationSlideView",
      meta_event_type: "custom",
      meta_enabled: true,
      step_id: step.id,
      step_index: quizState.currentStep + 1,
      answer_value: `slide_${active + 1}_${reason}`
    });
  }

  document.getElementById("igPrev")?.addEventListener("click", () => setActive(active - 1, "prev"));
  document.getElementById("igNext")?.addEventListener("click", () => setActive(active + 1, "next"));
  dots.forEach((d) => d.addEventListener("click", () => setActive(Number(d.dataset.idx || 0), "dot")));

  let startX = 0;
  let dragging = false;

  viewport?.addEventListener(
    "touchstart",
    (e) => {
      dragging = true;
      startX = e.touches[0].clientX;
    },
    { passive: true }
  );

  viewport?.addEventListener(
    "touchend",
    (e) => {
      if (!dragging) return;
      dragging = false;
      const endX = e.changedTouches[0].clientX;
      const diff = endX - startX;
      if (Math.abs(diff) < 35) return;

      if (diff < 0) setActive(active + 1, "swipe_next");
      else setActive(active - 1, "swipe_prev");
    },
    { passive: true }
  );

  document.getElementById("btnContinue")?.addEventListener("click", () => {
    trackAnswer(step, "continue");
    goNext();
  });

  document.getElementById("btnBack")?.addEventListener("click", () => goBack());
}

function renderResultPreview(step) {
  const a = quizState.answers;

  let title = "";
  let note = "";
  let percent = 50;

  if (a.objetivo === "Emagrecimento") {
    const bmi = calcBMI(a.altura_cm, a.peso_kg);
    const info = bmiLabel(bmi);
    title = `Indicativo atual: ${info.label}`;
    note = info.note + (bmi ? ` (IMC aprox.: ${bmi.toFixed(1)})` : "");
    percent = bmiToPercent(bmi);
  } else {
    title = `Recomendação inicial para: ${a.objetivo || "seu objetivo"}`;
    note =
      "Com base nas suas respostas, o melhor caminho é começar com consistência e acompanhamento, ajustando o treino ao seu momento.";
    percent = 62;
  }

  ui.questionContainer.innerHTML = `
    <div class="question-badge">${escapeHtml(step.label)}</div>
    <h2 class="question-title">${escapeHtml(step.title)}</h2>
    <p class="question-subtitle">${escapeHtml(step.subtitle || "")}</p>

    <div class="result-meter">
      <h3 class="meter-title">${escapeHtml(title)}</h3>
      <p class="meter-sub">${escapeHtml(note)}</p>

      <div class="meter-bar">
        <div class="meter-pin" style="left:${Math.max(2, Math.min(98, percent))}%;"></div>
      </div>

      <div class="meter-labels">
        <span>Mais atenção</span>
        <span>Saudável</span>
        <span>Excelente base</span>
      </div>

      <div class="fixed-promise">
        <h4>${escapeHtml(FIXED_PROMISE_TITLE)}</h4>
        <p>${escapeHtml(FIXED_PROMISE_TEXT).replaceAll("\n", "<br>")}</p>
      </div>

      <div class="actions-row" style="margin-top:14px;">
        <button class="btn btn-secondary" id="btnBack">Voltar</button>
        <button class="btn btn-primary" id="btnNext">Continuar</button>
      </div>
    </div>
  `;

  document.getElementById("btnBack")?.addEventListener("click", () => goBack());
  document.getElementById("btnNext")?.addEventListener("click", () => {
    trackAnswer(step, "continue");
    goNext();
  });
}

function renderFinalCTA(step) {
  ui.helperText.textContent = "Pronto. Clique para falar com a atendente.";

  const a = quizState.answers;
  const waUrl = getWhatsappUrl();

  trackQuizCompleteOnce();
  applyAdvancedMatching();

  const showCTA = a.interesse !== "Agora não";

  ui.questionContainer.innerHTML = `
    <div class="question-badge">${escapeHtml(step.label)}</div>
    <h2 class="question-title">${escapeHtml(step.title)}</h2>
    <p class="question-subtitle">${escapeHtml(step.subtitle || "")}</p>

    <div class="result-box">
      <div class="result-summary">
        <div><strong>Objetivo:</strong> ${escapeHtml(a.objetivo || "-")}</div>
        ${a.objetivo === "Emagrecimento" ? `
          <div><strong>Altura:</strong> ${escapeHtml(a.altura_cm || "-")} cm</div>
          <div><strong>Peso:</strong> ${escapeHtml(a.peso_kg || "-")} kg</div>
          <div><strong>Idade:</strong> ${escapeHtml(a.idade || "-")}</div>
        ` : ""}
        ${a.rotina ? `<div><strong>Rotina atual:</strong> ${escapeHtml(a.rotina)}</div>` : ""}
        ${a.dificuldade ? `<div><strong>Ponto principal:</strong> ${escapeHtml(a.dificuldade)}</div>` : ""}
        ${a.dor_intensidade ? `<div><strong>Intensidade da dor:</strong> ${escapeHtml(a.dor_intensidade)}</div>` : ""}
        ${a.tempo_parado ? `<div><strong>Tempo parado:</strong> ${escapeHtml(a.tempo_parado)}</div>` : ""}
        <div><strong>Unidade:</strong> ${escapeHtml(a.unidade || "-")}</div>
        <div><strong>Horário preferido:</strong> ${escapeHtml(a.horario || "-")}</div>
        <div><strong>Interesse:</strong> ${escapeHtml(a.interesse || "-")}</div>
        <div><strong>Nome:</strong> ${escapeHtml(a.nome || "-")}</div>
        <div><strong>WhatsApp:</strong> ${escapeHtml(a.whatsapp || "-")}</div>
        <div><strong>E-mail:</strong> ${escapeHtml(a.email || "-")}</div>
      </div>

      ${
        showCTA
          ? `
        <p style="margin-top:10px;">Clique abaixo para falar com a <strong>Atendente E-FIT</strong> da unidade <strong>${escapeHtml(a.unidade || "selecionada")}</strong>.</p>
        <div class="cta-buttons">
          <a class="btn-whatsapp" href="${waUrl}" id="btnWhatsappCTA" target="_blank" rel="noopener noreferrer">
            💬 Falar com Atendente E-FIT no WhatsApp
          </a>
          <a class="btn-restart" href="#" id="btnRestart">Refazer avaliação</a>
        </div>
      `
          : `
        <p style="margin-top:10px;">Sem problemas. Se quiser, você pode refazer a avaliação quando quiser.</p>
        <div class="cta-buttons">
          <a class="btn-restart" href="#" id="btnRestart">Refazer avaliação</a>
        </div>
      `
      }
    </div>
  `;

  document.getElementById("btnRestart")?.addEventListener("click", (e) => {
    e.preventDefault();
    resetQuiz();
  });

  document.getElementById("btnWhatsappCTA")?.addEventListener("click", (e) => {
    e.preventDefault();
    trackLeadAndOpenWhatsApp(waUrl);
  });
}

// ===============================
// NAVEGAÇÃO
// ===============================
function goNext() {
  const steps = getSteps();
  if (quizState.currentStep < steps.length - 1) {
    quizState.currentStep += 1;
    renderStep();
  }
}

function goBack() {
  if (quizState.currentStep > 0) {
    quizState.currentStep -= 1;
    renderStep();
  }
}

function resetQuiz() {
  sessionStorage.removeItem("efit_quiz_session_id");

  quizState.currentStep = 0;
  quizState.meta.started = false;
  quizState.meta.completed = false;
  quizState.sessionId = getOrCreateSessionId();
  quizState.utms = resolveUTMs();
  quizState.answers = {
    objetivo: "",
    altura_cm: "",
    peso_kg: "",
    idade: "",
    rotina: "",
    dificuldade: "",
    dor_intensidade: "",
    tempo_parado: "",
    unidade: "",
    horario: "",
    interesse: "",
    nome: "",
    whatsapp: "",
    email: ""
  };

  quizState.steps = buildStepsForObjective("");
  renderStep();
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  console.log("[PIXEL] fbq existe?", typeof window.fbq);
  console.log("UTMs capturadas:", quizState.utms);
  console.log("[TRACKING] session_id:", quizState.sessionId);
  console.log("[TRACKING] fbp/fbc:", getTrackingContext());

  trackCustom("DebugLoaded", { session_id: quizState.sessionId }, buildEventId("DebugLoaded"));

  quizState.steps = buildStepsForObjective("");
  renderStep();
});
