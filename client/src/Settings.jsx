import ChintsCat, { CAT_BREEDS } from "./ChintsCat.jsx";
import { BackLink, PageHead } from "./components.jsx";
import { Icon, useApp } from "./ui.jsx";

const THEMES = [
  { value: "light", label: "Light", icon: "sun", text: "Bright background, best in daylight." },
  { value: "dark", label: "Dark", icon: "moon", text: "Dark background, easier on the eyes at night." },
  { value: "system", label: "Automatic", icon: "monitor", text: "Follow your device's light/dark setting." }
];

export default function Settings() {
  const { user, themePref, setThemePref, accent, setAccent, accents, catBreed = "ginger", setCatBreed } = useApp();
  return (
    <div className="page">
      <BackLink to="/">Dashboard</BackLink>
      <PageHead eyebrow="Preferences" title="Settings & Theme" subtitle="Personalise your theme, accent colour, and your Chints virtual cat companion." />

      <section className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card-title" style={{ marginBottom: 0 }}><h2><Icon name="sun" size={20} /> Theme</h2></div>
        <div className="theme-grid" role="radiogroup" aria-label="Theme">
          {THEMES.map((theme) => (
            <button key={theme.value} type="button" role="radio" aria-checked={themePref === theme.value}
              className={themePref === theme.value ? "theme-option selected" : "theme-option"} onClick={() => setThemePref(theme.value)}>
              <span className={`theme-preview ${theme.value}`} aria-hidden="true"><i /><i /><i /></span>
              <span className="row" style={{ gap: 8 }}><Icon name={theme.icon} size={17} /> <b>{theme.label}</b></span>
              <small className="text-muted">{theme.text}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card-title" style={{ marginBottom: 0 }}><h2><Icon name="palette" size={20} /> Accent colour</h2></div>
        <div className="accent-grid" role="radiogroup" aria-label="Accent colour">
          {Object.entries(accents).map(([key, value]) => (
            <button key={key} type="button" role="radio" aria-checked={accent === key}
// Stage 1
