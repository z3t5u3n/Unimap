import React, { useState, useEffect } from "react";
import "../../CSS/global.css";
import "../../CSS/header.css";

function Header() {
  const [tema, setTema] = useState(() => {
    return localStorage.getItem("unimap_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema);
    localStorage.setItem("unimap_theme", tema);
    window.dispatchEvent(new CustomEvent("unimap_theme_changed", { detail: { tema } }));
  }, [tema]);

  const toggleTema = () => {
    setTema((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <header className="ContenedorHeader">
      <div className="headerLeft">
        <div className="headerLogo">
          <span className="Uni">Uni</span>
          <span className="Map">Map</span>
        </div>
      </div>

      <div className="headerRight">
        <button
          type="button"
          className="btnThemeToggle"
          onClick={toggleTema}
          title={tema === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label="Cambiar tema de color"
        >
          <span className="themeIcon">{tema === "dark" ? "☀️" : "🌙"}</span>
          <span className="themeText">{tema === "dark" ? "Modo Claro" : "Modo Oscuro"}</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
