const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let selectedClientId = null;

async function enforceProcessorAgreement() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    window.location.href = "./login.html";
    return false;
  }

  const { data, error } = await supabaseClient
    .from("business_profiles")
    .select("processor_agreement_accepted")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Verwerkersovereenkomst check mislukt:", error);
    alert("Controle van bedrijfsprofiel mislukt. Probeer opnieuw.");
    window.location.href = "./bedrijfsprofiel.html";
    return false;
  }

  const accepted = data?.processor_agreement_accepted === true;

  if (!accepted) {
    alert("Accepteer eerst de verwerkersovereenkomst in uw bedrijfsprofiel.");
    window.location.href = "./bedrijfsprofiel.html";
    return false;
  }

  return true;
}

/* ---------------- HELPERS ---------------- */

function el(id) {
  return document.getElementById(id);
}

function val(id) {
  return el(id)?.value?.trim() || "";
}

function showSaveMessage(text, isError = false) {
  const box = el("saveMessage");
  if (!box) return;
  box.textContent = text;
  box.style.color = isError ? "#b91c1c" : "#6b7280";
}

/* ---------------- LOGIN ---------------- */

async function requireLogin() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = "./login.html";
    return null;
  }
  return data.session.user;
}

/* ---------------- TIME CHECK ---------------- */

async function checkTimeSlot(date, time, userId) {
  const { data, error } = await supabaseClient
    .from("Appointments")
    .select("id")
    .eq("owner_id", userId)
    .eq("appointment_date", date)
    .eq("appointment_time", time)
    .neq("status", "verwijderd")
    .limit(1);

  if (error) throw new Error(error.message);

  return data && data.length > 0;
}

/* ---------------- UI TOGGLES ---------------- */

function toggleRecurrenceFields() {
  el("recurrenceEndWrap")?.classList.toggle(
    "hidden",
    val("recurrence_type") === "geen"
  );
}

function toggleInvoiceFields() {
  const method = val("invoice_delivery_method");

  el("invoiceEmailWrap")?.classList.add("hidden");
  el("invoiceAddressModeWrap")?.classList.add("hidden");
  el("invoiceAddressFields")?.classList.add("hidden");

  if (method === "email") {
    el("invoiceEmailWrap")?.classList.remove("hidden");
  }

  if (method === "address") {
    el("invoiceAddressModeWrap")?.classList.remove("hidden");

    if (val("invoice_same_as_client_address") === "false") {
      el("invoiceAddressFields")?.classList.remove("hidden");
    }
  }
}

/* ---------------- SEARCH ---------------- */

async function searchClients() {
  const q = val("searchClient");

  if (!q) {
    el("searchInfo").textContent = "Vul eerst een naam in.";
    return;
  }

  el("searchInfo").textContent = "Zoeken...";

  const { data, error } = await supabaseClient
    .from("Clients")
    .select("id, full_name, address, city, phone")
    .ilike("full_name", `%${q}%`)
    .limit(10);

  if (error) {
    el("searchInfo").textContent = error.message;
    return;
  }

  renderResults(data || []);
}

function renderResults(clients) {
  const container = el("searchResults");

  if (!clients.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = clients.map(c => `
    <div class="result-card" data-id="${c.id}">
      <strong>${c.full_name}</strong><br>
      ${c.address || ""} ${c.city || ""}
    </div>
  `).join("");

  document.querySelectorAll(".result-card").forEach(card => {
    card.onclick = () => loadClient(card.dataset.id);
  });
}

async function loadClient(id) {
  const { data } = await supabaseClient
    .from("Clients")
    .select("*")
    .eq("id", id)
    .single();

  selectedClientId = id;

  Object.keys(data).forEach(key => {
    if (el(key)) el(key).value = data[key] || "";
  });

  toggleInvoiceFields();
}

/* ---------------- DATE HELPERS ---------------- */

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function buildRecurringDates(start, type, end) {
  const dates = [start];
  if (type === "geen" || !end) return dates;

  let current = start;

  while (true) {
    let next;

    if (type === "wekelijks") next = addDays(current, 7);
    if (type === "tweewekelijks") next = addDays(current, 14);
    if (type === "maandelijks") next = addDays(current, 30);

    if (!next || next > end) break;

    dates.push(next);
    current = next;
  }

  return dates;
}

/* ---------------- SAVE ---------------- */

async function saveClient() {
  try {
    const user = await requireLogin();
    if (!user) return;

    showSaveMessage("Opslaan...");

    const full_name = val("full_name");
    if (!full_name) {
      showSaveMessage("Naam is verplicht", true);
      return;
    }

    const clientPayload = {
      owner_id: user.id,
      full_name,
      address: val("address"),
      postal_code: val("postal_code"),
      city: val("city"),
      client_email: val("client_email"),
      iban: val("iban"),
      funding_type: val("funding_type"),
      emergency_contact: val("emergency_contact"),
      invoice_delivery_method: val("invoice_delivery_method"),
      invoice_email: val("invoice_email"),
      invoice_same_as_client_address: val("invoice_same_as_client_address") !== "false",
      invoice_address: val("invoice_address"),
      invoice_postal_code: val("invoice_postal_code"),
      invoice_city: val("invoice_city")
    };

    let clientId = selectedClientId;

    if (clientId) {
      await supabaseClient.from("Clients").update(clientPayload).eq("id", clientId);
    } else {
      const { data, error } = await supabaseClient
  .from("Clients")
  .insert([clientPayload])
  .select()
  .single();

if (error || !data) {
  showSaveMessage("Opslaan cliënt mislukt: " + (error?.message || "geen data"), true);
  return;
}

clientId = data.id;
    }

    const date = val("appointment_date");
    const time = val("appointment_time");

    if (date && time) {
      const dates = buildRecurringDates(
        date,
        val("recurrence_type"),
        val("recurrence_end_date")
      );

      for (const d of dates) {
        const taken = await checkTimeSlot(d, time, user.id);

        if (taken) {
          showSaveMessage(`Tijdslot bezet: ${d} ${time}`, true);
          return;
        }
      }

      const appointments = dates.map(d => ({
        owner_id: user.id,
        client_id: clientId,
        client_name: full_name,
        appointment_date: d,
        appointment_time: time,
        service_type: val("service_type"),
        duration_minutes: Number(val("duration_minutes")) || null,
        status: "open"
      }));

      await supabaseClient.from("Appointments").insert(appointments);
    }

    showSaveMessage("Cliënt opgeslagen ✅");
  } catch (err) {
    console.error(err);
    showSaveMessage(err.message, true);
  }
}


function showNewClientForm() {
  document.getElementById("newClientFormBox").style.display = "block";
  document.getElementById("existingClientSearchBox").style.display = "none";
}

function showExistingClientSearch() {
  document.getElementById("newClientFormBox").style.display = "none";
  document.getElementById("existingClientSearchBox").style.display = "block";
}

async function searchExistingClients() {
  const searchValue = document.getElementById("existingClientSearch").value.trim();
  const resultsBox = document.getElementById("existingClientResults");

  if (!searchValue) {
    resultsBox.innerHTML = "<p>Vul eerst een naam, telefoonnummer of adres in.</p>";
    return;
  }

  resultsBox.innerHTML = "<p>Cliënten zoeken...</p>";

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    resultsBox.innerHTML = "<p>U bent niet ingelogd.</p>";
    return;
  }

  const { data, error } = await supabaseClient
    .from("Clients")
    .select("*")
    .eq("owner_id", user.id)
    .or(
      `full_name.ilike.%${searchValue}%,phone.ilike.%${searchValue}%,address.ilike.%${searchValue}%`
    )
    .limit(10);

  if (error) {
    resultsBox.innerHTML = `<p>Zoeken mislukt: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    resultsBox.innerHTML = "<p>Geen cliënt gevonden.</p>";
    return;
  }

  resultsBox.innerHTML = data.map(client => `
    <div class="client-result-card">
      <strong>${client.full_name || "Naam onbekend"}</strong><br>
      <span>${client.address || ""}</span><br>
      <span>${client.phone || ""}</span><br><br>

      <button type="button" class="dark-btn"
        onclick="window.location.href='plan-afspraak.html?client_id=${client.id}'"
        Nieuwe afspraak plannen
      </button>

      <button type="button" class="light-btn"
        onclick="window.location.href='clientkaart.html?id=${client.id}'">
        Cliëntenkaart openen
      </button>
    </div>
  `).join("");
}

/* ---------------- INIT ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("NEW CLIENT JS GELADEN");

  const ok = await enforceProcessorAgreement();
  console.log("Agreement ok:", ok);

  if (!ok) return;

  toggleRecurrenceFields();
  toggleInvoiceFields();

  const saveBtn = document.getElementById("saveClientBtn");
  console.log("saveBtn gevonden:", saveBtn);

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      console.log("OPSLAAN GEKLIKT");
      await saveClient();
    });
  } else {
    console.error("Opslaan-knop niet gevonden.");
  }

 window.showNewClientForm = showNewClientForm;
window.showExistingClientSearch = showExistingClientSearch;
window.searchExistingClients = searchExistingClients;
window.saveClient = saveClient;
});