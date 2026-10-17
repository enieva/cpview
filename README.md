# Check Point VSX CPView - Dashboard de Analítica y Diagnóstico

Aplicación web interactiva desarrollada para analizar, explorar y visualizar los datos de rendimiento, tráfico y eventos de seguridad contenidos en la base de datos SQLite de **Check Point CPView** (`SG_FWNET-ch01-01_2_4_2024_16_27.CPViewDB.dat`, ~1.34 GB).

---

## 🎯 Características Principales

1. **Diseño Dashboard Ejecutivo (Dark Theme)**:
   - Estética inspirada en consolas de ciberseguridad corporativas con modo oscuro, tarjetas de métricas tipo KPI (Glassmorphism), gradientes armoniosos y micro-animaciones.
   - Navegación lateral persistente en la **columna izquierda** con badges de estado y contadores en tiempo real.
   - Gráficos interactivos de series temporales (Chart.js) con tooltips precisos, zoom por rango de fechas (7D, 14D, 30D) y visualización multi-eje.

2. **Resolución Automática del Diccionario CPView**:
   - Mapeo automático de los identificadores enteros internos de CPView contra la tabla maestra `cpview_ref_table` (nombres de interfaces, subredes IPv4/IPv6, códigos de versión Gaia R81.10 Take 28, razones de descarte de paquetes, roles de cores CoreXL vs SND).

3. **Soporte Multi-Máquina Dinámico (Carga de Otros Ficheros)**:
   - Botón en cabecera **"📂 Cargar Otra Máquina / BD"** que permite analizar y conmutar entre bases de datos de diferentes firewalls o nodos VSX.
   - **Detección automática** de ficheros `.CPViewDB.dat` o `.sqlite` en el directorio.
   - **Subida directa desde el navegador (Drag & Drop)** con barra de progreso en tiempo real para ficheros de cualquier tamaño.
   - **Carga por ruta en el servidor**: Posibilidad de indicar cualquier ruta absoluta de la máquina local.
   - Extracción y caché automática bajo demanda sin reiniciar la aplicación.

4. **Arquitectura de Alto Rendimiento (1.34 GB SQLite)**:
   - Extracción y pre-agregación horaria de las 42,862 muestras (30 días ininterrumpidos) en `data/cpview_data.json` (1.35 MB), garantizando carga instantánea a 60 FPS en el navegador sin bloquear el sistema.
   - Servidor backend liviano en Python (`server.py`) que provee una **API REST de solo lectura** para paginación dinámica de tablas gigantescas y ejecución de consultas SQL personalizadas directamente desde la aplicación.

5. **Escalado Integral de la Interfaz y Tipografía**:
   - **Selector de Escala en Cabecera (`🔍 100%`)**: Permite ajustar la escala global de la interfaz (**Zoom UI** de 70% a 150%) con botones incrementales (+/-), deslizador continuo y presets rápidos (80%, 90%, 100%, 110%, 125%, 140%).
   - **Escalado Proporcional de Fuentes (Tamaño de Letra)**: Control independiente (80% a 140%) con botones `A-` / `A+`, selector continuo y presets para adaptar tablas, textos y KPIs a cualquier monitor (laptops, pantallas 4K o videowall SOC).
   - **Selector de Familias Tipográficas (Tipos de Letra)**: Permite alternar entre **Inter**, **Roboto**, **Sistema Nativo (Segoe UI / SF Pro)**, **JetBrains Mono (Terminal SOC)** y **Atkinson Hyperlegible (Alta Legibilidad)**.
   - **Sincronización Total con Gráficos (Chart.js)**: Los tamaños y familias de fuentes de leyendas, ejes y tooltips se actualizan dinámicamente y se redibujan sin pérdida de nitidez.
   - **Atajos de Teclado y Notificaciones Toast**: Soporte interactivo para <kbd>Ctrl</kbd>+<kbd>+</kbd> / <kbd>Ctrl</kbd>+<kbd>-</kbd> y <kbd>Ctrl</kbd>+<kbd>0</kbd> (restablecer a 100%).
   - **Persistencia en LocalStorage**: Mantiene la configuración entre sesiones y recargas sin parpadeos.

---

## 📑 Secciones del Menú Lateral (Páginas Disponibles)

| Sección | Icono | Descripción y Métricas Clave |
|---|:---:|---|
| **Resumen Ejecutivo** | 📊 | Tarjetas KPI de Throughput (Avg ~16.3 Gbps, Pico ~1.27 Tbps), Conexiones concurrentes (~400k), Caídas acumuladas (~126M), estado del nodo, uptime de 119 días y almacenamiento. |
| **Sistema y CPU** | 🖥️ | Desglose de arquitectura multinúcleo: Cores SND (0, 2) vs CoreXL FW Workers (1, 3), consumo de CPU individual, memoria RAM (15.4 GB, 33.1% usada), swap y parámetros de kernel. |
| **Interfaces de Red** | 🌐 | Catálogo de las 57 interfaces (Bonds `bond1` y `bond2` de 20G, Interfaces físicas de fibra 10G `eth1-13`, `eth2-13`, VLANs 802.1Q con sus subredes IPv4), comparativa gráfica de Throughput pico Rx/Tx y filtros interactivos. |
| **Tráfico y Conexiones** | 🛡️ | Evolución temporal de conexiones concurrentes en Firewall (`FW`), `Host SXL` y `Host Streaming`, desglose de estados TCP (Establecidas, Handshake, No-TCP) y tasa de nuevas conexiones por segundo (hasta 396k conns/sec). |
| **Descartes y Drops** | 🚫 | Análisis profundo de razones de descarte (`Rulebase`: 124.4M caídas, `General PSL`: 2.03M, `General FnA`: 136k, `Anti-Spoofing PPAK`: 21M, `Drop Templates`: 14.3M) y evolución horaria. |
| **Flow Profiler (CPU)** | 🌊 | Distribución de ciclos de CPU por protocolo/puerto L4 (`TCP:1024`, `UDP:53 DNS`, `UDP:161 SNMP`, `TCP:445 SMB`, `TCP:443 HTTPS`) y por módulo de inspección (`Chain modules`, `Inbound F2F`, `Inspect`, `SXL notifications`, `PSL engine`). |
| **SecureXL & CoreXL** | ⚡ | Estado de aceleración por hardware/kernel, razones de paso F2V (*Forward-to-Virtual*), colas de *Enqueue Fails* de Multik Dispatcher y Throughput acelerado PPAK VS0. |
| **Spike Detective** | 🔍 | Diagnóstico forense de picos de CPU y threads. Incluye **selector de nivel mínimo de alarma** (Todos, Moderado ≥75%, Alto ≥80%, Crítico ≥90%), alternador de visualización temporal (**Barras** vs **Línea / Área**), distribución por Cores, top procesos/hilos y registro filtrable. |
| **VPN & Blades** | 🔐 | Métricas de túneles VPN IPsec e IKE SAs, estadísticas de SSL Inspection (TLS 1.2 y TLS 1.3), categorización SNI de URL Filtering y tasa de logging de Log Tracker. |
| **Explorador SQLite** | 🗄️ | Catálogo navegable de las **122 tablas activas** en la base de datos con número de registros, esquema de columnas, visor modal de registros en vivo con paginación y consola de ejecución SQL directa. |

---

## 🚀 Cómo Ejecutar la Aplicación

### Opción 1: Servidor Integrado (Recomendada con API y SQL en vivo)
El servidor Python ya incluye la API REST para consultar cualquier tabla y ejecutar SQL:

```bash
# Iniciar el servidor en el puerto 8080 (o el puerto que elijas)
python3 server.py 8080
```

Luego abre tu navegador en:
👉 **[http://localhost:8080](http://localhost:8080)**

### Opción 2: Abrir Estáticamente
También puedes servir los ficheros estáticos con cualquier servidor web HTTP:

```bash
python3 -m http.server 8080
```
O abrir directamente `index.html` en tu navegador.

---

## 📁 Estructura del Proyecto

- `SG_FWNET-ch01-01_2_4_2024_16_27.CPViewDB.dat`: Base de datos SQLite original Check Point CPView (1.34 GB).
- `index.html`: Estructura semántica, menú lateral, vistas de cada sección y modal visor de tablas.
- `styles.css`: Hoja de estilos con variables CSS, dark mode, flex/grid responsivo y badges.
- `app.js`: Lógica de renderizado, controladores de gráficos Chart.js, filtros, ordenación y buscador.
- `extract_cpview.py`: Script de procesamiento y agregación de la base de datos SQLite a formato JSON optimizado.
- `server.py`: Servidor web ligero con API de lectura y ejecución SQL segura.
- `data/cpview_data.json`: Dataset estructurado y agregado con series temporales y catálogo (1.35 MB).
- `assets/chart.umd.min.js`: Librería de gráficos local para funcionamiento 100% offline.
