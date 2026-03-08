require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// CONFIG
// ===============================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const META_PIXEL_ID = process.env.META_PIXEL_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || "";

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL não definida no .env");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_ANON_KEY) não definida no .env");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===============================
// MIDDLEWARES
// ===============================
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ===============================
// PÁGINAS
// ===============================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// ===============================
// HELPERS GERAIS
// ===============================
function toNullableString(value) {
  if (value == null) return null;
  const str = String(value).trim();
  return str ? str : null;
}

function toNullableInteger(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function normalizeEmail(value) {
  const str = toNullableString(value);
  return str ? str.toLowerCase() : null;
}

function normalizePhone(value) {
  const str = toNullableString(value);
  if (!str) return null;
  const digits = str.replace(/\D/g, "");
  return digits || null;
}

function normalizeName(value) {
  const str = toNullableString(value);
  return str ? str.replace(/\s+/g, " ").trim() : null;
}

function normalizeLower(value) {
  const str = toNullableString(value);
  return str ? str.toLowerCase() : null;
}

function getFirstName(value) {
  const name = normalizeName(value);
  if (!name) return null;
  return name.split(" ").filter(Boolean)[0] || null;
}

function getLastName(value) {
  const name = normalizeName(value);
  if (!name) return null;
  const parts = name.split(" ").filter(Boolean);
  if (parts.length <= 1) return null;
  return parts.slice(1).join(" ");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }

  const xrip = req.headers["x-real-ip"];
  if (typeof xrip === "string" && xrip.trim()) {
    return xrip.trim();
  }

  return req.socket?.remoteAddress || null;
}

function isMissingColumnError(error) {
  const msg = String(error?.message || "").toLowerCase();

  return (
    msg.includes("column") &&
    (msg.includes("does not exist") ||
      msg.includes("schema cache") ||
      msg.includes("could not find"))
  );
}

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function removeNullish(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value == null || value === "") continue;
    out[key] = value;
  }
  return out;
}

function mapLeadStatusToMetaEvent(status) {
  switch (status) {
    case "agendado":
      return "Schedule";
    case "compareceu":
      return "TrialAttendance";
    case "fechado":
      return "Purchase";
    default:
      return null;
  }
}

function getDateFilterFromRequest(req) {
  const startDate = toNullableString(req.query?.start_date);
  const endDate = toNullableString(req.query?.end_date);

  return {
    startDate,
    endDate
  };
}

function applyDateRange(query, columnName, dateFilter) {
  if (dateFilter?.startDate) {
    query = query.gte(columnName, `${dateFilter.startDate}T00:00:00`);
  }

  if (dateFilter?.endDate) {
    query = query.lte(columnName, `${dateFilter.endDate}T23:59:59.999`);
  }

  return query;
}

// ===============================
// DASHBOARD HELPERS
// ===============================
async function fetchQuizEvents(dateFilter = {}) {
  let query = supabase
    .from("quiz_events")
    .select(`
      session_id,
      event_name,
      step_id,
      step_index,
      answer_value,
      unidade,
      objetivo,
      interesse,
      utm_campaign,
      created_at
    `)
    .eq("quiz_name", "Quiz E-FIT");

  query = applyDateRange(query, "created_at", dateFilter);
  query = query.order("created_at", { ascending: true });

  const { data, error } = await query;

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function buildSessionMap(events) {
  const sessions = new Map();

  for (const ev of events) {
    const sid = ev.session_id;
    if (!sid) continue;

    if (!sessions.has(sid)) {
      sessions.set(sid, {
        session_id: sid,
        events: [],
        started: false,
        completed: false,
        lead: false,
        objetivo: null,
        unidade: null,
        utm_campaign: null,
        interesse: null
      });
    }

    const s = sessions.get(sid);
    s.events.push(ev);

    if (ev.event_name === "QuizStart") s.started = true;
    if (ev.event_name === "QuizComplete") s.completed = true;
    if (ev.event_name === "Lead" || ev.event_name === "WhatsAppCTA") s.lead = true;

    if (!s.objetivo && ev.objetivo) s.objetivo = ev.objetivo;
    if (!s.unidade && ev.unidade) s.unidade = ev.unidade;
    if (!s.utm_campaign && ev.utm_campaign) s.utm_campaign = ev.utm_campaign;
    if (!s.interesse && ev.interesse) s.interesse = ev.interesse;

    if (!s.objetivo && ev.step_id === "objetivo" && ev.answer_value) s.objetivo = ev.answer_value;
    if (!s.unidade && ev.step_id === "unidade" && ev.answer_value) s.unidade = ev.answer_value;
    if (!s.interesse && ev.step_id === "interesse" && ev.answer_value) s.interesse = ev.answer_value;
  }

  return sessions;
}

function getAllRelevantSteps() {
  return [
    "intro",
    "objetivo",
    "altura_cm",
    "peso_kg",
    "idade",
    "rotina",
    "dificuldade",
    "dor_intensidade",
    "tempo_parado",
    "carrossel_metodo",
    "unidade",
    "horario",
    "resultado_avaliacao",
    "interesse",
    "nome",
    "whatsapp",
    "email",
    "resultado_final"
  ];
}

function getExpectedStepsForSession(session) {
  const objetivo = session.objetivo;
  const base = ["intro", "objetivo"];

  if (objetivo === "Emagrecimento") {
    return [...base, "altura_cm", "peso_kg", "idade", "carrossel_metodo", "unidade", "horario", "resultado_avaliacao", "interesse", "nome", "whatsapp", "email", "resultado_final"];
  }

  if (objetivo === "Fortalecimento" || objetivo === "Condicionamento") {
    return [...base, "rotina", "dificuldade", "carrossel_metodo", "unidade", "horario", "resultado_avaliacao", "interesse", "nome", "whatsapp", "email", "resultado_final"];
  }

  if (objetivo === "Dores/Postura") {
    return [...base, "dor_intensidade", "rotina", "carrossel_metodo", "unidade", "horario", "resultado_avaliacao", "interesse", "nome", "whatsapp", "email", "resultado_final"];
  }

  if (objetivo === "Retomada") {
    return [...base, "tempo_parado", "dificuldade", "carrossel_metodo", "unidade", "horario", "resultado_avaliacao", "interesse", "nome", "whatsapp", "email", "resultado_final"];
  }

  return base;
}

function buildSummary(events, sessionsMap) {
  const sessions = Array.from(sessionsMap.values());
  const startedSessions = sessions.filter((s) => s.started);
  const completedSessions = sessions.filter((s) => s.completed);
  const leadSessions = sessions.filter((s) => s.lead);

  const totalSessions = startedSessions.length;
  const completed = completedSessions.length;
  const leads = leadSessions.length;

  return {
    sessions_started: totalSessions,
    quiz_completed: completed,
    leads,
    completion_rate: totalSessions ? (completed / totalSessions) * 100 : 0,
    lead_rate: totalSessions ? (leads / totalSessions) * 100 : 0,
    total_events: events.length
  };
}

function buildStepsData(events, sessionsMap) {
  const steps = getAllRelevantSteps();
  const stepViewsMap = new Map();
  const stepAnswersMap = new Map();

  for (const step of steps) {
    stepViewsMap.set(step, new Set());
    stepAnswersMap.set(step, new Set());
  }

  for (const ev of events) {
    if (!ev.step_id) continue;

    if (!stepViewsMap.has(ev.step_id)) stepViewsMap.set(ev.step_id, new Set());
    if (!stepAnswersMap.has(ev.step_id)) stepAnswersMap.set(ev.step_id, new Set());

    if (ev.event_name === "QuizStepView") {
      stepViewsMap.get(ev.step_id).add(ev.session_id);
    }

    if (
      ev.event_name === "QuizAnswer" ||
      ev.event_name === "QuizComplete" ||
      ev.event_name === "Lead" ||
      ev.event_name === "WhatsAppCTA"
    ) {
      stepAnswersMap.get(ev.step_id).add(ev.session_id);
    }
  }

  const rows = [];

  for (const step of steps) {
    const views = stepViewsMap.get(step)?.size || 0;
    const answers = stepAnswersMap.get(step)?.size || 0;

    let expectedSessions = 0;
    for (const session of sessionsMap.values()) {
      const expectedSteps = getExpectedStepsForSession(session);
      if (expectedSteps.includes(step)) expectedSessions += 1;
    }

    const baseline = Math.max(views, expectedSessions);
    const dropoffs = Math.max(baseline - answers, 0);
    const dropoffRate = baseline > 0 ? (dropoffs / baseline) * 100 : 0;

    rows.push({
      step_id: step,
      step_views: views,
      step_answers: answers,
      drop_offs: dropoffs,
      dropoff_rate: dropoffRate
    });
  }

  return rows.filter((row) => row.step_views > 0 || row.step_answers > 0);
}

function buildGoalsData(sessionsMap) {
  const grouped = new Map();

  for (const s of sessionsMap.values()) {
    if (!s.started) continue;
    const key = s.objetivo || "Não identificado";

    if (!grouped.has(key)) {
      grouped.set(key, { objetivo: key, sessions_started: 0, quiz_completed: 0, leads: 0 });
    }

    const row = grouped.get(key);
    row.sessions_started += 1;
    if (s.completed) row.quiz_completed += 1;
    if (s.lead) row.leads += 1;
  }

  return Array.from(grouped.values()).sort((a, b) => b.leads - a.leads);
}

function buildCampaignsData(sessionsMap) {
  const grouped = new Map();

  for (const s of sessionsMap.values()) {
    if (!s.started) continue;
    const key = s.utm_campaign || "Sem campanha";

    if (!grouped.has(key)) {
      grouped.set(key, { utm_campaign: key, sessions_started: 0, quiz_completed: 0, leads: 0 });
    }

    const row = grouped.get(key);
    row.sessions_started += 1;
    if (s.completed) row.quiz_completed += 1;
    if (s.lead) row.leads += 1;
  }

  return Array.from(grouped.values()).sort((a, b) => b.leads - a.leads);
}

function buildUnitsData(sessionsMap) {
  const grouped = new Map();

  for (const s of sessionsMap.values()) {
    if (!s.started) continue;
    const key = s.unidade || "Sem unidade";

    if (!grouped.has(key)) {
      grouped.set(key, { unidade: key, sessions_started: 0, quiz_completed: 0, leads: 0 });
    }

    const row = grouped.get(key);
    row.sessions_started += 1;
    if (s.completed) row.quiz_completed += 1;
    if (s.lead) row.leads += 1;
  }

  return Array.from(grouped.values()).sort((a, b) => b.leads - a.leads);
}

// ===============================
// EVENT / LEAD BUILDERS
// ===============================
function buildBaseQuizEventRow(payload, req) {
  return {
    session_id: toNullableString(payload.session_id),
    quiz_name: toNullableString(payload.quiz_name) || "Quiz E-FIT",
    event_name: toNullableString(payload.event_name),
    event_source: toNullableString(payload.event_source) || "web",

    step_id: toNullableString(payload.step_id),
    step_index: toNullableInteger(payload.step_index),
    answer_value: toNullableString(payload.answer_value),

    unidade: toNullableString(payload.unidade),
    objetivo: toNullableString(payload.objetivo),
    interesse: toNullableString(payload.interesse),

    nome: normalizeName(payload.nome),
    whatsapp: normalizePhone(payload.whatsapp),
    email: normalizeEmail(payload.email),

    utm_source: toNullableString(payload.utm_source),
    utm_medium: toNullableString(payload.utm_medium),
    utm_campaign: toNullableString(payload.utm_campaign),
    utm_content: toNullableString(payload.utm_content),
    utm_term: toNullableString(payload.utm_term),

    page_url: toNullableString(payload.page_url),
    user_agent: toNullableString(payload.user_agent) || toNullableString(req.headers["user-agent"])
  };
}

function buildExtendedQuizEventRow(payload, req) {
  const base = buildBaseQuizEventRow(payload, req);

  return {
    ...base,
    event_id: toNullableString(payload.event_id),
    external_id: toNullableString(payload.external_id),
    event_time: payload.event_time ?? null,

    fbp: toNullableString(payload.fbp),
    fbc: toNullableString(payload.fbc),
    referrer: toNullableString(payload.referrer),
    ip_address: toNullableString(payload.ip_address) || getClientIp(req),

    meta_event_name: toNullableString(payload.meta_event_name),
    meta_event_type: toNullableString(payload.meta_event_type),
    meta_enabled: typeof payload.meta_enabled === "boolean" ? payload.meta_enabled : false
  };
}

function calculateLeadScore(payload) {
  let score = 0;

  if (normalizeName(payload.nome)) score += 10;
  if (normalizePhone(payload.whatsapp)) score += 20;
  if (normalizeEmail(payload.email)) score += 20;
  if (toNullableString(payload.objetivo)) score += 10;
  if (toNullableString(payload.unidade)) score += 10;
  if (toNullableString(payload.interesse)) score += 10;
  if (payload.event_name === "Lead") score += 20;

  return score;
}

function buildLeadStatus(payload, leadScore) {
  if (payload.event_name === "Lead" && leadScore >= 70) return "qualified";
  if (payload.event_name === "Lead") return "lead";
  return "raw";
}

function buildQuizLeadRow(payload) {
  const leadScore = calculateLeadScore(payload);
  const leadStatus = buildLeadStatus(payload, leadScore);

  return {
    session_id: toNullableString(payload.session_id),
    external_id: toNullableString(payload.external_id) || toNullableString(payload.session_id),

    nome: normalizeName(payload.nome),
    email: normalizeEmail(payload.email),
    whatsapp: normalizePhone(payload.whatsapp),

    cidade: toNullableString(payload.cidade),
    estado: toNullableString(payload.estado),
    unidade: toNullableString(payload.unidade),
    objetivo: toNullableString(payload.objetivo),
    interesse: toNullableString(payload.interesse),

    utm_source: toNullableString(payload.utm_source),
    utm_medium: toNullableString(payload.utm_medium),
    utm_campaign: toNullableString(payload.utm_campaign),
    utm_content: toNullableString(payload.utm_content),
    utm_term: toNullableString(payload.utm_term),

    fbp: toNullableString(payload.fbp),
    fbc: toNullableString(payload.fbc),

    lead_score: leadScore,
    lead_status: leadStatus,
    qualified_at: leadStatus === "qualified" ? new Date().toISOString() : null,
    meta_last_event_name: toNullableString(payload.meta_event_name) || toNullableString(payload.event_name)
  };
}

function shouldUpsertLead(payload) {
  return Boolean(
    payload &&
    payload.session_id &&
    (
      payload.event_name === "Lead" ||
      normalizeName(payload.nome) ||
      normalizePhone(payload.whatsapp) ||
      normalizeEmail(payload.email)
    )
  );
}

function shouldSendToMeta(payload) {
  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) return false;
  if (!payload?.meta_enabled) return false;
  if (!payload?.meta_event_name) return false;

  return [
    "Lead",
    "QuizComplete",
    "WhatsAppCTA",
    "Schedule",
    "TrialAttendance",
    "Purchase"
  ].includes(payload.meta_event_name);
}

function mapToMetaEventName(payload) {
  const metaName = toNullableString(payload.meta_event_name);
  if (!metaName) return null;

  if (metaName === "QuizComplete") return "CompleteRegistration";
  if (metaName === "WhatsAppCTA") return "Contact";
  return metaName;
}

function buildMetaUserData(payload, req) {
  const nome = normalizeName(payload.nome);
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.whatsapp);

  const firstName = getFirstName(nome);
  const lastName = getLastName(nome);

  const unidade = toNullableString(payload.unidade);

  let cidade = normalizeLower(payload.cidade);
  let estado = normalizeLower(payload.estado);

  if (!cidade || !estado) {
    if (unidade === "Tatuapé") {
      cidade = "sao paulo";
      estado = "sp";
    } else if (unidade === "São Caetano") {
      cidade = "sao caetano do sul";
      estado = "sp";
    }
  }

  const country = "br";
  const externalId = toNullableString(payload.external_id) || toNullableString(payload.session_id);

  const userData = {
    client_ip_address: toNullableString(payload.ip_address) || getClientIp(req),
    client_user_agent: toNullableString(payload.user_agent) || toNullableString(req.headers["user-agent"]),
    fbp: toNullableString(payload.fbp),
    fbc: toNullableString(payload.fbc)
  };

  if (email) userData.em = [sha256(email)];
  if (phone) userData.ph = [sha256(phone)];
  if (firstName) userData.fn = [sha256(normalizeLower(firstName))];
  if (lastName) userData.ln = [sha256(normalizeLower(lastName))];
  if (cidade) userData.ct = [sha256(cidade)];
  if (estado) userData.st = [sha256(estado)];
  if (country) userData.country = [sha256(country)];
  if (externalId) userData.external_id = [sha256(externalId)];

  Object.keys(userData).forEach((key) => {
    if (userData[key] == null || userData[key] === "") {
      delete userData[key];
    }
  });

  return userData;
}

function buildMetaCustomData(payload) {
  const eventName = mapToMetaEventName(payload);
  const customData = {
    quiz_name: toNullableString(payload.quiz_name) || "Quiz E-FIT",
    objetivo: toNullableString(payload.objetivo),
    unidade: toNullableString(payload.unidade),
    interesse: toNullableString(payload.interesse),
    step_id: toNullableString(payload.step_id),
    step_index: toNullableInteger(payload.step_index),
    answer_value: toNullableString(payload.answer_value),
    lead_score: payload.lead_score != null ? Number(payload.lead_score) : calculateLeadScore(payload),
    utm_source: toNullableString(payload.utm_source),
    utm_medium: toNullableString(payload.utm_medium),
    utm_campaign: toNullableString(payload.utm_campaign),
    utm_content: toNullableString(payload.utm_content),
    utm_term: toNullableString(payload.utm_term)
  };

  if (eventName === "Purchase") {
    customData.currency = "BRL";
    customData.value = Number(payload.valor_fechado || 0);
  }

  return customData;
}

function buildMetaPayload(payload, req) {
  const metaEventName = mapToMetaEventName(payload);
  const eventId = toNullableString(payload.event_id);
  const pageUrl = toNullableString(payload.page_url) || "http://localhost:3000/";

  const body = {
    data: [
      {
        event_name: metaEventName,
        event_time: Number(payload.event_time) || Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: pageUrl,
        user_data: buildMetaUserData(payload, req),
        custom_data: removeNullish(buildMetaCustomData(payload))
      }
    ]
  };

  if (META_TEST_EVENT_CODE) {
    body.test_event_code = META_TEST_EVENT_CODE;
  }

  return body;
}

function buildOfflineEventId(prefix, lead) {
  return `${prefix}_${lead.session_id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ===============================
// SUPABASE WRITES
// ===============================
async function insertQuizEvent(payload, req) {
  const extendedRow = buildExtendedQuizEventRow(payload, req);

  let result = await supabase
    .from("quiz_events")
    .insert([extendedRow])
    .select("id, event_name")
    .single();

  if (!result.error) {
    return { mode: "extended", data: result.data };
  }

  if (!isMissingColumnError(result.error)) {
    throw result.error;
  }

  console.warn("[quiz-event] fallback para schema legacy:", result.error.message);

  const legacyRow = buildBaseQuizEventRow(payload, req);

  result = await supabase
    .from("quiz_events")
    .insert([legacyRow])
    .select("id, event_name")
    .single();

  if (result.error) throw result.error;

  return { mode: "legacy", data: result.data };
}

async function upsertQuizLead(payload) {
  if (!shouldUpsertLead(payload)) return null;

  const row = buildQuizLeadRow(payload);

  const { data, error } = await supabase
    .from("quiz_leads")
    .upsert([row], { onConflict: "session_id" })
    .select("id, session_id, lead_status, lead_score")
    .single();

  if (error) {
    console.warn("[quiz-leads] falha ao upsert:", error.message);
    return null;
  }

  return data;
}

async function insertMetaEventLog(row) {
  const { error } = await supabase.from("meta_event_logs").insert([row]);
  if (error) {
    console.warn("[meta_event_logs] falha ao salvar log:", error.message);
  }
}

async function sendEventToMeta(payload, req) {
  if (!shouldSendToMeta(payload)) {
    return {
      skipped: true,
      reason: "Evento não elegível para envio à Meta"
    };
  }

  const requestPayload = buildMetaPayload(payload, req);
  const url = `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestPayload)
    });

    const responseText = await response.text();
    const responseBody = safeJsonParse(responseText, { raw: responseText });

    await insertMetaEventLog({
      event_id: toNullableString(payload.event_id),
      session_id: toNullableString(payload.session_id),
      event_name: mapToMetaEventName(payload),
      request_payload: requestPayload,
      response_status: response.status,
      response_body: responseBody,
      success: response.ok
    });

    if (!response.ok) {
      return {
        skipped: false,
        ok: false,
        status: response.status,
        body: responseBody
      };
    }

    return {
      skipped: false,
      ok: true,
      status: response.status,
      body: responseBody
    };
  } catch (error) {
    await insertMetaEventLog({
      event_id: toNullableString(payload.event_id),
      session_id: toNullableString(payload.session_id),
      event_name: mapToMetaEventName(payload),
      request_payload: requestPayload,
      response_status: 0,
      response_body: { error: error.message || "Erro desconhecido" },
      success: false
    });

    return {
      skipped: false,
      ok: false,
      status: 0,
      body: { error: error.message || "Erro desconhecido" }
    };
  }
}

// ===============================
// LEADS POST-ATTENDANCE
// ===============================
async function fetchDashboardLeads(dateFilter = {}) {
  let query = supabase
    .from("quiz_leads")
    .select("*");

  query = applyDateRange(query, "created_at", dateFilter);
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function getLeadById(leadId) {
  const { data, error } = await supabase
    .from("quiz_leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (error) throw error;
  return data;
}

function buildStatusUpdateFields(newStatus, payload = {}) {
  const nowIso = new Date().toISOString();
  const fields = {
    lead_status: newStatus
  };

  if (newStatus === "agendado") {
    fields.agendado_em = nowIso;
  }

  if (newStatus === "compareceu") {
    fields.compareceu_em = nowIso;
  }

  if (newStatus === "fechado") {
    fields.fechou_em = nowIso;
    fields.valor_fechado = payload.valor_fechado != null ? Number(payload.valor_fechado || 0) : 0;
  }

  if (payload.observacao_status != null) {
    fields.observacao_status = toNullableString(payload.observacao_status);
  }

  return fields;
}

async function updateLeadStatusInDb(leadId, newStatus, payload = {}) {
  const updateFields = buildStatusUpdateFields(newStatus, payload);

  const { data, error } = await supabase
    .from("quiz_leads")
    .update(updateFields)
    .eq("id", leadId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

function buildOfflineMetaPayloadFromLead(lead, newStatus) {
  const metaEventName = mapLeadStatusToMetaEvent(newStatus);
  if (!metaEventName) return null;

  return {
    session_id: lead.session_id,
    external_id: lead.external_id || lead.session_id,
    quiz_name: "Quiz E-FIT",
    event_name: metaEventName,
    event_source: "server",
    event_id: buildOfflineEventId(metaEventName.toLowerCase(), lead),
    event_time: Math.floor(Date.now() / 1000),

    unidade: lead.unidade,
    objetivo: lead.objetivo,
    interesse: lead.interesse,
    nome: lead.nome,
    whatsapp: lead.whatsapp,
    email: lead.email,
    cidade: lead.cidade,
    estado: lead.estado,

    utm_source: lead.utm_source,
    utm_medium: lead.utm_medium,
    utm_campaign: lead.utm_campaign,
    utm_content: lead.utm_content,
    utm_term: lead.utm_term,

    page_url: "http://localhost:3000/",
    user_agent: "dashboard-manual-update",
    ip_address: null,
    fbp: lead.fbp,
    fbc: lead.fbc,

    meta_event_name: metaEventName,
    meta_event_type: metaEventName === "Purchase" ? "standard" : "custom",
    meta_enabled: true,

    lead_score: lead.lead_score,
    valor_fechado: lead.valor_fechado || 0
  };
}

// ===============================
// API TRACKING
// ===============================
app.post("/api/quiz-event", async (req, res) => {
  try {
    const payload = req.body || {};

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ ok: false, error: "Payload inválido" });
    }

    const session_id = toNullableString(payload.session_id);
    const event_name = toNullableString(payload.event_name);

    if (!session_id) {
      return res.status(400).json({ ok: false, error: "session_id é obrigatório" });
    }

    if (!event_name) {
      return res.status(400).json({ ok: false, error: "event_name é obrigatório" });
    }

    const insertResult = await insertQuizEvent(payload, req);
    const leadResult = await upsertQuizLead(payload);
    const metaResult = await sendEventToMeta(payload, req);

    return res.json({
      ok: true,
      id: insertResult.data?.id || null,
      event_name: insertResult.data?.event_name || event_name,
      event_id: toNullableString(payload.event_id),
      schema_mode: insertResult.mode,
      lead_upserted: Boolean(leadResult),
      meta: metaResult
    });
  } catch (error) {
    console.error("Erro inesperado /api/quiz-event:", error);

    return res.status(500).json({
      ok: false,
      error: "Erro interno ao salvar evento",
      details: error?.message || null
    });
  }
});

// ===============================
// API DASHBOARD
// ===============================
app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const dateFilter = getDateFilterFromRequest(req);
    const events = await fetchQuizEvents(dateFilter);
    const sessionsMap = buildSessionMap(events);
    const summary = buildSummary(events, sessionsMap);
    res.json([summary]);
  } catch (error) {
    console.error("Erro /api/dashboard/summary:", error);
    res.status(500).json({ error: "Erro ao carregar summary" });
  }
});

app.get("/api/dashboard/steps", async (req, res) => {
  try {
    const dateFilter = getDateFilterFromRequest(req);
    const events = await fetchQuizEvents(dateFilter);
    const sessionsMap = buildSessionMap(events);
    const steps = buildStepsData(events, sessionsMap);
    res.json(steps);
  } catch (error) {
    console.error("Erro /api/dashboard/steps:", error);
    res.status(500).json({ error: "Erro ao carregar steps" });
  }
});

app.get("/api/dashboard/goals", async (req, res) => {
  try {
    const dateFilter = getDateFilterFromRequest(req);
    const events = await fetchQuizEvents(dateFilter);
    const sessionsMap = buildSessionMap(events);
    const goals = buildGoalsData(sessionsMap);
    res.json(goals);
  } catch (error) {
    console.error("Erro /api/dashboard/goals:", error);
    res.status(500).json({ error: "Erro ao carregar goals" });
  }
});

app.get("/api/dashboard/campaigns", async (req, res) => {
  try {
    const dateFilter = getDateFilterFromRequest(req);
    const events = await fetchQuizEvents(dateFilter);
    const sessionsMap = buildSessionMap(events);
    const campaigns = buildCampaignsData(sessionsMap);
    res.json(campaigns);
  } catch (error) {
    console.error("Erro /api/dashboard/campaigns:", error);
    res.status(500).json({ error: "Erro ao carregar campaigns" });
  }
});

app.get("/api/dashboard/units", async (req, res) => {
  try {
    const dateFilter = getDateFilterFromRequest(req);
    const events = await fetchQuizEvents(dateFilter);
    const sessionsMap = buildSessionMap(events);
    const units = buildUnitsData(sessionsMap);
    res.json(units);
  } catch (error) {
    console.error("Erro /api/dashboard/units:", error);
    res.status(500).json({ error: "Erro ao carregar units" });
  }
});

app.get("/api/dashboard/leads", async (req, res) => {
  try {
    const dateFilter = getDateFilterFromRequest(req);
    const leads = await fetchDashboardLeads(dateFilter);
    res.json(leads);
  } catch (error) {
    console.error("Erro /api/dashboard/leads:", error);
    res.status(500).json({ error: "Erro ao carregar leads" });
  }
});

// ===============================
// API LEAD STATUS
// ===============================
app.post("/api/lead-status", async (req, res) => {
  try {
    const leadId = toNullableString(req.body?.lead_id);
    const newStatus = toNullableString(req.body?.new_status);

    if (!leadId) {
      return res.status(400).json({ ok: false, error: "lead_id é obrigatório" });
    }

    if (!["agendado", "compareceu", "fechado"].includes(newStatus)) {
      return res.status(400).json({ ok: false, error: "new_status inválido" });
    }

    const currentLead = await getLeadById(leadId);
    const updatedLead = await updateLeadStatusInDb(leadId, newStatus, req.body || {});
    const metaPayload = buildOfflineMetaPayloadFromLead(updatedLead, newStatus);

    let metaResult = { skipped: true, reason: "Sem evento mapeado" };

    if (metaPayload) {
      metaResult = await sendEventToMeta(metaPayload, req);
    }

    return res.json({
      ok: true,
      previous_status: currentLead.lead_status || "raw",
      new_status: updatedLead.lead_status,
      lead: updatedLead,
      meta: metaResult
    });
  } catch (error) {
    console.error("Erro /api/lead-status:", error);
    res.status(500).json({
      ok: false,
      error: "Erro ao atualizar status do lead",
      details: error?.message || null
    });
  }
});

// ===============================
// HEALTHCHECK
// ===============================
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    app: "Quiz E-FIT",
    timestamp: new Date().toISOString(),
    meta_configured: Boolean(META_PIXEL_ID && META_ACCESS_TOKEN)
  });
});

// ===============================
// START
// ===============================
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log("[META] Pixel configurado?", Boolean(META_PIXEL_ID));
  console.log("[META] Access token configurado?", Boolean(META_ACCESS_TOKEN));
  console.log("[META] Test event code configurado?", Boolean(META_TEST_EVENT_CODE));
});
