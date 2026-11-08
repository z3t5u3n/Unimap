import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Sparkles,
  Eye,
  X,
  RotateCcw,
  Zap,
  Sliders,
  Cloud,
  Layers,
  Compass,
  Check,
  Flame,
  ShieldAlert,
  SlidersHorizontal
} from 'lucide-react';

export const AJUSTES_PREDETERMINADOS = {
  // Iluminación
  luzSolarIntensidad: 2.2,
  luzSolarColor: '#fff6ea',
  luzHemisfericaIntensidad: 0.75,
  luzAmbientalIntensidad: 0.35,
  exposicion: 1.05,
  horaDelDia: 'dia', // 'manana', 'mediodia', 'atardecer', 'noche'

  // Sombras
  sombrasHabilitadas: true,
  calidadSombras: 2048, // 1024, 2048, 4096
  sombrasSuaves: true,

  // Cielo y Atmósfera
  turbidezCielo: 8,
  rayleighCielo: 1.2,
  nieblaHabilitada: true,
  densidadNiebla: 0.0016,

  // Post-procesamiento
  modoUltra: true,
  gtaoHabilitado: true,
  gtaoIntensidad: 0.75,
  bloomHabilitado: true,
  bloomIntensidad: 0.22,

  // Navegación y Cámara
  velocidadRecorrido: 14, // m/s
  sensibilidadGiro: 0.22,
  fovBase: 60,
  mostrarFlecha3D: true,
  mostrarGizmosGrafos: false
};

export const PRESETS_CONFIG = {
  equilibrado: {
    id: 'equilibrado',
    nombre: 'Equilibrado PBR',
    icono: '✨',
    descripcion: 'Calibración fotográfica estándar de campus',
    ajustes: { ...AJUSTES_PREDETERMINADOS }
  },
  mediodia: {
    id: 'mediodia',
    nombre: 'Mediodía Radiante',
    icono: '☀️',
    descripcion: 'Sol cenital brillante y sombras cortas',
    ajustes: {
      luzSolarIntensidad: 3.0,
      luzSolarColor: '#ffffff',
      luzHemisfericaIntensidad: 0.95,
      luzAmbientalIntensidad: 0.45,
      exposicion: 1.15,
      horaDelDia: 'mediodia',
      turbidezCielo: 4,
      rayleighCielo: 0.8,
      densidadNiebla: 0.001
    }
  },
  atardecer: {
    id: 'atardecer',
    nombre: 'Atardecer Dorado',
    icono: '🌅',
    descripcion: 'Sombras alargadas y cálidos tonos ámbar',
    ajustes: {
      luzSolarIntensidad: 2.5,
      luzSolarColor: '#ff9d5c',
      luzHemisfericaIntensidad: 0.65,
      luzAmbientalIntensidad: 0.3,
      exposicion: 1.1,
      horaDelDia: 'atardecer',
      turbidezCielo: 14,
      rayleighCielo: 3.5,
      densidadNiebla: 0.0022,
      bloomIntensidad: 0.35
    }
  },
  noche: {
    id: 'noche',
    nombre: 'Noche / Crepúsculo',
    icono: '🌙',
    descripcion: 'Cielo azul noche y acento lumínico suave',
    ajustes: {
      luzSolarIntensidad: 0.6,
      luzSolarColor: '#60a5fa',
      luzHemisfericaIntensidad: 0.35,
      luzAmbientalIntensidad: 0.18,
      exposicion: 0.95,
      horaDelDia: 'noche',
      turbidezCielo: 18,
      rayleighCielo: 4.0,
      densidadNiebla: 0.0026,
      bloomIntensidad: 0.4
    }
  },
  rendimiento: {
    id: 'rendimiento',
    nombre: 'Modo 60 FPS',
    icono: '⚡',
    descripcion: 'Bajo consumo para móviles y portátiles antiguos',
    ajustes: {
      modoUltra: false,
      gtaoHabilitado: false,
      bloomHabilitado: false,
      calidadSombras: 1024,
      densidadNiebla: 0.0012
    }
  }
};

export default function PanelConfiguracionMapa({
  ajustes,
  onCambiarAjuste,
  onAplicarPreset,
  onRestablecer,
  onCerrar
}) {
  const [tabActiva, setTabActiva] = useState('iluminacion');

  const tabs = [
    { id: 'iluminacion', label: 'Iluminación', icon: <Sun size={15} /> },
    { id: 'sombras', label: 'Sombras', icon: <Layers size={15} /> },
    { id: 'atmosfera', label: 'Cielo y Niebla', icon: <Cloud size={15} /> },
    { id: 'efectos', label: 'Efectos PBR', icon: <Sparkles size={15} /> },
    { id: 'camara', label: 'Cámara y Guía', icon: <Compass size={15} /> }
  ];

  return (
    <div className="panelConfigOverlay" onClick={onCerrar}>
      <div
        className="panelConfigCard"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Configuración Gráfica del Mapa 3D"
      >
        {/* Cabecera */}
        <div className="panelConfigHeader">
          <div className="headerTituloGroup">
            <SlidersHorizontal size={20} color="#38bdf8" />
            <div>
              <h3>Configuración del Campus 3D</h3>
              <p>Personaliza iluminación, sombras, cielo y rendimiento en vivo</p>
            </div>
          </div>
          <button
            type="button"
            className="btnCerrarConfig"
            onClick={onCerrar}
            title="Cerrar panel de configuración"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sección de Presets Rápidos */}
        <div className="seccionPresetsRapidos">
          <span className="subtituloSeccion">Presets de Iluminación y Rendimiento</span>
          <div className="gridPresetsConfig">
            {Object.values(PRESETS_CONFIG).map((p) => (
              <button
                key={p.id}
                type="button"
                className="btnPresetItem"
                onClick={() => onAplicarPreset(p)}
                title={p.descripcion}
              >
                <span className="emojiPreset">{p.icono}</span>
                <span className="nombrePreset">{p.nombre}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pestañas de Navegación Temáticas */}
        <div className="tabsConfigGroup">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tabConfigBtn ${tabActiva === tab.id ? 'activa' : ''}`}
              onClick={() => setTabActiva(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Contenido de la Pestaña Activa */}
        <div className="tabContentConfig">
          {/* 1. ILUMINACIÓN */}
          {tabActiva === 'iluminacion' && (
            <div className="grupoControles">
              {/* Intensidad Luz Solar */}
              <div className="controlSliderGroup">
                <div className="sliderHeader">
                  <span className="sliderLabel">Luz Solar Directa</span>
                  <span className="sliderValue">{ajustes.luzSolarIntensidad.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="4.5"
                  step="0.1"
                  value={ajustes.luzSolarIntensidad}
                  onChange={(e) => onCambiarAjuste('luzSolarIntensidad', parseFloat(e.target.value))}
                  className="inputRangeCustom"
                />
              </div>

              {/* Tono / Temperatura del Sol */}
              <div className="controlSliderGroup">
                <div className="sliderHeader">
                  <span className="sliderLabel">Color y Calidez Solar</span>
                </div>
                <div className="grupoColoresSol">
                  {[
                    { nombre: 'Cálido Suave', color: '#fff6ea' },
                    { nombre: 'Blanco Neutro', color: '#ffffff' },
                    { nombre: 'Dorado Atardecer', color: '#ffb26b' },
                    { nombre: 'Crepúsculo Azul', color: '#7bb3ff' }
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      className={`btnMuestraColor ${ajustes.luzSolarColor === c.color ? 'seleccionado' : ''}`}
                      style={{ background: c.color }}
                      onClick={() => onCambiarAjuste('luzSolarColor', c.color)}
                      title={c.nombre}
                    >
                      {ajustes.luzSolarColor === c.color && <Check size={14} color="#0b1329" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Luz Hemisférica */}
              <div className="controlSliderGroup">
                <div className="sliderHeader">
                  <span className="sliderLabel">Luz Hemisférica (Cielo / Rebote)</span>
                  <span className="sliderValue">{ajustes.luzHemisfericaIntensidad.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={ajustes.luzHemisfericaIntensidad}
                  onChange={(e) => onCambiarAjuste('luzHemisfericaIntensidad', parseFloat(e.target.value))}
                  className="inputRangeCustom"
                />
              </div>

              {/* Luz Ambiental */}
              <div className="controlSliderGroup">
                <div className="sliderHeader">
                  <span className="sliderLabel">Luz Ambiental (Relleno de sombras)</span>
                  <span className="sliderValue">{ajustes.luzAmbientalIntensidad.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.2"
                  step="0.05"
                  value={ajustes.luzAmbientalIntensidad}
                  onChange={(e) => onCambiarAjuste('luzAmbientalIntensidad', parseFloat(e.target.value))}
                  className="inputRangeCustom"
                />
              </div>

              {/* Exposición ACES Filmic */}
              <div className="controlSliderGroup">
                <div className="sliderHeader">
                  <span className="sliderLabel">Exposición General (ACES Filmic)</span>
                  <span className="sliderValue">{ajustes.exposicion.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="2.2"
                  step="0.05"
                  value={ajustes.exposicion}
                  onChange={(e) => onCambiarAjuste('exposicion', parseFloat(e.target.value))}
                  className="inputRangeCustom"
                />
              </div>
            </div>
          )}

          {/* 2. SOMBRAS */}
          {tabActiva === 'sombras' && (
            <div className="grupoControles">
              {/* Conmutador Proyección de Sombras */}
              <div className="controlToggleGroup">
                <div className="toggleTexts">
                  <span className="toggleLabel">Sombras en Tiempo Real</span>
                  <span className="toggleDesc">Proyección física de los edificios y árboles</span>
                </div>
                <label className="switchToggle">
                  <input
                    type="checkbox"
                    checked={ajustes.sombrasHabilitadas}
                    onChange={(e) => onCambiarAjuste('sombrasHabilitadas', e.target.checked)}
                  />
                  <span className="switchSlider" />
                </label>
              </div>

              {/* Calidad / Resolución de Sombras */}
              <div className="controlSliderGroup">
                <div className="sliderHeader">
                  <span className="sliderLabel">Resolución del Mapa de Sombras</span>
                  <span className="sliderValue">{ajustes.calidadSombras}px</span>
                </div>
                <div className="grupoBotonesOpcion">
                  {[
                    { valor: 1024, label: '1024 (Rápido)' },
                    { valor: 2048, label: '2048 (HD Nítido)' },
                    { valor: 4096, label: '4096 (Ultra 4K)' }
                  ].map((res) => (
                    <button
                      key={res.valor}
                      type="button"
                      className={`btnOpcionPill ${ajustes.calidadSombras === res.valor ? 'activa' : ''}`}
                      onClick={() => onCambiarAjuste('calidadSombras', res.valor)}
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suavizado PCF Soft */}
              <div className="controlToggleGroup">
                <div className="toggleTexts">
                  <span className="toggleLabel">Filtrado Suave (PCF Soft Shadow)</span>
                  <span className="toggleDesc">Bordes difuminados naturales en el suelo</span>
                </div>
                <label className="switchToggle">
                  <input
                    type="checkbox"
                    checked={ajustes.sombrasSuaves}
                    onChange={(e) => onCambiarAjuste('sombrasSuaves', e.target.checked)}
                  />
                  <span className="switchSlider" />
                </label>
              </div>
            </div>
          )}

          {/* 3. ATMÓSFERA Y CIELO */}
          {tabActiva === 'atmosfera' && (
            <div className="grupoControles">
              {/* Turbidez */}
              <div className="controlSliderGroup">
                <div className="sliderHeader">
                  <span className="sliderLabel">Turbidez Atmosférica (Polvo / Calima)</span>
                  <span className="sliderValue">{ajustes.turbidezCielo}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={ajustes.turbidezCielo}
                  onChange={(e) => onCambiarAjuste('turbidezCielo', parseInt(e.target.value, 10))}
                  className="inputRangeCustom"
                />
              </div>

              {/* Dispersión Rayleigh */}
              <div className="controlSliderGroup">
                <div className="sliderHeader">
                  <span className="sliderLabel">Dispersión Rayleigh (Azul del Cielo)</span>
                  <span className="sliderValue">{ajustes.rayleighCielo.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="4.0"
                  step="0.1"
                  value={ajustes.rayleighCielo}
                  onChange={(e) => onCambiarAjuste('rayleighCielo', parseFloat(e.target.value))}
                  className="inputRangeCustom"
                />
              </div>

              {/* Conmutador Niebla */}
              <div className="controlToggleGroup">
                <div className="toggleTexts">
                  <span className="toggleLabel">Niebla de Profundidad (FogExp2)</span>
                  <span className="toggleDesc">Sensación de escala y lejanía en el horizonte</span>
                </div>
                <label className="switchToggle">
                  <input
                    type="checkbox"
                    checked={ajustes.nieblaHabilitada}
                    onChange={(e) => onCambiarAjuste('nieblaHabilitada', e.target.checked)}
                  />
                  <span className="switchSlider" />
                </label>
              </div>

              {/* Densidad de la Niebla */}
              {ajustes.nieblaHabilitada && (
                <div className="controlSliderGroup">
                  <div className="sliderHeader">
                    <span className="sliderLabel">Densidad de Niebla</span>
                    <span className="sliderValue">{(ajustes.densidadNiebla * 10000).toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0004"
                    max="0.0050"
                    step="0.0002"
                    value={ajustes.densidadNiebla}
                    onChange={(e) => onCambiarAjuste('densidadNiebla', parseFloat(e.target.value))}
                    className="inputRangeCustom"
                  />
                </div>
              )}
            </div>
          )}

          {/* 4. EFECTOS PBR (CYCLES / EEVEE) */}
          {tabActiva === 'efectos' && (
            <div className="grupoControles">
              {/* Conmutador General Modo Ultra */}
              <div className="controlToggleGroup">
                <div className="toggleTexts">
                  <span className="toggleLabel">Pipeline Post-Procesado Ultra</span>
                  <span className="toggleDesc">Pases de Ambient Occlusion (GTAO) y Bloom HDR</span>
                </div>
                <label className="switchToggle">
                  <input
                    type="checkbox"
                    checked={ajustes.modoUltra}
                    onChange={(e) => onCambiarAjuste('modoUltra', e.target.checked)}
                  />
                  <span className="switchSlider" />
                </label>
              </div>

              {/* GTAO Ambient Occlusion */}
              <div className="controlToggleGroup">
                <div className="toggleTexts">
                  <span className="toggleLabel">Oclusión Ambiental (GTAO Contact Shadows)</span>
                  <span className="toggleDesc">Sombras profundas en rincones y uniones de muros</span>
                </div>
                <label className="switchToggle">
                  <input
                    type="checkbox"
                    checked={ajustes.gtaoHabilitado}
                    disabled={!ajustes.modoUltra}
                    onChange={(e) => onCambiarAjuste('gtaoHabilitado', e.target.checked)}
                  />
                  <span className="switchSlider" />
                </label>
              </div>

              {ajustes.modoUltra && ajustes.gtaoHabilitado && (
                <div className="controlSliderGroup">
                  <div className="sliderHeader">
                    <span className="sliderLabel">Intensidad de Oclusión (AO)</span>
                    <span className="sliderValue">{ajustes.gtaoIntensidad.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.05"
                    value={ajustes.gtaoIntensidad}
                    onChange={(e) => onCambiarAjuste('gtaoIntensidad', parseFloat(e.target.value))}
                    className="inputRangeCustom"
                  />
                </div>
              )}

              {/* Bloom HDR */}
              <div className="controlToggleGroup">
                <div className="toggleTexts">
                  <span className="toggleLabel">Resplandor HDR (UnrealBloom)</span>
                  <span className="toggleDesc">Brillo suave en reflejos metálicos y línea de ruta 3D</span>
                </div>
                <label className="switchToggle">
                  <input
                    type="checkbox"
                    checked={ajustes.bloomHabilitado}
                    disabled={!ajustes.modoUltra}
                    onChange={(e) => onCambiarAjuste('bloomHabilitado', e.target.checked)}
                  />
                  <span className="switchSlider" />
                </label>
              </div>

              {ajustes.modoUltra && ajustes.bloomHabilitado && (
                <div className="controlSliderGroup">
                  <div className="sliderHeader">
                    <span className="sliderLabel">Intensidad Bloom</span>
                    <span className="sliderValue">{ajustes.bloomIntensidad.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.8"
                    step="0.03"
                    value={ajustes.bloomIntensidad}
                    onChange={(e) => onCambiarAjuste('bloomIntensidad', parseFloat(e.target.value))}
                    className="inputRangeCustom"
                  />
                </div>
              )}
            </div>
          )}

          {/* 5. CÁMARA Y NAVEGACIÓN */}
          {tabActiva === 'camara' && (
            <div className="grupoControles">
              {/* Velocidad de avance */}
              <div className="controlSliderGroup">
                <div className="sliderHeader">
                  <span className="sliderLabel">Velocidad de Avance en Recorridos</span>
                  <span className="sliderValue">{ajustes.velocidadRecorrido} m/s</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="28"
                  step="1"
                  value={ajustes.velocidadRecorrido}
                  onChange={(e) => onCambiarAjuste('velocidadRecorrido', parseInt(e.target.value, 10))}
                  className="inputRangeCustom"
                />
              </div>

              {/* Sensibilidad de Giro 360° */}
              <div className="controlSliderGroup">
                <div className="sliderHeader">
                  <span className="sliderLabel">Sensibilidad de Giro 360° (Ratón / Táctil)</span>
                  <span className="sliderValue">{ajustes.sensibilidadGiro.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.50"
                  step="0.02"
                  value={ajustes.sensibilidadGiro}
                  onChange={(e) => onCambiarAjuste('sensibilidadGiro', parseFloat(e.target.value))}
                  className="inputRangeCustom"
                />
              </div>

              {/* FOV Base */}
              <div className="controlSliderGroup">
                <div className="sliderHeader">
                  <span className="sliderLabel">Campo de Visión Base (FOV)</span>
                  <span className="sliderValue">{ajustes.fovBase}°</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="78"
                  step="2"
                  value={ajustes.fovBase}
                  onChange={(e) => onCambiarAjuste('fovBase', parseInt(e.target.value, 10))}
                  className="inputRangeCustom"
                />
              </div>

              {/* Mostrar Flecha 3D */}
              <div className="controlToggleGroup">
                <div className="toggleTexts">
                  <span className="toggleLabel">Flecha 3D de Paso Manual</span>
                  <span className="toggleDesc">Permite hacer clic para avanzar paso a paso por los POIs</span>
                </div>
                <label className="switchToggle">
                  <input
                    type="checkbox"
                    checked={ajustes.mostrarFlecha3D}
                    onChange={(e) => onCambiarAjuste('mostrarFlecha3D', e.target.checked)}
                  />
                  <span className="switchSlider" />
                </label>
              </div>

              {/* Mostrar Red de Grafos */}
              <div className="controlToggleGroup">
                <div className="toggleTexts">
                  <span className="toggleLabel">Gizmos de Red de Grafos (POIs)</span>
                  <span className="toggleDesc">Visualizar los 2.407 nodos y aristas de conexión en el suelo</span>
                </div>
                <label className="switchToggle">
                  <input
                    type="checkbox"
                    checked={ajustes.mostrarGizmosGrafos}
                    onChange={(e) => onCambiarAjuste('mostrarGizmosGrafos', e.target.checked)}
                  />
                  <span className="switchSlider" />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Pie de Panel con botón de restablecimiento */}
        <div className="panelConfigFooter">
          <button
            type="button"
            className="btnRestablecerConfig"
            onClick={onRestablecer}
            title="Volver a los valores calibrados por defecto"
          >
            <RotateCcw size={15} />
            <span>Restablecer Predeterminados</span>
          </button>
          <button
            type="button"
            className="btnListoConfig"
            onClick={onCerrar}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
