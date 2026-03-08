const els = {
  refreshBtn: document.getElementById("refreshBtn"),

  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  applyDateFilterBtn: document.getElementById("applyDateFilterBtn"),
  currentPeriodLabel: document.getElementById("currentPeriodLabel"),
  quickRangeButtons: Array.from(document.querySelectorAll(".quick-range-btn")),

  kpiSessions: document.getElementById("kpiSessions"),
  kpiCompleted: document.getElementById("kpiCompleted"),
  kpiLeads: document.getElementById("kpiLeads"),
  kpiCompletionRate: document.getElementById("kpiCompletionRate"),
  kpiLeadRate: document.getElementById("kpiLeadRate"),

  stepsTableBody: document.getElementById("stepsTableBody"),
  goalsTableBody: document.getElementById("goalsTableBody"),
  campaignsTableBody: document.getElementById("campaignsTableBody"),
  unitsTableBody: document.getElementById("unitsTableBody"),
  insightsList: document.getElementById("insightsList"),

  leadsSummary: document.getElementById("leadsSummary"),
  leadsTableBody: document.getElementById("leadsTableBody"),
  leadStatusFilter: document.getElementById("leadStatusFilter")
};

const state = {
  summary: null,
  steps: [],
  goals: [],
  campaigns: [],
  units: [],
  leads: [],
  leadFilter: "all",
  loadingLeads: false,
  dateFilter: {
    startDate: "",
    endDate: "",
    quickRange: "7d"
  }
};

// ===============================
// HELPERS
// ===============================
function formatPercent(value) {
  const n = Number(value || 0);
  return `${n.toFixed(1)}%`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(value, fallback = "—") {
  if (value == null) return fallback;
  const str = String(value).trim();
  return str || fallback;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatDateOnly(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short"
  }).format(date);
}

function scoreBadgeClass(score) {
  const n = Number(score || 0);
  if (n >= 80) return "badge badge-good";
  if (n >= 50) return "badge badge-mid";
  return "badge badge-bad";
}

function mapStatusLabel(status) {
  switch (status) {
    case "raw":
      return "Raw";
    case "lead":
      return "Lead";
    case "qualified":
      return "Qualified";
    case "agendado":
      return "Agendado";
    case "compareceu":
      return "Compareceu";
    case "fechado":
      return "Fechado";
    default:
      return safeText(status, "Raw");
  }
}

function mapStatusClass(status) {
  switch (status) {
    case "raw":
      return "badge badge-status-raw";
    case "lead":
      return "badge badge-status-lead";
    case "qualified":
      return "badge badge-status-qualified";
    case "agendado":
      return "badge badge-status-agendado";
    case "compareceu":
      return "badge badge-status-compareceu";
    case "fechado":
      return "badge badge-status-fechado";
    default:
      return "badge badge-status-raw";
  }
}

function getStepLabel(stepId) {
  const labels = {
    intro: "Intro",
    objetivo: "Objetivo",
    altura_cm: "Altura",
    peso_kg: "Peso",
    idade: "Idade",
    rotina: "Rotina",
    dificuldade: "Dificuldade",
    dor_intensidade: "Dor / intensidade",
    tempo_parado: "Tempo parado",
    carrossel_metodo: "Carrossel método",
    unidade: "Unidade",
    horario: "Horário",
    resultado_avaliacao: "Resultado avaliação",
    interesse: "Interesse",
    nome: "Nome",
    whatsapp: "WhatsApp",
    email: "E-mail",
    resultado_final: "Resultado final"
  };

  return labels[stepId] || stepId || "—";
}

function getFilteredLeads() {
  if (state.leadFilter === "all") return state.leads;
  return state.leads.filter((lead) => (lead.lead_status || "raw") === state.leadFilter);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toInputDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function applyQuickRange(range) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  if (range === "today") {
    // start = hoje
  } else if (range === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (range === "30d") {
    start.setDate(start.getDate() - 29);
  }

  state.dateFilter.startDate = toInputDate(start);
  state.dateFilter.endDate = toInputDate(end);
  state.dateFilter.quickRange = range;

  if (els.startDate) els.startDate.value = state.dateFilter.startDate;
  if (els.endDate) els.endDate.value = state.dateFilter.endDate;

  highlightQuickRange(range);
  renderCurrentPeriod();
}

function highlightQuickRange(activeRange) {
  els.quickRangeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.range === activeRange);
  });
}

function renderCurrentPeriod() {
  const { startDate, endDate } = state.dateFilter;

  if (!startDate || !endDate) {
    els.currentPeriodLabel.textContent = "Período atual: sem filtro definido.";
    return;
  }

  els.currentPeriodLabel.textContent =
    `Período atual: ${formatDateOnly(startDate)} até ${formatDateOnly(endDate)}`;
}

function buildQueryWithDateFilter(baseUrl) {
  const url = new URL(baseUrl, window.location.origin);

  if (state.dateFilter.startDate) {
    url.searchParams.set("start_date", state.dateFilter.startDate);
  }

  if (state.dateFilter.endDate) {
    url.searchParams.set("end_date", state.dateFilter.endDate);
  }

  return url.pathname + url.search;
}

// ===============================
// API
// ===============================
async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Erro ao carregar ${url}: ${response.status}`);
  }
  return response.json();
}

async function updateLeadStatus(leadId, newStatus) {
  const response = await fetch("/api/lead-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      lead_id: leadId,
      new_status: newStatus
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.ok) {
    throw new Error(result?.error || "Falha ao atualizar status do lead");
  }

  return result;
}

// ===============================
// RENDER KPIS
// ===============================
function renderSummary() {
  const s = state.summary || {};

  els.kpiSessions.textContent = s.sessions_started ?? "--";
  els.kpiCompleted.textContent = s.quiz_completed ?? "--";
  els.kpiLeads.textContent = s.leads ?? "--";
  els.kpiCompletionRate.textContent = s.completion_rate != null ? formatPercent(s.completion_rate) : "--";
  els.kpiLeadRate.textContent = s.lead_rate != null ? formatPercent(s.lead_rate) : "--";
}

// ===============================
// RENDER TABLES
// ===============================
function renderSteps() {
  const rows = state.steps || [];

  if (!rows.length) {
    els.stepsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">Nenhuma etapa encontrada ainda.</td>
      </tr>
    `;
    return;
  }

  els.stepsTableBody.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(getStepLabel(row.step_id))}</td>
        <td>${Number(row.step_views || 0)}</td>
        <td>${Number(row.step_answers || 0)}</td>
        <td>${Number(row.drop_offs || 0)}</td>
        <td><span class="${Number(row.dropoff_rate || 0) >= 40 ? "badge badge-bad" : "badge badge-mid"}">${formatPercent(row.dropoff_rate || 0)}</span></td>
      </tr>
    `)
    .join("");
}

function renderGoals() {
  const rows = state.goals || [];

  if (!rows.length) {
    els.goalsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">Nenhum dado por objetivo ainda.</td>
      </tr>
    `;
    return;
  }

  els.goalsTableBody.innerHTML = rows
    .map((row) => {
      const rate = row.sessions_started ? (Number(row.leads || 0) / Number(row.sessions_started || 0)) * 100 : 0;
      return `
        <tr>
          <td>${escapeHtml(safeText(row.objetivo))}</td>
          <td>${Number(row.sessions_started || 0)}</td>
          <td>${Number(row.quiz_completed || 0)}</td>
          <td>${Number(row.leads || 0)}</td>
          <td><span class="${rate >= 20 ? "badge badge-good" : "badge badge-mid"}">${formatPercent(rate)}</span></td>
        </tr>
      `;
    })
    .join("");
}

function renderCampaigns() {
  const rows = state.campaigns || [];

  if (!rows.length) {
    els.campaignsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">Nenhum dado por campanha ainda.</td>
      </tr>
    `;
    return;
  }

  els.campaignsTableBody.innerHTML = rows
    .map((row) => {
      const rate = row.sessions_started ? (Number(row.leads || 0) / Number(row.sessions_started || 0)) * 100 : 0;
      return `
        <tr>
          <td>${escapeHtml(safeText(row.utm_campaign, "Sem campanha"))}</td>
          <td>${Number(row.sessions_started || 0)}</td>
          <td>${Number(row.quiz_completed || 0)}</td>
          <td>${Number(row.leads || 0)}</td>
          <td><span class="${rate >= 20 ? "badge badge-good" : "badge badge-mid"}">${formatPercent(rate)}</span></td>
        </tr>
      `;
    })
    .join("");
}

function renderUnits() {
  const rows = state.units || [];

  if (!rows.length) {
    els.unitsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">Nenhum dado por unidade ainda.</td>
      </tr>
    `;
    return;
  }

  els.unitsTableBody.innerHTML = rows
    .map((row) => {
      const rate = row.sessions_started ? (Number(row.leads || 0) / Number(row.sessions_started || 0)) * 100 : 0;
      return `
        <tr>
          <td>${escapeHtml(safeText(row.unidade, "Sem unidade"))}</td>
          <td>${Number(row.sessions_started || 0)}</td>
          <td>${Number(row.quiz_completed || 0)}</td>
          <td>${Number(row.leads || 0)}</td>
          <td><span class="${rate >= 20 ? "badge badge-good" : "badge badge-mid"}">${formatPercent(rate)}</span></td>
        </tr>
      `;
    })
    .join("");
}

// ===============================
// INSIGHTS
// ===============================
function buildInsights() {
  const insights = [];

  if (state.summary) {
    const completion = Number(state.summary.completion_rate || 0);
    const leadRate = Number(state.summary.lead_rate || 0);

    if (completion < 35) {
      insights.push({
        title: "Conclusão baixa do quiz",
        text: "A taxa de conclusão está baixa. Vale revisar etapas com maior abandono e simplificar partes do meio do funil."
      });
    } else {
      insights.push({
        title: "Conclusão saudável",
        text: "A taxa de conclusão está em um nível bom. Agora o foco é aumentar a qualidade dos leads e o avanço pós-atendimento."
      });
    }

    if (leadRate < 10) {
      insights.push({
        title: "Lead rate ainda tímido",
        text: "Pouca gente está virando lead. Revise copy do resultado final e a força do CTA para WhatsApp."
      });
    } else {
      insights.push({
        title: "Lead rate interessante",
        text: "A geração de lead está ativa. O próximo ganho forte vem do acompanhamento real: agendado, compareceu e fechado."
      });
    }
  }

  const worstStep = [...(state.steps || [])].sort((a, b) => Number(b.dropoff_rate || 0) - Number(a.dropoff_rate || 0))[0];
  if (worstStep) {
    insights.push({
      title: `Maior gargalo: ${getStepLabel(worstStep.step_id)}`,
      text: `Esta etapa está com abandono de ${formatPercent(worstStep.dropoff_rate || 0)}. É o melhor ponto para testar simplificação, copy ou ordem das perguntas.`
    });
  }

  const bestGoal = [...(state.goals || [])].sort((a, b) => Number(b.leads || 0) - Number(a.leads || 0))[0];
  if (bestGoal) {
    insights.push({
      title: `Objetivo com mais leads: ${bestGoal.objetivo}`,
      text: `Esse objetivo está trazendo mais leads no momento. Vale avaliar criativos e promessas alinhados com essa dor principal.`
    });
  }

  return insights.slice(0, 4);
}

function renderInsights() {
  const insights = buildInsights();

  if (!insights.length) {
    els.insightsList.innerHTML = `
      <div class="insight-item">
        <strong>Sem insights ainda</strong>
        <span>Assim que o dashboard acumular dados, esta área passa a entregar leituras práticas.</span>
      </div>
    `;
    return;
  }

  els.insightsList.innerHTML = insights
    .map((item) => `
      <div class="insight-item">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.text)}</span>
      </div>
    `)
    .join("");
}

// ===============================
// LEADS
// ===============================
function renderLeadsSummary() {
  const total = state.leads.length;
  const filtered = getFilteredLeads().length;

  const counters = {
    raw: 0,
    lead: 0,
    qualified: 0,
    agendado: 0,
    compareceu: 0,
    fechado: 0
  };

  for (const lead of state.leads) {
    const status = lead.lead_status || "raw";
    if (status in counters) counters[status] += 1;
  }

  els.leadsSummary.textContent =
    `Mostrando ${filtered} de ${total} leads • ` +
    `Raw: ${counters.raw} • Lead: ${counters.lead} • Qualified: ${counters.qualified} • ` +
    `Agendado: ${counters.agendado} • Compareceu: ${counters.compareceu} • Fechado: ${counters.fechado}`;
}

function buildLeadActions(lead) {
  const currentStatus = lead.lead_status || "raw";

  const buttons = [
    { status: "agendado", label: "Agendado", className: "btn-agendado" },
    { status: "compareceu", label: "Compareceu", className: "btn-compareceu" },
    { status: "fechado", label: "Fechado", className: "btn-fechado" }
  ];

  return `
    <div class="lead-actions">
      ${buttons.map((btn) => `
        <button
          class="lead-action-btn ${btn.className}"
          data-lead-id="${escapeHtml(lead.id)}"
          data-status="${btn.status}"
          ${currentStatus === btn.status ? "disabled" : ""}
        >
          ${escapeHtml(btn.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderLeads() {
  renderLeadsSummary();

  const rows = getFilteredLeads();

  if (!rows.length) {
    els.leadsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">Nenhum lead encontrado para este filtro.</td>
      </tr>
    `;
    return;
  }

  els.leadsTableBody.innerHTML = rows
    .map((lead) => `
      <tr>
        <td>
          <div class="lead-name">${escapeHtml(safeText(lead.nome, "Lead sem nome"))}</div>
          <div class="lead-meta">
            WhatsApp: ${escapeHtml(safeText(lead.whatsapp))}<br>
            E-mail: ${escapeHtml(safeText(lead.email))}<br>
            Criado em: ${escapeHtml(formatDateTime(lead.created_at))}
          </div>
        </td>
        <td>${escapeHtml(safeText(lead.unidade))}</td>
        <td>${escapeHtml(safeText(lead.objetivo))}</td>
        <td>${escapeHtml(safeText(lead.interesse))}</td>
        <td>
          <span class="${scoreBadgeClass(lead.lead_score)}">${Number(lead.lead_score || 0)}</span>
        </td>
        <td>
          <span class="${mapStatusClass(lead.lead_status || 'raw')}">
            ${escapeHtml(mapStatusLabel(lead.lead_status || "raw"))}
          </span>
          <div class="lead-meta" style="margin-top:6px;">
            Agendado: ${escapeHtml(formatDateTime(lead.agendado_em))}<br>
            Compareceu: ${escapeHtml(formatDateTime(lead.compareceu_em))}<br>
            Fechou: ${escapeHtml(formatDateTime(lead.fechou_em))}
          </div>
        </td>
        <td class="actions-cell">
          ${buildLeadActions(lead)}
        </td>
      </tr>
    `)
    .join("");

  bindLeadActions();
}

function bindLeadActions() {
  document.querySelectorAll(".lead-action-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const leadId = btn.getAttribute("data-lead-id");
      const newStatus = btn.getAttribute("data-status");

      if (!leadId || !newStatus) return;

      const oldLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Salvando...";

      try {
        await updateLeadStatus(leadId, newStatus);
        await loadLeads();
      } catch (error) {
        console.error(error);
        alert(error.message || "Falha ao atualizar status do lead");
      } finally {
        btn.textContent = oldLabel;
      }
    });
  });
}

// ===============================
// LOADERS
// ===============================
async function loadSummary() {
  const data = await fetchJson(buildQueryWithDateFilter("/api/dashboard/summary"));
  state.summary = Array.isArray(data) ? data[0] || null : null;
  renderSummary();
}

async function loadSteps() {
  state.steps = await fetchJson(buildQueryWithDateFilter("/api/dashboard/steps"));
  renderSteps();
}

async function loadGoals() {
  state.goals = await fetchJson(buildQueryWithDateFilter("/api/dashboard/goals"));
  renderGoals();
}

async function loadCampaigns() {
  state.campaigns = await fetchJson(buildQueryWithDateFilter("/api/dashboard/campaigns"));
  renderCampaigns();
}

async function loadUnits() {
  state.units = await fetchJson(buildQueryWithDateFilter("/api/dashboard/units"));
  renderUnits();
}

async function loadLeads() {
  state.loadingLeads = true;
  els.leadsTableBody.classList.add("loading");

  try {
    state.leads = await fetchJson(buildQueryWithDateFilter("/api/dashboard/leads"));
    renderLeads();
  } finally {
    state.loadingLeads = false;
    els.leadsTableBody.classList.remove("loading");
  }
}

async function loadDashboard() {
  els.refreshBtn.disabled = true;
  els.refreshBtn.textContent = "Atualizando...";

  try {
    await Promise.all([
      loadSummary(),
      loadSteps(),
      loadGoals(),
      loadCampaigns(),
      loadUnits(),
      loadLeads()
    ]);

    renderInsights();
  } catch (error) {
    console.error(error);
    alert("Falha ao carregar dashboard. Verifique o console.");
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshBtn.textContent = "Atualizar dashboard";
  }
}

// ===============================
// INIT
// ===============================
function handleApplyDateFilter() {
  state.dateFilter.startDate = els.startDate?.value || "";
  state.dateFilter.endDate = els.endDate?.value || "";
  state.dateFilter.quickRange = "";

  highlightQuickRange("");
  renderCurrentPeriod();
  loadDashboard();
}

els.refreshBtn?.addEventListener("click", loadDashboard);

els.leadStatusFilter?.addEventListener("change", (e) => {
  state.leadFilter = e.target.value || "all";
  renderLeads();
});

els.applyDateFilterBtn?.addEventListener("click", handleApplyDateFilter);

els.quickRangeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const range = btn.dataset.range;
    if (!range) return;

    applyQuickRange(range);
    loadDashboard();
  });
});

els.startDate?.addEventListener("change", () => {
  state.dateFilter.quickRange = "";
  highlightQuickRange("");
  renderCurrentPeriod();
});

els.endDate?.addEventListener("change", () => {
  state.dateFilter.quickRange = "";
  highlightQuickRange("");
  renderCurrentPeriod();
});

applyQuickRange("7d");
loadDashboard();
