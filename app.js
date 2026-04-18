const todayCountEl = document.getElementById("todayCount");
const signalCountEl = document.getElementById("signalCount");
const invoiceTotalEl = document.getElementById("invoiceTotal");
const appointmentsListEl = document.getElementById("appointmentsList");
const welcomeTitleEl = document.getElementById("welcomeTitle");
const welcomeTextEl = document.getElementById("welcomeText");
const todayDateLabelEl = document.getElementById("todayDateLabel");
const btnNewClient = document.getElementById("btnNewClient");

if (btnNewClient) {
  btnNewClient.addEventListener("click", () => {
    alert("Hier komt straks: nieuwe cliënt of afspraak toevoegen.");
  });
}

function formatDutchDate(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

todayDateLabelEl.textContent = formatDutchDate(new Date());
welcomeTitleEl.textContent = "Goedemorgen";
welcomeTextEl.textContent = "Dashboard test werkt. Volgende stap: live koppeling met Supabase.";

todayCountEl.textContent = "3";
signalCountEl.textContent = "1";
invoiceTotalEl.textContent = "€220";

appointmentsListEl.innerHTML = `
  <article class="appointment-card">
    <div class="appointment-top">
      <div>
        <div class="appointment-time">10:00</div>
        <h4 class="appointment-name">Mevrouw Jansen</h4>
        <div class="appointment-service">Begeleiding thuis</div>
      </div>
      <span class="status-chip status-open">Nog invullen</span>
    </div>

    <div class="card-note">
      Nog geen signalering toegevoegd.
    </div>

    <div class="card-actions">
      <button class="btn btn-secondary">Invullen</button>
      <button class="btn btn-outline">Cliëntenkaart</button>
      <button class="btn btn-finish">Afronden</button>
    </div>
  </article>

  <article class="appointment-card">
    <div class="appointment-top">
      <div>
        <div class="appointment-time">11:30</div>
        <h4 class="appointment-name">Dhr Pieters</h4>
        <div class="appointment-service">Ondersteuning</div>
      </div>
      <span class="status-chip status-filled">Ingevuld</span>
    </div>

    <div class="card-note">
      Signaal: lichte vergeetachtigheid
    </div>

    <div class="card-actions">
      <button class="btn btn-secondary">Invullen</button>
      <button class="btn btn-outline">Cliëntenkaart</button>
      <button class="btn btn-finish enabled">Afronden</button>
    </div>
  </article>
`;
