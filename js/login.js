/**
 * login.js
 * Handles the login form: sends Basic-auth credentials to the
 * Reboot01 signin endpoint, stores the returned JWT, and
 * redirects to profile.html on success.
 */

const SIGNIN_URL = "https://learn.reboot01.com/api/auth/signin";

const form      = document.getElementById("loginForm");
const msgEl     = document.getElementById("message");
const submitBtn = document.getElementById("submitBtn");
const toggleBtn = document.getElementById("togglePwd");
const pwdInput  = document.getElementById("password");

/* ── Toggle password visibility ── */
if (toggleBtn && pwdInput) {
  toggleBtn.addEventListener("click", () => {
    const show = pwdInput.type === "password";
    pwdInput.type = show ? "text" : "password";
    toggleBtn.setAttribute("aria-pressed", String(show));
    // Swap SVG: eye vs eye-off
    const eyeIcon = document.getElementById("eyeIcon");
    if (eyeIcon) {
      eyeIcon.innerHTML = show
        ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
           <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
           <line x1="1" y1="1" x2="23" y2="23"/>`
        : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
           <circle cx="12" cy="12" r="3"/>`;
    }
  });
}

/* ── Show status message ── */
function showMessage(text, type = "error") {
  msgEl.textContent = text;
  msgEl.className = `message ${type}`;
}

function clearMessage() {
  msgEl.textContent = "";
  msgEl.className = "message";
}

/* ── Set loading state ── */
function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle("loading", loading);
}

/* ── Handle form submission ── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    showMessage("Please enter your username/email and password.");
    return;
  }

  setLoading(true);

  try {
    const credentials = btoa(`${username}:${password}`);

    const res = await fetch(SIGNIN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      // Provide friendly messages for common HTTP codes
      if (res.status === 401 || res.status === 403) {
        showMessage("Invalid credentials. Please check your username/email and password.");
      } else {
        showMessage(`Login failed (${res.status}). ${errText || "Please try again."}`);
      }
      return;
    }

    // The endpoint returns the JWT as a plain string (may be quoted)
    let token = await res.text();
    token = token.replace(/^"|"$/g, "").trim(); // strip surrounding quotes if any

    if (!token) {
      showMessage("Received an empty token. Please try again.");
      return;
    }

    saveToken(token);
    showMessage("Login successful! Redirecting…", "success");
    setTimeout(() => {
      window.location.href = "profile.html";
    }, 600);

  } catch (err) {
    showMessage("Network error. Please check your connection and try again.");
    console.error("[login] fetch error:", err);
  } finally {
    setLoading(false);
  }
});

/* ── If already logged in, skip to profile ── */
if (getToken()) {
  window.location.href = "profile.html";
}
