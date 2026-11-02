import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import reportWebVitals from './reportWebVitals';
import Login from "./Pages/Login";
import Interfaz from './Pages/Interfaz';

// Code-splitting: separar módulos secundarios pesados (Admin incluye chart.js, jspdf, etc.)
// para que el mapa 3D y la vista principal carguen inmediatamente sin descargar librerías innecesarias
const Registro = lazy(() => import('./Pages/Registro'));
const Admin = lazy(() => import('./Pages/Admin'));
const VerificarRol = lazy(() => import('./Pages/VerificarRol'));

// Protección global para que Unity WebGL nunca capture ni bloquee el teclado en campos de texto
const liberarTecladoGlobal = (e) => {
  const target = e.target;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }
  }
};

window.addEventListener('keydown', liberarTecladoGlobal, true);
window.addEventListener('keyup', liberarTecladoGlobal, true);
window.addEventListener('keypress', liberarTecladoGlobal, true);
document.addEventListener('keydown', liberarTecladoGlobal, true);
document.addEventListener('keyup', liberarTecladoGlobal, true);
document.addEventListener('keypress', liberarTecladoGlobal, true);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <Suspense
        fallback={
          <div
            style={{
              width: "100vw",
              height: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0f172a",
              color: "#f8fafc",
              fontSize: "15px",
              fontWeight: 500,
            }}
          >
            Cargando UniMap...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/Interfaz" element={<Interfaz />} />
          <Route path="/Registro" element={<Registro />} />
          <Route path="/Admin" element={<Admin />} />
          <Route path="/VerificarRol" element={<VerificarRol />} />
        </Routes>
      </Suspense>
    </Router>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
