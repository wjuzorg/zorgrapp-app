// 🔗 Supabase connectie
const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🚀 Hoofdfunctie
async function loadFacturen() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData?.session?.user;

  if (!user) {
    alert("Niet ingelogd");
    return;
  }

  const { data, error } = await supabaseClient
    .from("invoice_drafts")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fout:", error);
    alert("Fout bij laden facturen");
    return;
  }

  console.log("Facturen geladen:", data);

  renderFacturen(data);
}

// 🎨 Facturen tonen
function renderFacturen(facturen) {
  const container = document.querySelector(".facturen-lijst");

  if (!container) {
    console.warn("Geen .facturen-lijst gevonden in HTML");
    return;
  }

  container.innerHTML = "";

  if (!facturen.length) {
    container.innerHTML = "<p>Geen facturen gevonden.</p>";
    return;
  }

  facturen.forEach((factuur) => {
    const el = document.createElement("div");
    el.classList.add("factuur-row");

    el.innerHTML = `
      <div class="factuur-info">
        <strong>${factuur.client_name || "Onbekend"}</strong><br/>
        ${factuur.minutes || 0} minuten · €${factuur.total || 0}
      </div>

      <div class="factuur-actions">
        <button class="light-btn" onclick="openFactuur('${factuur.invoice_number}')">
          Factuur bekijken
        </button>

        <button class="dark-btn" onclick="openFactuur('${factuur.invoice_number}')">
          Controleren en verzenden
        </button>
      </div>
    `;

    container.appendChild(el);
  });
}

// 🔗 Open factuur preview
function openFactuur(invoiceNumber) {
  window.location.href =
    "factuur-preview.html?invoice=" + encodeURIComponent(invoiceNumber);
}

// ▶️ Start bij laden
document.addEventListener("DOMContentLoaded", loadFacturen);