const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function requireLogin() {
  const { data } = await supabaseClient.auth.getSession();

  if (!data.session) {
    window.location.href = "./login.html";
    return null;
  }

  return data.session.user;
}

let selectedClientId = null;

const searchClientInput = document.getElementById("searchClient");
const searchClientBtn = document.getElementById("searchClientBtn");
const searchInfo = document.getElementById("searchInfo");
const searchResults = document.getElementById("searchResults");

const recurrenceTypeEl = document.getElementById("recurrence_type");
const recurrenceEndWrap = document.getElementById("recurrenceEndWrap");

const invoiceDeliveryMethodEl = document.getElementById("invoice_delivery_method");
const invoiceEmailWrap = document.getElementById("invoiceEmailWrap");
const invoiceAddressModeWrap = document.getElementById("invoiceAddressModeWrap");
const invoiceAddressFields = document.getElementById("invoiceAddressFields");
const invoiceSameAsClientAddressEl = document.getElementById("invoice_same_as_client_address");

const saveClientBtn = document.getElementById("saveClientBtn");
const saveMessage = document.getElementById("saveMessage");

function showSaveMessage(text, isError = false) {
  saveMessage.textContent = text;
  saveMessage.style.color = isError ? "#b91c1c" : "#6b7280";
}

function toggleRecurrenceFields() {
  recurrenceEndWrap.classList.toggle("hidden", recurrenceTypeEl.value === "geen");
}

function toggleInvoiceFields() {
  const method = invoiceDeliveryMethodEl.value;

  invoiceEmailWrap.classList.add("hidden");
  invoiceAddressModeWrap.classList.add("hidden");
  invoiceAddressFields.classList.add("hidden");

  if (method === "email") {
    invoiceEmailWrap.classList.remove("hidden");
  }

  if (method === "address") {
    invoiceAddressModeWrap.classList.remove("hidden");

    if (invoiceSameAsClientAddressEl.value === "false") {
      invoiceAddressFields.classList.remove("hidden");
    }
  }
}

recurrenceTypeEl.addEventListener("change", toggleRecurrenceFields);
invoiceDeliveryMethodEl.addEventListener("change", toggleInvoiceFields);
invoiceSameAsClientAddressEl.addEventListener("change", toggleInvoiceFields);

function renderSearchResults(clients) {
  if (!clients.length) {
    searchResults.classList.remove("active");
    searchResults.innerHTML = "";
    searchInfo.textContent = "Geen cliënten gevonden. Je kunt hieronder een nieuwe cliënt toevoegen.";
    return;
  }

  searchInfo.textContent = `${clients.length} resultaat/resultaten gevonden. Kies de juiste cliënt.`;
  searchResults.classList.add("active");

  searchResults.innerHTML = clients.map(client => `
    <div class="result-card" data-id="${client.id}">
      <div class="result-name">${client.full_name || "-"}</div>
      <div class="result-meta">
        ${client.address || "Geen adres"}${client.city ? ` - ${client.city}` : ""}
        <br>
        ${client.phone || "Geen telefoonnummer"}
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".result-card").forEach(card => {
    card.addEventListener("click", async () => {
      const id = card.dataset.id;

      const { data, error } = await supabaseClient
        .from("Clients")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        searchInfo.textContent = `Fout bij laden cliënt: ${error.message}`;
        return;
      }

      fillForm(data);
      searchInfo.textContent = `Cliënt geladen: ${data.full_name}`;
      searchResults.classList.remove("active");
    });
  });
}

function fillForm(client) {
  selectedClientId = client.id;

  document.getElementById("full_name").value = client.full_name || "";
  document.getElementById("phone").value = client.phone || "";
  document.getElementById("address").value = client.address || "";
  document.getElementById("postal_code").value = client.postal_code || "";
  document.getElementById("city").value = client.city || "";

  document.getElementById("client_email").value = client.client_email || "";
  document.getElementById("iban").value = client.iban || "";
  document.getElementById("funding_type").value = client.funding_type || "";
  document.getElementById("emergency_contact").value = client.emergency_contact || "";

  document.getElementById("invoice_delivery_method").value =
    client.invoice_delivery_method || "nog_niet_afgesproken";
  document.getElementById("invoice_email").value = client.invoice_email || "";
  document.getElementById("invoice_same_as_client_address").value =
    String(client.invoice_same_as_client_address ?? true);
  document.getElementById("invoice_address").value = client.invoice_address || "";
  document.getElementById("invoice_postal_code").value = client.invoice_postal_code || "";
  document.getElementById("invoice_city").value = client.invoice_city || "";

  toggleInvoiceFields();
}

searchClientBtn.addEventListener("click", async () => {
  const q = searchClientInput.value.trim();

  if (!q) {
    searchInfo.textContent = "Vul eerst een naam in.";
    searchResults.classList.remove("active");
    searchResults.innerHTML = "";
    return;
  }

  searchInfo.textContent = "Zoeken...";
  searchResults.classList.remove("active");
  searchResults.innerHTML = "";

  const { data, error } = await supabaseClient
    .from("Clients")
    .select("id, full_name, address, city, phone")
    .ilike("full_name", `%${q}%`)
    .order("full_name", { ascending: true })
    .limit(10);

  if (error) {
    searchInfo.textContent = `Fout bij zoeken: ${error.message}`;
    return;
  }

  renderSearchResults(data || []);
});

function addDays(dateString, days) {
  const d = new Date(dateString);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function addMonths(dateString, months) {
  const d = new Date(dateString);
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + months);

  if (d.getDate() < originalDay) {
    d.setDate(0);
  }

  return d.toISOString().split("T")[0];
}

function buildRecurringDates(startDate, recurrenceType, endDate) {
  const dates = [startDate];

  if (!recurrenceType || recurrenceType === "geen" || !endDate) {
    return dates;
  }

  let current = startDate;

  while (true) {
    let nextDate;

    if (recurrenceType === "wekelijks") {
      nextDate = addDays(current, 7);
    } else if (recurrenceType === "tweewekelijks") {
      nextDate = addDays(current, 14);
    } else if (recurrenceType === "maandelijks") {
      nextDate = addMonths(current, 1);
    } else {
      break;
    }

    if (nextDate > endDate) break;

    dates.push(nextDate);
    current = nextDate;
  }

  return dates;
}

function generateUuid() {
  return crypto.randomUUID();
}

async function checkTimeSlot(date, time, userId) {
  const { data, error } = await supabaseClient
    .from("Appointments")
    .select("id")
    .eq("owner_id", userId)
    .eq("appointment_date", date)
    .eq("appointment_time", time)
    .limit(1);

  if (error) {
    throw new Error(`Controle tijdslot mislukt: ${error.message}`);
  }

  return data && data.length > 0;
}

saveClientBtn.addEventListener("click", async () => {
  try {
    const user = await requireLogin();
    if (!user) return;

    showSaveMessage("Opslaan...");

    const full_name = document.getElementById("full_name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const address = document.getElementById("address").value.trim();
    const postal_code = document.getElementById("postal_code").value.trim();
    const city = document.getElementById("city").value.trim();

    const appointment_date = document.getElementById("appointment_date").value;
    const appointment_time = document.getElementById("appointment_time").value;
    const service_type = document.getElementById("service_type").value.trim();
    const duration_minutes = document.getElementById("duration_minutes").value
      ? Number(document.getElementById("duration_minutes").value)
      : null;
    const recurrence_type = document.getElementById("recurrence_type").value;
    const recurrence_end_date = document.getElementById("recurrence_end_date").value;

    const client_email = document.getElementById("client_email").value.trim();
    const iban = document.getElementById("iban").value.trim();
    const funding_type = document.getElementById("funding_type").value;
    const emergency_contact = document.getElementById("emergency_contact").value.trim();

    const invoice_delivery_method = document.getElementById("invoice_delivery_method").value;
    const invoice_email = document.getElementById("invoice_email").value.trim();
    const invoice_same_as_client_address = invoiceSameAsClientAddressEl.value === "true";
    const invoice_address = document.getElementById("invoice_address").value.trim();
    const invoice_postal_code = document.getElementById("invoice_postal_code").value.trim();
    const invoice_city = document.getElementById("invoice_city").value.trim();

    if (!full_name) {
      showSaveMessage("Naam is verplicht.", true);
      return;
    }

    if (recurrence_type !== "geen" && !recurrence_end_date) {
      showSaveMessage("Kies een einddatum voor de herhaling.", true);
      return;
    }

    const clientPayload = {
      owner_id: user.id,
      full_name,
      phone,
      address,
      postal_code,
      city,
      client_email,
      iban,
      funding_type,
      emergency_contact,
      invoice_delivery_method,
      invoice_email,
      invoice_same_as_client_address,
      invoice_address,
      invoice_postal_code,
      invoice_city
    };

    let clientId = selectedClientId;

    if (clientId) {
      const { error: updateError } = await supabaseClient
        .from("Clients")
        .update(clientPayload)
        .eq("id", clientId);

      if (updateError) {
        showSaveMessage(`Fout bij bijwerken cliënt: ${updateError.message}`, true);
        return;
      }
    } else {
      const { data: insertedClient, error: insertError } = await supabaseClient
        .from("Clients")
        .insert([clientPayload])
        .select()
        .single();

      if (insertError) {
        showSaveMessage(`Fout bij opslaan cliënt: ${insertError.message}`, true);
        return;
      }

      clientId = insertedClient.id;
      selectedClientId = clientId;
    }

    if (appointment_date && appointment_time) {
      const allDates = buildRecurringDates(
        appointment_date,
        recurrence_type,
        recurrence_end_date
      );

      const recurring_group_id = recurrence_type !== "geen" ? generateUuid() : null;
      const appointmentsToInsert = [];

      for (const date of allDates) {
        const isTaken = await checkTimeSlot(date, appointment_time, user.id);

        if (isTaken) {
          showSaveMessage(
            `Tijdslot al bezet op ${date} om ${appointment_time}. Kies een andere tijd of pas de reeks aan.`,
            true
          );
          return;
        }

        appointmentsToInsert.push({
          owner_id: user.id,
          client_id: clientId,
          client_name: full_name,
          appointment_date: date,
          appointment_time,
          service_type,
          duration_minutes,
          recurrence_type,
          recurrence_end_date: recurrence_type === "geen" ? null : recurrence_end_date,
          is_recurring: recurrence_type !== "geen",
          recurring_group_id,
          status: "open",
          ready_for_invoice: false
        });
      }

      const { error: appointmentError } = await supabaseClient
        .from("Appointments")
        .insert(appointmentsToInsert);

      if (appointmentError) {
        showSaveMessage(`Cliënt opgeslagen, maar afspraak niet: ${appointmentError.message}`, true);
        return;
      }
    }

    showSaveMessage("Cliënt succesvol opgeslagen.");
  } catch (err) {
    console.error("SAVE ERROR:", err);
    showSaveMessage(`Algemene fout: ${err.message}`, true);
  }
});

  const full_name = document.getElementById("full_name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const postal_code = document.getElementById("postal_code").value.trim();
  const city = document.getElementById("city").value.trim();

  const appointment_date = document.getElementById("appointment_date").value;
  const appointment_time = document.getElementById("appointment_time").value;
  const service_type = document.getElementById("service_type").value.trim();
  const duration_minutes = document.getElementById("duration_minutes").value
    ? Number(document.getElementById("duration_minutes").value)
    : null;
  const recurrence_type = document.getElementById("recurrence_type").value;
  const recurrence_end_date = document.getElementById("recurrence_end_date").value;

  const client_email = document.getElementById("client_email").value.trim();
  const iban = document.getElementById("iban").value.trim();
  const funding_type = document.getElementById("funding_type").value;
  const emergency_contact = document.getElementById("emergency_contact").value.trim();

  const invoice_delivery_method = document.getElementById("invoice_delivery_method").value;
  const invoice_email = document.getElementById("invoice_email").value.trim();
  const invoice_same_as_client_address = invoiceSameAsClientAddressEl.value === "true";
  const invoice_address = document.getElementById("invoice_address").value.trim();
  const invoice_postal_code = document.getElementById("invoice_postal_code").value.trim();
  const invoice_city = document.getElementById("invoice_city").value.trim();

  if (!full_name) {
    showSaveMessage("Naam is verplicht.", true);
    return;
  }

  if (recurrence_type !== "geen" && !recurrence_end_date) {
    showSaveMessage("Kies een einddatum voor de herhaling.", true);
    return;
  }

  const clientPayload = {
    owner_id: user.id,
    full_name,
    phone,
    address,
    postal_code,
    city,
    client_email,
    iban,
    funding_type,
    emergency_contact,
    invoice_delivery_method,
    invoice_email,
    invoice_same_as_client_address,
    invoice_address,
    invoice_postal_code,
    invoice_city
  };

  let clientId = selectedClientId;

  if (clientId) {
    const { error: updateError } = await supabaseClient
      .from("Clients")
      .update(clientPayload)
      .eq("id", clientId);

    if (updateError) {
      showSaveMessage(`Fout bij bijwerken cliënt: ${updateError.message}`, true);
      return;
    }
  } else {
    const { data: insertedClient, error: insertError } = await supabaseClient
      .from("Clients")
      .insert([clientPayload])
      .select()
      .single();

    if (insertError) {
      showSaveMessage(`Fout bij opslaan cliënt: ${insertError.message}`, true);
      return;
    }

    clientId = insertedClient.id;
    selectedClientId = clientId;
  }

  if (appointment_date && appointment_time) {
    const allDates = buildRecurringDates(
      appointment_date,
      recurrence_type,
      recurrence_end_date
    );

    const recurring_group_id = recurrence_type !== "geen" ? generateUuid() : null;
    const appointmentsToInsert = [];

    for (const date of allDates) {
      const isTaken = await checkTimeSlot(date, appointment_time, user.id);

      if (isTaken) {
        showSaveMessage(
          `Tijdslot al bezet op ${date} om ${appointment_time}. Kies een andere tijd of pas de reeks aan.`,
          true
        );
        return;
      }

      appointmentsToInsert.push({
        owner_id: user.id,
        client_id: clientId,
        client_name: full_name,
        appointment_date: date,
        appointment_time,
        service_type,
        duration_minutes,
        recurrence_type,
        recurrence_end_date: recurrence_type === "geen" ? null : recurrence_end_date,
        is_recurring: recurrence_type !== "geen",
        recurring_group_id,
        status: "open",
        ready_for_invoice: false
      });
    }

    const { error: appointmentError } = await supabaseClient
      .from("Appointments")
      .insert(appointmentsToInsert);

    if (appointmentError) {
      showSaveMessage(`Cliënt opgeslagen, maar afspraak niet: ${appointmentError.message}`, true);
      return;
    }
  }

  showSaveMessage("Cliënt succesvol opgeslagen.");
});

toggleRecurrenceFields();
toggleInvoiceFields();