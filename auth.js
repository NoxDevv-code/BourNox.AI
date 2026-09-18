const form = document.getElementById("authForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const confirmWrap = document.getElementById("confirmWrap");
const confirmPassword = document.getElementById("confirmPassword");
const submitBtn = document.getElementById("submitBtn");
const errorBox = document.getElementById("authError");

let registerMode = false;

fetch("/api/me").then(r => {
  if (r.ok) window.location.href = "/";
});

function setMode(register) {
  registerMode = register;
  loginTab.classList.toggle("active", !register);
  registerTab.classList.toggle("active", register);
  confirmWrap.classList.toggle("hidden", !register);
  confirmPassword.required = register;
  submitBtn.textContent = register ? "Créer mon compte" : "Se connecter";
  errorBox.textContent = "";
}

loginTab.onclick = () => setMode(false);
registerTab.onclick = () => setMode(true);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.textContent = "";
  submitBtn.disabled = true;

  const payload = {
    username: document.getElementById("username").value.trim(),
    password: document.getElementById("password").value
  };

  if (registerMode) {
    payload.confirm_password = confirmPassword.value;
  }

  try {
    const response = await fetch(registerMode ? "/api/register" : "/api/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      errorBox.textContent = "⚠️ " + (data.error || "Une erreur est survenue.");
      return;
    }

    window.location.href = "/";
  } catch (error) {
    errorBox.textContent = "⚠️ Impossible de contacter Xyro.AI.";
  } finally {
    submitBtn.disabled = false;
  }
});
