// ===============================
// CONFIGURAÇÕES (WHATSAPP POR UNIDADE + PIXEL)
// ===============================
const META_PIXEL_ID = "1248570742456849";

// ===============================
// SUPABASE (FRONT TRACKING)
// ===============================
const SUPABASE_URL = "https://tzhaeriqeczeypnihuko.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gDN0g8kBRUHFUFi_I44cPg_xny5g_Su";
const SUPABASE_TABLE_EVENTS = "quiz_events";

let supabaseClient = null;

function initSupabaseClient() {
  try {
    if (!window.supabase || !window.supabase.createClient) {
      console.warn("Supabase JS não carregado.");
      return null;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY ||
        SUPABASE_URL.includes("COLE_SUA_SUPABASE_URL_AQUI") ||
        SUPABASE_ANON_KEY.includes("COLE_SUA_SUPABASE_ANON_KEY_AQUI")) {
      console.warn("Supabase não configurado ainda (URL/ANON KEY).");
      return null;
    }

    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    return supabaseClient;
  } catch (err) {
    console.warn("Falha ao iniciar Supabase client:", err);
    return null;
  }
}

const WHATSAPP_BY_UNIDADE = {
  "São Caetano": "5511976970921", // <-- TROCAR depois
  "Tatuapé": "5511976970921"      // <-- TROCAR depois
};

const DEFAULT_WHATSAPP = "5511999999999"; // fallback


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
  } catch (e) {
    console.warn("Não foi possível salvar UTMs no sessionStorage:", e);
  }
}

function resolveUTMs() {
  const fromUrl = getUTMsFromUrl();
  const hasAnyUtmInUrl = Object.values(fromUrl).some(Boolean);

  if (hasAnyUtmInUrl) {
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
  answers: {
    nome: "",
    objetivo: "",
    unidade: "",
    rotina: "",
    restricoes: "",
    horario: "",
    interesse: "",
    whatsapp: "",
    email: ""
  }
};

// Fluxo principal (agora com WhatsApp + E-mail separados)
const steps = [
  {
    id: "nome",
    type: "input",
    label: "📋 PERGUNTA",
    title: "Qual seu nome?",
    subtitle: "Vamos começar para personalizar seu atendimento.",
    placeholder: "Digite seu nome",
    field: "nome",
    helper: "Digite seu nome para continuar."
  },
  {
    id: "objetivo",
    type: "options",
    label: "📋 PERGUNTA",
    title: "Qual seu objetivo principal hoje?",
    subtitle: "Isso ajuda a E-FIT a indicar o melhor caminho para você.",
    field: "objetivo",
    options: [
      { value: "Emagrecimento", text: "Emagrecimento", emoji: "⚡" },
      { value: "Fortalecimento", text: "Fortalecimento / Tonificação", emoji: "💪" },
      { value: "Condicionamento", text: "Condicionamento / Mais energia", emoji: "🔥" },
      { value: "Dores/Postura", text: "Melhorar dores / postura", emoji: "🧍" },
      { value: "Retomada", text: "Voltar a treinar com segurança", emoji: "🔄" }
    ]
  },
  {
    id: "unidade",
    type: "options",
    label: "📍 UNIDADE",
    title: "Qual unidade você tem interesse?",
    subtitle: "Assim sua solicitação já chega para a atendente certa.",
    field: "unidade",
    options: [
      { value: "São Caetano", text: "São Caetano", emoji: "🏙️" },
      { value: "Tatuapé", text: "Tatuapé", emoji: "📍" }
    ]
  },
  {
    id: "info_ems",
    type: "info",
    label: "ℹ️ COMO FUNCIONA",
    title: "Treino personalizado com tecnologia EMS",
    subtitle: "Entenda de forma rápida como funciona na E-FIT.",
    helper: "Toque em continuar.",
    content: {
      text: "Na E-FIT, o treino é personalizado e potencializado pela eletroestimulação muscular (EMS), ajudando a otimizar resultados com acompanhamento profissional.",
      bullets: [
        "Apoio para objetivos como emagrecimento, fortalecimento e condicionamento",
        "Treino ajustado conforme objetivo e possíveis restrições",
        "Método com foco em eficiência e consistência"
      ]
    }
  },
  {
    id: "rotina",
    type: "options",
    label: "📋 PERFIL",
    title: "Como está sua rotina de treinos hoje?",
    subtitle: "Isso ajuda a equipe a te atender no nível certo.",
    field: "rotina",
    options: [
      { value: "Não treino atualmente", text: "Não treino atualmente", emoji: "🛋️" },
      { value: "Treino às vezes", text: "Treino às vezes", emoji: "🙂" },
      { value: "Treino com frequência", text: "Já treino com frequência", emoji: "🏋️" }
    ]
  },
  {
    id: "restricoes",
    type: "options",
    label: "🩺 CUIDADOS",
    title: "Você tem alguma restrição ou cuidado físico hoje?",
    subtitle: "Essa informação ajuda no atendimento com mais segurança.",
    field: "restricoes",
    options: [
      { value: "Sem restrições", text: "Sem restrições", emoji: "✅" },
      { value: "Dor lombar/postura", text: "Dor lombar / postura", emoji: "🧍" },
      { value: "Joelho/articulações", text: "Joelho / articulações", emoji: "🦵" },
      { value: "Prefiro informar no atendimento", text: "Prefiro informar no atendimento", emoji: "💬" }
    ]
  },
  {
    id: "info_aula",
    type: "info",
    label: "⏱️ AULA E ROTINA",
    title: "Como funciona a experiência E-FIT",
    subtitle: "Estrutura pensada para atendimento próximo e treino eficiente.",
    helper: "Toque em continuar.",
    content: {
      text: "As aulas são rápidas, com acompanhamento e organização de horários para facilitar sua rotina.",
      bullets: [
        "Aulas de 25 minutos",
        "Atendimento com poucos alunos por horário",
        "Treino funcional com EMS",
        "Horários de segunda a sábado (agendamentos em janelas)"
      ]
    }
  },
  {
    id: "horario",
    type: "options",
    label: "🕒 DISPONIBILIDADE",
    title: "Qual período você prefere para treinar?",
    subtitle: "Isso acelera o agendamento da sua aula experimental.",
    field: "horario",
    options: [
      { value: "Manhã", text: "Manhã", emoji: "🌅" },
      { value: "Tarde", text: "Tarde", emoji: "🌤️" },
      { value: "Noite", text: "Noite", emoji: "🌙" },
      { value: "Sábado pela manhã", text: "Sábado pela manhã", emoji: "📅" }
    ]
  },
  {
    id: "interesse",
    type: "options",
    label: "✅ PRÓXIMO PASSO",
    title: "Você quer agendar aula experimental cortesia?",
    subtitle: "Ou prefere tirar dúvidas com a atendente antes.",
    field: "interesse",
    options: [
      { value: "Quero agendar aula experimental", text: "Quero agendar aula experimental", emoji: "🎯" },
      { value: "Quero tirar dúvidas antes", text: "Quero tirar dúvidas antes", emoji: "💬" }
    ]
  },
  {
    id: "whatsapp",
    type: "input",
    label: "📱 CONTATO",
    title: "Qual seu WhatsApp?",
    subtitle: "Vamos deixar seu atendimento mais rápido para a equipe.",
    placeholder: "Ex.: (11) 99999-9999",
    field: "whatsapp",
    helper: "Digite um WhatsApp válido para continuar."
  },
  {
    id: "email",
    type: "input",
    label: "📧 CONTATO",
    title: "Qual seu melhor e-mail?",
    subtitle: "Usamos para identificação e continuidade do atendimento.",
    placeholder: "voce@email.com",
    field: "email",
    helper: "Digite um e-mail válido para continuar."
  },
  {
    id: "resultado",
    type: "result"
  }
];

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

function isValidName(name) {
  return typeof name === "string" && name.trim().length >= 2;
}

function isValidPhone(phone) {
  const digits = sanitizePhone(phone);
  // Aceita BR com/sem DDI
  return digits.length >= 10 && digits.length <= 13;
}

function isValidEmail(email) {
  const v = sanitizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
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

function getProgressCount() {
  return steps.filter(s => s.id !== "resultado").length;
}

function getCurrentProgressIndex(stepIndex) {
  const total = getProgressCount();
  const currentStep = steps[stepIndex];

  if (!currentStep || currentStep.id === "resultado") return total;

  const visibleSteps = steps.filter(s => s.id !== "resultado");
  const visibleIndex = visibleSteps.findIndex(s => s.id === currentStep.id);
  return Math.max(visibleIndex + 1, 1);
}

function updateProgress() {
  const total = getProgressCount();
  const current = getCurrentProgressIndex(quizState.currentStep);
  const percent = Math.round((current / total) * 100);

  ui.progressBar.style.width = `${percent}%`;

  const currentStep = steps[quizState.currentStep];
  if (currentStep && currentStep.id === "resultado") {
    ui.progressText.textContent = "RESULTADO FINAL";
  } else {
    ui.progressText.textContent = `PERGUNTA ${current} DE ${total}`;
  }
}

// ===============================
// META PIXEL (TRACKING + ADV MATCH)
// ===============================
function hasFbq() {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

function buildAdvancedMatchingPayload() {
  const nome = normalizeName(quizState.answers.nome);
  const whatsappDigits = sanitizePhone(quizState.answers.whatsapp);
  const email = sanitizeEmail(quizState.answers.email);

  const payload = {
    external_id: quizState.sessionId
  };

  // fn = first name (quando existir)
  const fn = getFirstName(nome);
  if (fn) payload.fn = fn;

  // ph = telefone (quando existir)
  if (whatsappDigits) payload.ph = whatsappDigits;

  // em = email (quando existir)
  if (email) payload.em = email;

  return payload;
}

function applyAdvancedMatching() {
  if (!hasFbq()) return;

  const userData = buildAdvancedMatchingPayload();

  // Re-init com advanced matching (prática comum em fluxos de formulário)
  // Sem problema se repetir — o Meta agrupa no pixel carregado.
  try {
    window.fbq("init", META_PIXEL_ID, userData);
  } catch (err) {
    console.warn("Falha ao aplicar advanced matching:", err);
  }
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


// ===============================
// SUPABASE EVENT TRACKING
// ===============================
function buildSupabaseEventPayload(eventName, extra = {}) {
  const step = getCurrentStep();
  const a = quizState.answers || {};
  const utm = quizState.utms || {};

  return {
    session_id: quizState.sessionId,
    quiz_name: "Quiz E-FIT",

    event_name: eventName,
    event_source: "web",

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

    page_url: window.location.href,
    user_agent: navigator.userAgent
  };
}

async function saveQuizEventToSupabase(eventName, extra = {}) {
  const client = initSupabaseClient();
  if (!client) return;

  const payload = buildSupabaseEventPayload(eventName, extra);

  try {
    const { error } = await client
      .from(SUPABASE_TABLE_EVENTS)
      .insert([payload]);

    if (error) {
      console.warn(`Erro ao salvar evento ${eventName} no Supabase:`, error);
    }
  } catch (err) {
    console.warn(`Falha inesperada ao salvar ${eventName} no Supabase:`, err);
  }
}

function trackCustom(eventName, params = {}) {
  if (!hasFbq()) return;
  try {
    window.fbq("trackCustom", eventName, withUTMs(params));
  } catch (err) {
    console.warn(`Falha no trackCustom ${eventName}:`, err);
  }
}

function trackStandard(eventName, params = {}) {
  if (!hasFbq()) return;
  try {
    window.fbq("track", eventName, withUTMs(params));
  } catch (err) {
    console.warn(`Falha no track ${eventName}:`, err);
  }
}

function getCurrentStep() {
  return steps[quizState.currentStep] || null;
}

function trackQuizStartOnce() {
  if (quizState.meta.started) return;
  quizState.meta.started = true;

  trackCustom("QuizStart", {
    quiz_name: "Quiz E-FIT",
    session_id: quizState.sessionId
  });
}

function trackStepView(step) {
  if (!step) return;

  trackCustom("QuizStepView", {
    quiz_name: "Quiz E-FIT",
    session_id: quizState.sessionId,
    step_id: step.id,
    step_type: step.type,
    step_index: quizState.currentStep + 1
  });

  saveQuizEventToSupabase("QuizStepView", {
    step_id: step.id,
    step_index: quizState.currentStep + 1
  });
}

function trackAnswer(step, value) {
  if (!step) return;

  trackCustom("QuizAnswer", {
    quiz_name: "Quiz E-FIT",
    session_id: quizState.sessionId,
    step_id: step.id,
    step_index: quizState.currentStep + 1,
    answer_value: String(value || ""),
    unidade: quizState.answers.unidade || "",
    objetivo: quizState.answers.objetivo || ""
  });

  saveQuizEventToSupabase("QuizAnswer", {
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

  trackCustom("QuizComplete", {
    quiz_name: "Quiz E-FIT",
    session_id: quizState.sessionId,
    unidade: quizState.answers.unidade || "",
    objetivo: quizState.answers.objetivo || "",
    interesse: quizState.answers.interesse || ""
  });
}

saveQuizEventToSupabase("QuizComplete", {
  unidade: quizState.answers.unidade || null,
  objetivo: quizState.answers.objetivo || null,
  interesse: quizState.answers.interesse || null
});

// ===============================
// NEGÓCIO / WHATSAPP
// ===============================
function objectiveMessage(objetivo) {
  switch (objetivo) {
    case "Emagrecimento":
      return {
        title: "Seu foco está em emagrecimento com eficiência",
        text: "A E-FIT pode te atender com um plano de treino personalizado, buscando constância e praticidade na rotina, com acompanhamento profissional."
      };
    case "Fortalecimento":
      return {
        title: "Seu foco está em fortalecimento / tonificação",
        text: "Com avaliação inicial e treino ajustado ao seu nível, a equipe pode indicar uma rotina mais alinhada ao seu objetivo de fortalecimento muscular e definição."
      };
    case "Condicionamento":
      return {
        title: "Seu foco está em condicionamento e energia",
        text: "A E-FIT pode te ajudar a melhorar disposição e condicionamento com treinos curtos e organizados, facilitando a consistência no dia a dia."
      };
    case "Dores/Postura":
      return {
        title: "Seu foco está em suporte para dores / postura",
        text: "A equipe pode avaliar seu caso e orientar um início com acompanhamento e adaptação de treino, respeitando seu momento e seus cuidados."
      };
    case "Retomada":
      return {
        title: "Seu foco está em retomada com segurança",
        text: "A E-FIT pode te ajudar a voltar aos treinos de forma orientada, com progressão e acompanhamento conforme sua rotina atual."
      };
    default:
      return {
        title: "Seu atendimento está quase pronto",
        text: "Com base nas suas respostas, a equipe E-FIT poderá orientar o melhor próximo passo para começar."
      };
  }
}

function getWhatsappNumberByUnidade() {
  const unidade = quizState.answers.unidade;
  return WHATSAPP_BY_UNIDADE[unidade] || DEFAULT_WHATSAPP;
}

function buildWhatsappMessage() {
  const a = quizState.answers;
  const nome = a.nome?.trim() || "Lead";

  return `Olá! Vim pelo Quiz da E-FIT e quero atendimento.

*Resumo do meu perfil:*
• Nome: ${nome}
• Objetivo: ${a.objetivo || "-"}
• Unidade de interesse: ${a.unidade || "-"}
• Rotina atual: ${a.rotina || "-"}
• Restrições/cuidados: ${a.restricoes || "-"}
• Período preferido: ${a.horario || "-"}
• Interesse: ${a.interesse || "-"}
• WhatsApp: ${a.whatsapp || "-"}
• E-mail: ${a.email || "-"}

Quero falar com a atendente E-FIT para seguir com o atendimento.`;
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

  // Evento padrão de lead (Meta)
    trackStandard("Lead", {
    content_name: "Quiz E-FIT",
    content_category: "Lead Qualification",
    source: "quiz_efit",
    unidade,
    objetivo,
    interesse,
    whatsapp_destino: destino,
    session_id: quizState.sessionId
  });

  trackCustom("WhatsAppCTA", {
    quiz_name: "Quiz E-FIT",
    unidade,
    objetivo,
    interesse,
    whatsapp_destino: destino,
    session_id: quizState.sessionId
  });

  saveQuizEventToSupabase("Lead", {
    unidade,
    objetivo,
    interesse,
    answer_value: "whatsapp_cta_click"
  });

  saveQuizEventToSupabase("WhatsAppCTA", {
    unidade,
    objetivo,
    interesse,
    answer_value: destino
  });

  // Delay curto para garantir envio do evento antes de abrir wa.me
  setTimeout(() => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, 280);
}

// ===============================
// RENDER
// ===============================
function renderStep() {
  updateProgress();

  const step = steps[quizState.currentStep];
  if (!step) return;

  ui.helperText.textContent = step.helper || "Toque em uma das opções para continuar.";

  transitionContent(() => {
    if (step.type === "input") renderInputStep(step);
    else if (step.type === "options") renderOptionsStep(step);
    else if (step.type === "info") renderInfoStep(step);
    else if (step.type === "result") renderResultStep();
  });

  // Tracking de visualização de etapa
  trackStepView(step);
}

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

      requestAnimationFrame(() => {
        container.classList.add("fade-enter-active");
      });
    }, 150);
  });
}

function renderInputStep(step) {
  const currentValue = quizState.answers[step.field] || "";
  const inputMode = step.field === "whatsapp" ? "tel" : step.field === "email" ? "email" : "text";

  ui.questionContainer.innerHTML = `
    <div class="question-badge">${escapeHtml(step.label || "📋 PERGUNTA")}</div>
    <h2 class="question-title">${escapeHtml(step.title)}</h2>
    <p class="question-subtitle">${escapeHtml(step.subtitle || "")}</p>

    <div class="input-wrap">
      <input
        id="textInput"
        class="text-input"
        type="${step.field === "email" ? "email" : "text"}"
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

  if (input) {
    input.focus();

    if (step.field === "whatsapp") {
      input.addEventListener("input", (e) => {
        let digits = e.target.value.replace(/\D/g, "").slice(0, 13);

        // Máscara BR simples
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

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btnNext?.click();
      }
    });
  }

  btnBack?.addEventListener("click", () => goBack());

  btnNext?.addEventListener("click", () => {
    trackQuizStartOnce();

    const rawValue = (input?.value || "").trim();
    let value = rawValue;

    if (step.field === "nome") {
      if (!isValidName(rawValue)) {
        alert("Por favor, digite seu nome para continuar.");
        input?.focus();
        return;
      }
      value = normalizeName(rawValue);
    }

    if (step.field === "whatsapp") {
      if (!isValidPhone(rawValue)) {
        alert("Digite um WhatsApp válido para continuar.");
        input?.focus();
        return;
      }
      value = rawValue;
    }

    if (step.field === "email") {
      if (!isValidEmail(rawValue)) {
        alert("Digite um e-mail válido para continuar.");
        input?.focus();
        return;
      }
      value = sanitizeEmail(rawValue);
    }

    quizState.answers[step.field] = value;

    // Se acabou de coletar nome/telefone/email, aplica advanced matching
    if (["nome", "whatsapp", "email"].includes(step.field)) {
      applyAdvancedMatching();
    }

    trackAnswer(step, value);
    goNext();
  });
}

function renderOptionsStep(step) {
  const currentValue = quizState.answers[step.field] || "";

  const optionsHtml = step.options.map((opt) => `
    <button class="option-btn ${currentValue === opt.value ? "selected" : ""}" data-value="${escapeHtml(opt.value)}">
      <span class="option-emoji">${escapeHtml(opt.emoji || "•")}</span>
      <span>${escapeHtml(opt.text)}</span>
    </button>
  `).join("");

  ui.questionContainer.innerHTML = `
    <div class="question-badge">${escapeHtml(step.label || "📋 PERGUNTA")}</div>
    <h2 class="question-title">${escapeHtml(step.title)}</h2>
    <p class="question-subtitle">${escapeHtml(step.subtitle || "")}</p>

    <div class="options-list">${optionsHtml}</div>

    <div class="actions-row" style="margin-top: 14px;">
      ${quizState.currentStep > 0 ? `<button class="btn btn-secondary" id="btnBack">Voltar</button>` : ""}
    </div>
  `;

  document.querySelectorAll(".option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      trackQuizStartOnce();

      const value = btn.getAttribute("data-value");
      if (!value) return;

      document.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      quizState.answers[step.field] = value;
      trackAnswer(step, value);

      setTimeout(() => goNext(), 220);
    });
  });

  document.getElementById("btnBack")?.addEventListener("click", () => goBack());
}

function renderInfoStep(step) {
  const bulletsHtml = (step.content?.bullets || [])
    .map(item => `<div class="info-bullet">• ${escapeHtml(item)}</div>`)
    .join("");

  ui.questionContainer.innerHTML = `
    <div class="question-badge">${escapeHtml(step.label || "ℹ️ INFORMAÇÃO")}</div>
    <h2 class="question-title">${escapeHtml(step.title)}</h2>
    <p class="question-subtitle">${escapeHtml(step.subtitle || "")}</p>

    <div class="info-card">
      <p>${escapeHtml(step.content?.text || "")}</p>
      <div class="info-bullets">${bulletsHtml}</div>
    </div>

    <div class="actions-row" style="margin-top: 14px;">
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

function renderResultStep() {
  ui.helperText.textContent = "Pronto! Seu atendimento está preparado.";

  const a = quizState.answers;
  const objMsg = objectiveMessage(a.objetivo);
  const waUrl = getWhatsappUrl();

  trackQuizCompleteOnce();
  applyAdvancedMatching();

  ui.questionContainer.innerHTML = `
    <div class="question-badge">✅ RESULTADO</div>
    <h2 class="question-title">Perfeito, ${escapeHtml((a.nome || "você").split(" ")[0])}!</h2>
    <p class="question-subtitle">Com base nas suas respostas, já deixamos seu atendimento muito mais rápido para a equipe E-FIT.</p>

    <div class="result-box">
      <h3>${escapeHtml(objMsg.title)}</h3>
      <p>${escapeHtml(objMsg.text)}</p>

      <div class="result-summary">
        <div><strong>Objetivo:</strong> ${escapeHtml(a.objetivo || "-")}</div>
        <div><strong>Unidade:</strong> ${escapeHtml(a.unidade || "-")}</div>
        <div><strong>Rotina atual:</strong> ${escapeHtml(a.rotina || "-")}</div>
        <div><strong>Restrições/cuidados:</strong> ${escapeHtml(a.restricoes || "-")}</div>
        <div><strong>Período preferido:</strong> ${escapeHtml(a.horario || "-")}</div>
        <div><strong>Interesse:</strong> ${escapeHtml(a.interesse || "-")}</div>
        <div><strong>WhatsApp:</strong> ${escapeHtml(a.whatsapp || "-")}</div>
        <div><strong>E-mail:</strong> ${escapeHtml(a.email || "-")}</div>
      </div>

      <p>
        Clique no botão abaixo para falar com a <strong>Atendente E-FIT</strong> da unidade
        <strong>${escapeHtml(a.unidade || "selecionada")}</strong> no WhatsApp.
      </p>

      <div class="cta-buttons">
        <a class="btn-whatsapp" href="${waUrl}" id="btnWhatsappCTA" target="_blank" rel="noopener noreferrer">
          💬 Falar com Atendente E-FIT no WhatsApp
        </a>
        <a class="btn-restart" href="#" id="btnRestart">Refazer avaliação</a>
      </div>
    </div>
  `;

  document.getElementById("btnRestart")?.addEventListener("click", (e) => {
    e.preventDefault();
    resetQuiz();
  });

  // Intercepta clique para garantir Lead antes de abrir o WhatsApp
  document.getElementById("btnWhatsappCTA")?.addEventListener("click", (e) => {
    e.preventDefault();
    trackLeadAndOpenWhatsApp(waUrl);
  });
}

// ===============================
// NAVEGAÇÃO
// ===============================
function goNext() {
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
  quizState.currentStep = 0;
  quizState.meta.started = false;
  quizState.meta.completed = false;
  quizState.sessionId = getOrCreateSessionId();
  quizState.answers = {
    nome: "",
    objetivo: "",
    unidade: "",
    rotina: "",
    restricoes: "",
    horario: "",
    interesse: "",
    whatsapp: "",
    email: ""
  };
  renderStep();
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  console.log("UTMs capturadas:", quizState.utms);
  renderStep();
  console.log("Supabase client:", initSupabaseClient() ? "OK" : "NÃO CONFIGURADO");

});
