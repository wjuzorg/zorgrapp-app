const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let selectedClientId = null;

const clientForm = document.getElementById("clientForm");
const saveMessage = document.getElementById("saveMessage");
const searchClientInput = document.getElementById("searchClient");
const searchClientBtn = document.getElementById("searchClientBtn");
const searchResultMessage = document.getElementById("searchResultMessage");
const invoiceDeliveryMethod = document.getElementById("invoice_delivery_method");
const invoiceAddressBlock = document.getElementById("invoiceAddressBlock");
const invoiceSameAsClientAddress = document.getElementById("invoice_same_as_client_address");
const customInvoiceAddressFields = document.getElementById("customInvoiceAddressFields");
const recurrenceTypeEl = document.getElementById("recurrence_type");
const recurrenceEndBlock = document.getElementById("recurrenceEndBlock");

function toggleInvoiceFields() {
  const method = invoiceDeliveryMethod.value;

  if (method === "address") {
    invoiceAddressBlock.style.display = "block";

    if (invoiceSameAsClientAddress.checked) {
      customInvoiceAddressFields.style.display = "none";
    } else {
      customInvoiceAddressFields.style.display = "block";
    }
  } else {
    invoiceAddressBlock.style.display = "none";
    customInvoiceAddressFields.style.display = "none";
  }
}

function toggleRecurrenceFields() {
  if (recurrenceTypeEl.value === "geen") {
    recurrenceEndBlock.style.display = "none";
  } else {
    recurrenceEndBlock.style.display = "block";
  }
}

invoiceDeliveryMethod.addEventListener("change", toggleInvoiceFields);
invoiceSameAsClientAddress.addEventListener("change", toggleInvoiceFields);
recurrenceTypeEl.addEventListener("change", toggleRecurrenceFields);

function fillForm(client) {
  selectedClientId = client.id;

  document.getElementById("full_name").value = client.full_name || "";
  document.getElementById("phone").value = client.phone || "";
  document.getElementById("address").value = client.address || "";
  document.getElementById("postal_code").value = client.postal_code || "";
  document.getElementById("city").value = client.city || "";
  document.getElementById("client_email").value = client.client_email || "";
  document.getElementById("invoice_email").value = client.invoice_email || "";
  document.getElementById("iban").value = client.iban || "";
  document.getElementById("funding_type").value = client.funding_type || "";
  document.getElementById("emergency_contact").value = client.emergency_contact || "";
  document.getElementById("invoice_delivery_method").value = client.invoice_delivery_method || "nog_niet_afgesproken";
  document.getElementById("invoice_same_as_client_address").checked = client.invoice_same_as_client_address ?? true;
  document.getElementById("invoice_address").value = client.invoice_address || "";
  document.getElementById("invoice_postal_code").value = client.invoice_postal_code || "";
  document.getElementById("invoice_city").value = client.invoice_city || "";
  document.getElementById("notes").value = client.notes || "";

  toggleInvoiceFields();
}

searchClientBtn.addEventListener("click", async () => {
  const searchValue = searchClientInput.value.trim();

  if (!searchValue) {
    searchResultMessage.textContent = "Vul eerst een naam in.";
    return;
  }

  searchResultMessage.textContent = "Zoeken...";

  const { data, error } = await supabaseClient
    .from("Clients")
    .select("*")
    .ilike("full_name", `%${searchValue}%`)
    .limit(1);

  if (error) {
    searchResultMessage.textContent = `Fout bij zoeken: ${error.message}`;
    return;
  }

  if (!data || data.length === 0) {
    selectedClientId = null;
    searchResultMessage.textContent = "Geen cliënt gevonden. Je kunt hieronder een nieuwe cliënt toevoegen.";
    return;
  }

  fillForm(data[0]);
  searchResultMessage.textContent = `Cliënt gevonden: ${data[0].full_name}`;
});

function generateUuid() {
  return crypto.randomUUID();
}

function addDays(dateString, days) {
  const d = new Date(dateString);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function addMonths(dateString, months) {
  const d = new Date(dateString);
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + months);

  // corrigeert maandverschuiving zoals 31e -> volgende maand
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

    if (nextDate > endDate) {
      break;
    }

    dates.push(nextDate);
    current = nextDate;
  }

  return dates;
}

async function checkTimeSlot(date, time) {
  const { data, error } = await supabaseClient
    .from("Appointments")
    .select("id")
    .eq("appointment_date", date)
    .eq("appointment_time", time)
    .limit(1);

  if (error) {
    throw new Error(`Controle tijdslot mislukt: ${error.message}`);
  }

  return data && data.length > 0;
}

clientForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  saveMessage.textContent = "Opslaan...";

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
  const invoice_email = document.getElementById("invoice_email").value.trim();
  const iban = document.getElementById("iban").value.trim();
  const funding_type = document.getElementById("funding_type").value;
  const emergency_contact = document.getElementById("emergency_contact").value.trim();

  const invoice_delivery_method = document.getElementById("invoice_delivery_method").value;
  const invoice_same_as_client_address = document.getElementById("invoice_same_as_client_address").checked;
  const invoice_address = document.getElementById("invoice_address").value.trim();
  const invoice_postal_code = document.getElementById("invoice_postal_code").value.trim();
  const invoice_city = document.getElementById("invoice_city").value.trim();

  const notes = document.getElementById("notes").value.trim();

  if (!full_name) {
    saveMessage.textContent = "Naam is verplicht.";
    return;
  }

  if (recurrence_type !== "geen" && !recurrence_end_date) {
    saveMessage.textContent = "Kies een einddatum voor de herhaling.";
    return;
  }

  const clientPayload = {
    full_name,
    phone,
    address,
    postal_code,
    city,
    client_email,
    invoice_email,
    iban,
    funding_type,
    emergency_contact,
    invoice_delivery_method,
    invoice_same_as_client_address,
    invoice_address,
    invoice_postal_code,
    invoice_city,
    notes
  };

  let clientId = selectedClientId;

  if (clientId) {
    const { error: updateError } = await supabaseClient
      .from("Clients")
      .update(clientPayload)
      .eq("id", clientId);

    if (updateError) {
      saveMessage.textContent = `Fout bij bijwerken cliënt: ${updateError.message}`;
      return;
    }
  } else {
    const { data: insertedClient, error: insertError } = await supabaseClient
      .from("Clients")
      .insert([clientPayload])
      .select()
      .single();

    if (insertError) {
      saveMessage.textContent = `Fout bij opslaan cliënt: ${insertError.message}`;
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
      const isTaken = await checkTimeSlot(date, appointment_time);

      if (isTaken) {
        saveMessage.textContent = `Tijdslot al bezet op ${date} om ${appointment_time}. Kies een andere tijd of pas de reeks aan.`;
        return;
      }

      appointmentsToInsert.push({
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
      saveMessage.textContent = `Cliënt opgeslagen, maar afspraak niet: ${appointmentError.message}`;
      return;
    }
  }

  saveMessage.textContent = "Cliënt en afspraak succesvol opgeslagen.";
});

toggleInvoiceFields();
toggleRecurrenceFields();