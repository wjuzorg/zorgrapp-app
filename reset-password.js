const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const newPasswordEl = document.getElementById("newPassword");
const savePasswordBtn = document.getElementById("savePasswordBtn");
const msgEl = document.getElementById("msg");

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    msgEl.textContent = "Resetlink herkend. Kies een nieuw wachtwoord.";
  }
});

checkLoggedInUser().then((loggedIn) => {
  if (!loggedIn) {
    restoreSessionFromUrl();
  }
});

async function checkLoggedInUser() {
  const { data } = await supabaseClient.auth.getUser();

  if (data.user) {
    msgEl.textContent = "Kies hieronder een nieuw wachtwoord.";
    savePasswordBtn.disabled = false;
    return true;
  }

  return false;
}

async function restoreSessionFromUrl() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);

  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");

  if (!access_token || !refresh_token) {
    msgEl.textContent = "Open deze pagina via de resetlink uit je e-mail.";
    return;
  }

  const { error } = await supabaseClient.auth.setSession({
    access_token,
    refresh_token
  });

  if (error) {
    msgEl.textContent = "De resetlink is verlopen of ongeldig.";
  } else {
    msgEl.textContent = "Resetlink herkend. Kies een nieuw wachtwoord.";
  }
}


savePasswordBtn.addEventListener("click", async () => {
  const newPassword = newPasswordEl.value;

  if (!newPassword || newPassword.length < 6) {
    msgEl.textContent = "Kies een wachtwoord van minimaal 6 tekens.";
    return;
  }

  msgEl.textContent = "Wachtwoord opslaan...";

  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword
  });

  if (error) {
    msgEl.textContent = `Fout: ${error.message}`;
    return;
  }

  msgEl.textContent = "Wachtwoord aangepast. Je gaat nu naar de inlogpagina.";

  setTimeout(() => {
    window.location.href = "./login.html";
  }, 1500);
});