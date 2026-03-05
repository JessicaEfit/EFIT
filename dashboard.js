let autoRefresh = false;
let autoTimer = null;

const els = {
  btnRefresh: document.getElementById("btnRefresh"),
  btnAuto: document.getElementById("btnAuto"),
  lastUpdate: document.getElementById("lastUpdate"),
  errorBox: document.getElementById("errorBox"),

  kpiIniciadas: document.getElementById("kpiIniciadas"),
  kpiCompletas: document.getElementById("kpiCompletas"),
  kpiLeads: document.getElementById("kpiLeads"),
  kpiConclusao: document.getElementById("kpiConclusao"),
  kpiLeadRate: document.getElementById("kpiLeadRate"),

  loadingSteps: document.getElementById("loadingSteps"),
  loadingCampaigns: document.getElementById("loadingCampaigns"),
  loadingUnits: document.getElementById("loadingUnits"),

  tableSteps: document.getElementById("tableSteps"),
  tableCampaigns: document.getElementById("tableCampaigns"),
  tableUnits: document.getElementById("tableUnits"),

  insights: document.getElementById("insights")
};

function fmtNum(v) {
  const n = Number(v || 0);
  return new Intl.NumberFormat("pt-BR").format(n);
}

function fmtPct(v) {
  const n = Number(v || 0);
  return `${n.toFixed(2).replace(".", ",")}%`;
}

function setError(message = "") {
  if (!message) {
    els.errorBox.style.display = "none";
    els.errorBox.textContent = "";
    return;
  }
  els.errorBox.style.display = "block";
  els.errorBox.textContent = message;
}

async function apiGet(path) {
  const res = await fetch(path, { headers: { "Accept": "application/json" } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ${res.status}: ${text}`);
  }
  return res.json();
}

function dropClass(dropRate) {
  const n = Number(dropRate || 0);
  if (n >= 50) return "drop-high";
  if (n >= 25) return "drop-mid";
  return "drop-low";
}

function renderSummary(summary) {
  const row = Array.isArray(summary) ? summary[0] : summary;
  if (!row) return;

  els.kpiIniciadas.textContent = fmtNum(row.sessoes_iniciadas);
  els.kpiCompletas.textContent = fmtNum(row.sessoes_completas);
  els.kpiLeads.textContent = fmtNum(row.sessoes_lead_whatsapp);
  els.kpiConclusao.textContent = fmtPct(row.taxa_conclusao_percent);
  els.kpiLeadRate.textContent = fmtPct(row.taxa_lead_percent);
}

function renderSteps(rows = []) {
  const tbody = els.tableSteps.querySelector("tbody");
  tbody.innerHTML = "";

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.step_index ?? "-"}</td>
      <td class="mono">${r.step_id ?? "-"}</td>
      <td>${fmtNum(r.total_views)}</td>
      <td>${fmtNum(r.total_answers)}</td>
      <td>${fmtPct(r.answer_rate_percent)}</td>
      <td class="${dropClass(r.drop_rate_percent)}">${fmtPct(r.drop_rate_percent)}</td>
    `;
    tbody.appendChild(tr);
  });

  els.loadingSteps.style.display = "none";
  els.tableSteps.style.display = rows.length ? "table" : "none";
  if (!rows.length) els.loadingSteps.textContent = "Sem dados ainda.";
}

function renderCampaigns(rows = []) {
  const tbody = els.tableCampaigns.querySelector("tbody");
  tbody.innerHTML = "";

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${r.utm_campaign}</td>
      <td class="muted">${r.utm_source} / ${r.utm_medium}</td>
      <td>${fmtNum(r.iniciadas)}</td>
      <td>${fmtNum(r.completas)}</td>
      <td>${fmtNum(r.leads_whatsapp)}</td>
      <td>${fmtPct(r.taxa_lead_percent)}</td>
    `;
    tbody.appendChild(tr);
  });

  els.loadingCampaigns.style.display = "none";
  els.tableCampaigns.style.display = rows.length ? "table" : "none";
  if (!rows.length) els.loadingCampaigns.textContent = "Sem dados ainda.";
}

function renderUnits(rows = []) {
  const tbody = els.tableUnits.querySelector("tbody");
  tbody.innerHTML = "";

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.unidade}</td>
      <td>${fmtNum(r.iniciadas)}</td>
      <td>${fmtNum(r.completas)}</td>
      <td>${fmtNum(r.leads_whatsapp)}</td>
      <td>${fmtPct(r.taxa_lead_percent)}</td>
    `;
    tbody.appendChild(tr);
  });

  els.loadingUnits.style.display = "none";
  els.tableUnits.style.display = rows.length ? "table" : "none";
  if (!rows.length) els.loadingUnits.textContent = "Sem dados ainda.";
}

function renderInsights({ steps = [], campaigns = [], units = [], summary = [] }) {
  const s = Array.isArray(summary) ? summary[0] : summary;
  const parts = [];

  if (s) {
    parts.push(
      `Funil atual: <strong>${fmtNum(s.sessoes_iniciadas)}</strong> sessões iniciadas, ` +
      `<strong>${fmtNum(s.sessoes_completas)}</strong> completas e ` +
      `<strong>${fmtNum(s.sessoes_lead_whatsapp)}</strong> leads no WhatsApp ` +
      `(<strong>${fmtPct(s.taxa_lead_percent)}</strong> de taxa de lead).`
    );
  }

  if (steps.length) {
    const sorted = [...steps].sort((a, b) => Number(b.drop_rate_percent || 0) - Number(a.drop_rate_percent || 0));
    const topDrop = sorted[0];
    if (topDrop) {
      parts.push(
        `Maior abandono atual: etapa <strong>${topDrop.step_id || "-"}</strong> ` +
        `(#${topDrop.step_index || "-"}) com <strong>${fmtPct(topDrop.drop_rate_percent)}</strong>.`
      );
    }
  }

  if (campaigns.length) {
    const bestCamp = [...campaigns].sort((a, b) => Number(b.leads_whatsapp || 0) - Number(a.leads_whatsapp || 0))[0];
    if (bestCamp) {
      parts.push(
        `Campanha com mais leads no recorte atual: <strong>${bestCamp.utm_campaign}</strong> ` +
        `(${fmtNum(bestCamp.leads_whatsapp)} leads, taxa lead ${fmtPct(bestCamp.taxa_lead_percent)}).`
      );
    }
  }

  if (units.length) {
    const bestUnit = [...units].sort((a, b) => Number(b.leads_whatsapp || 0) - Number(a.leads_whatsapp || 0))[0];
    if (bestUnit) {
      parts.push(
        `Unidade com mais leads: <strong>${bestUnit.unidade}</strong> ` +
        `(${fmtNum(bestUnit.leads_whatsapp)} leads).`
      );
    }
  }

  els.insights.innerHTML = parts.length ? parts.join("<br><br>") : "Sem dados suficientes ainda.";
}

async function loadDashboard() {
  setError("");
  els.loadingSteps.style.display = "block";
  els.loadingCampaigns.style.display = "block";
  els.loadingUnits.style.display = "block";
  els.loadingSteps.textContent = "Carregando...";
  els.loadingCampaigns.textContent = "Carregando...";
  els.loadingUnits.textContent = "Carregando...";

  try {
    const [summary, steps, campaigns, units] = await Promise.all([
      apiGet("/api/dashboard/summary"),
      apiGet("/api/dashboard/steps"),
      apiGet("/api/dashboard/campaigns"),
      apiGet("/api/dashboard/units")
    ]);

    renderSummary(summary);
    renderSteps(steps);
    renderCampaigns(campaigns);
    renderUnits(units);
    renderInsights({ summary, steps, campaigns, units });

    els.lastUpdate.textContent = `Última atualização: ${new Date().toLocaleString("pt-BR")}`;
  } catch (err) {
    console.error(err);
    setError(`Falha ao carregar dashboard: ${err.message}`);
  }
}

function setAutoRefresh(enabled) {
  autoRefresh = enabled;
  els.btnAuto.textContent = `Auto atualizar: ${enabled ? "ON" : "OFF"}`;

  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }

  if (enabled) {
    autoTimer = setInterval(loadDashboard, 15000); // 15s
  }
}

document.addEventListener("DOMContentLoaded", () => {
  els.btnRefresh.addEventListener("click", loadDashboard);
  els.btnAuto.addEventListener("click", () => setAutoRefresh(!autoRefresh));

  loadDashboard();
});