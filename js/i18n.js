import { translations } from "./translations.js";

export let currentLang = "es"; // Default

export function getCurrentLang() {
  return currentLang;
}

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem("jigsudo_lang", lang);
    updateTexts();
    updateLanguageSelector(lang);

    // Dispatch event for other modules (like date renderer)
    window.dispatchEvent(
      new CustomEvent("languageChanged", { detail: { lang } }),
    );
  }
}

export function initLanguage() {
  // 1. Check LocalStorage
  const savedLang = localStorage.getItem("jigsudo_lang");

  if (savedLang && translations[savedLang]) {
    currentLang = savedLang;
  } else {
    // 2. Check Browser
    const browserLang = navigator.language.split("-")[0]; // 'es-ES' -> 'es'
    if (translations[browserLang]) {
      currentLang = browserLang;
    } else {
      currentLang = "es"; // Fallback
    }
  }

  // Initialize UI
  setLanguage(currentLang);
  setupLanguageSelectorListener();
}

function updateTexts() {
  const t = translations[currentLang];

  // 1. Text Content
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });

  // 2. Inner HTML (for rich text)
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (t[key]) el.innerHTML = t[key];
  });

  // 3. Aria Labels (for icon buttons)
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (t[key]) el.setAttribute("aria-label", t[key]);
  });
}

function updateLanguageSelector(lang) {
  const select = document.getElementById("language-select");
  if (select) {
    select.value = lang;
  }
}

function setupLanguageSelectorListener() {
  const select = document.getElementById("language-select");
  if (select) {
    select.addEventListener("change", (e) => {
      setLanguage(e.target.value);
    });
    // Prevent closing dropdown when clicking select (optional, but consistent)
    select.addEventListener("click", (e) => e.stopPropagation());
  }
}
