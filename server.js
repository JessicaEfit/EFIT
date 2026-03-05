require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 3000;

// ======== CONFIG SUPABASE (BACKEND) ========
// RECOMENDADO: usar variáveis de ambiente
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  console.log("✅ Supabase backend client iniciado");
} else {
  console.warn("⚠️ Supabase backend NÃO configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      return sendText(res, 500, "Erro interno ao carregar arquivo.");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

async function queryView(viewName) {
  if (!supabase) {
    throw new Error("Supabase backend não configurado.");
  }

  const { data, error } = await supabase.from(viewName).select("*");
  if (error) throw error;
  return data || [];
}

async function handleDashboardApi(req, res, pathname) {
  try {
    if (!supabase) {
      return sendJson(res, 500, { error: "Supabase backend não configurado no servidor." });
    }

    if (pathname === "/api/dashboard/summary") {
      const data = await queryView("vw_quiz_funnel_summary");
      return sendJson(res, 200, data);
    }

    if (pathname === "/api/dashboard/steps") {
      const data = await queryView("vw_quiz_step_dropoff");
      return sendJson(res, 200, data);
    }

    if (pathname === "/api/dashboard/campaigns") {
      const data = await queryView("vw_quiz_campaign_performance");
      return sendJson(res, 200, data);
    }

    if (pathname === "/api/dashboard/units") {
      const data = await queryView("vw_quiz_unit_performance");
      return sendJson(res, 200, data);
    }

    return false;
  } catch (error) {
    console.error("Erro API dashboard:", error);
    return sendJson(res, 500, { error: error.message || "Erro ao consultar dashboard" });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let reqPath = url.pathname;

    // ======= Rota amigável do dashboard =======
    if (reqPath === "/dashboard") {
      reqPath = "/dashboard.html";
    }

    // ======= APIs do dashboard =======
    if (reqPath.startsWith("/api/dashboard/")) {
      const handled = await handleDashboardApi(req, res, reqPath);
      if (handled !== false) return;
    }

    if (reqPath === "/") reqPath = "/index.html";

    // Segurança básica
    const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(__dirname, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        return sendText(res, 404, "Arquivo não encontrado.");
      }
      sendFile(res, filePath);
    });
  } catch (error) {
    console.error("Erro geral no servidor:", error);
    sendText(res, 500, "Erro no servidor.");
  }
});

server.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
});