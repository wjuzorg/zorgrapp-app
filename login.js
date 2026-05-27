const SUPABASE_URL = "https://bqqoxawgjxxvolljkqnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcW94YXdnanh4dm9sbGprcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc0OTMsImV4cCI6MjA5MjA2MzQ5M30.WLTELxD32HFtyV1pbsB-60nF_k4Zq7DSvaR87-kj2es";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const registerNameWrap = document.getElementById("registerNameWrap");
const fullNameEl = document.getElementById("fullName");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const msgEl = document.getElementById("msg");

let mode = "login";

function setMode(newMode) {
  mode = newMode;

  if (mode === "login") {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    registerNameWrap.classList.add("hidden");
    submitBtn.textContent = "Inloggen";
  } else {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    registerNameWrap.classList.remove("hidden");
    submitBtn.textContent = "Registreren";
  }

  msgEl.textContent = "";
}

tabLogin.addEventListener("click", () => setMode("login"));
tabRegister.addEventListener("click", () => setMode("register"));

async function checkExistingSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    window.location.href = "./index.html";
  }
}

submitBtn.addEventListener("click", async () => {
  const email = emailEl.value.trim();
  const password = passwordEl.value;
  const fullName = fullNameEl.value.trim();

  if (!email || !password) {
    msgEl.textContent = "Vul e-mail en wachtwoord in.";
    return;
  }

  if (mode === "register" && !fullName) {
    msgEl.textContent = "Vul ook je naam in.";
    return;
  }

  if (mode === "login") {
    msgEl.textContent = "Bezig met inloggen...";

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      msgEl.textContent = `Fout: ${error.message}`;
      return;
    }

    window.location.href = "./index.html";
    return;
  }

  msgEl.textContent = "Account aanmaken...";

  const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (signUpError) {
    msgEl.textContent = `Fout: ${signUpError.message}`;
    return;
  }

  if (!signUpData.user) {
    msgEl.textContent = "Account aangemaakt, maar gebruiker niet gevonden.";
    return;
  }

  msgEl.textContent = "Registratie gelukt. Je kunt nu inloggen.";
  setMode("login");
});

const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

forgotPasswordBtn?.addEventListener("click", async () => {
  const email = emailEl.value.trim();

  if (!email) {
    msgEl.textContent = "Vul eerst je e-mailadres in.";
    return;
  }

  msgEl.textContent = "Resetmail versturen...";

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: "https://app.zorgrapp.nl/reset-password.html"
  });

  if (error) {
    msgEl.textContent = `Fout: ${error.message}`;
    return;
  }

  msgEl.textContent = "Er is een e-mail verstuurd om je wachtwoord opnieuw in te stellen.";
});

checkExistingSession();