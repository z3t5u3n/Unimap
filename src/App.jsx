import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const Login = lazy(() => import('./pages/Login'));
const Registro = lazy(() => import('./pages/Registro'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const Admin = lazy(() => import('./pages/Admin'));
const Interfaz = lazy(() => import('./pages/Interfaz'));

function CargandoRuta() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a0f1d',
      color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, sans-serif',
      gap: '14px'
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        border: '3px solid rgba(56, 189, 248, 0.2)',
        borderTop: '3px solid #38bdf8',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: '0.88rem', letterSpacing: '0.04em', color: '#94a3b8' }}>Cargando UniMap...</span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<CargandoRuta />}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/interfaz" element={<Interfaz />} />
          <Route path="/mapa" element={<Interfaz />} />
          {/* Redirección por defecto */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
