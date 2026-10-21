/**
 * Check Point VSX CPView Analytics Dashboard - Internationalization (i18n) Engine
 * Supported Languages:
 *   - 'es': Español (Castellano - Predeterminado)
 *   - 'en': English (International)
 *   - 'pt': Português (Brasil / Portugal)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'cpview_lang';
  const DEFAULT_LANG = 'es';
  const SUPPORTED_LANGS = ['es', 'en', 'pt'];

  // Detect or restore saved language
  function getInitialLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_LANGS.includes(saved)) {
        return saved;
      }
      // Check browser navigator language
      const navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (navLang.startsWith('pt')) return 'pt';
      if (navLang.startsWith('en')) return 'en';
      if (navLang.startsWith('es')) return 'es';
    } catch (e) {}
    return DEFAULT_LANG;
  }

  let currentLang = getInitialLang();

  // Translations Dictionary
  const I18N = {
    es: {
      // Language Selector
      'lang.select_language': 'Idioma / Language',
      'lang.es_name': 'Español',
      'lang.es_desc': 'Castellano (Predeterminado)',
      'lang.en_name': 'English',
      'lang.en_desc': 'English (International)',
      'lang.pt_name': 'Português',
      'lang.pt_desc': 'Português (Brasil / Portugal)',

      // Sidebar
      'sidebar.node_active': 'Nodo Activo',
      'sidebar.cores_count': '4 Cores',
      'sidebar.sec_diag': 'Diagnóstico y Salud',
      'sidebar.nav_diagnostics': 'Análisis de Problemas',
      'sidebar.badge_anomalies': '8 Alertas',
      'sidebar.sec_monitor': 'Monitorización General',
      'sidebar.nav_overview': 'Resumen Ejecutivo',
      'sidebar.nav_system': 'Sistema y CPU',
      'sidebar.badge_cores': '4 Cores',
      'sidebar.nav_interfaces': 'Interfaces de Red',
      'sidebar.badge_ifs': '50+ IFs',
      'sidebar.sec_traffic': 'Tráfico e Inspección',
      'sidebar.nav_traffic': 'Tráfico y Conexiones',
      'sidebar.badge_conns': '400k',
      'sidebar.nav_drops': 'Descartes y Drops',
      'sidebar.badge_drops': '124M',
      'sidebar.nav_flofiler': 'Flow Profiler (CPU)',
      'sidebar.nav_securexl': 'SecureXL & CoreXL',
      'sidebar.sec_blades': 'Diagnóstico y Blades',
      'sidebar.nav_spikes': 'Spike Detective',
      'sidebar.badge_spikes': '1.9k',
      'sidebar.nav_blades': 'VPN & Blades',
      'sidebar.nav_db_explorer': 'Explorador SQLite',
      'sidebar.badge_tables': '122 Tablas',
      'sidebar.footer_os': 'Check Point Gaia 64-bit',
      'sidebar.footer_take': 'Take 28',

      // Top Header
      'header.node_label': 'Máquina:',
      'header.uptime_label': 'Uptime:',
      'header.cluster_label': 'Cluster:',
      'header.btn_theme_title': 'Seleccionar tema visual de alto contraste',
      'header.btn_scale_title': 'Ajustar escala del interfaz y tipografía',
      'header.btn_chart_builder': 'Creador de Gráficos',
      'header.btn_chart_builder_title': 'Abrir creador de gráficos personalizados para cualquier tabla',
      'header.btn_load_db': 'Cargar Otra Máquina / BD',
      'header.btn_export_json': 'Exportar JSON',
      'header.days_suffix': 'días',

      // Page Titles
      'title.diagnostics': '<span>🚨</span> Diagnóstico y Análisis de Problemas e Incidentes',
      'title.overview': '<span>📊</span> Resumen Ejecutivo del Gateway',
      'title.system': '<span>🖥️</span> Arquitectura de Sistema, CPU y Memoria',
      'title.interfaces': '<span>🌐</span> Catálogo y Rendimiento de Interfaces de Red',
      'title.traffic': '<span>🛡️</span> Conexiones y Tasas de Tráfico Firewall',
      'title.drops': '<span>🚫</span> Análisis Detallado de Descartes (Drop Reasons)',
      'title.spikes': '<span>🔍</span> Spike Detective - Diagnóstico de Procesos',
      'title.flofiler': '<span>🌊</span> Flow Profiler - Distribución de Ciclos CPU',
      'title.securexl': '<span>⚡</span> SecureXL y Aceleración CoreXL',
      'title.blades': '<span>🔐</span> Software Blades, VPN y Conexiones Seguras',
      'title.db_explorer': '<span>🗄️</span> Explorador de Tablas y Consultas SQLite',

      // Theme Selector Menu
      'theme.header': 'Temas de Alto Contraste',
      'theme.default_name': 'Cyber Dark (Original)',
      'theme.default_desc': 'Oscuro Check Point con cian',
      'theme.gold_name': 'Obsidian & Gold',
      'theme.gold_desc': 'Negro azabache con oro y ámbar',
      'theme.emerald_name': 'Matrix Emerald',
      'theme.emerald_desc': 'Verde esmeralda neón NOC/SOC',
      'theme.sapphire_name': 'Midnight Sapphire',
      'theme.sapphire_desc': 'Azul real profundo con hielo',
      'theme.violet_name': 'Neon Violet',
      'theme.violet_desc': 'Amatista cósmico con magenta',
      'theme.monochrome_name': 'Monochrome OLED',
      'theme.monochrome_desc': 'Negro puro y blanco máximo contraste',
      'theme.light_name': 'Solarized Light',
      'theme.light_desc': 'Modo claro nítido de alto contraste',

      // Scale & Font Menu
      'scale.header': 'Escala y Tipografía',
      'scale.reset_btn': '↺ Restablecer',
      'scale.reset_title': 'Restablecer valores por defecto (100%)',
      'scale.zoom_title': '🖥️ Escala Interfaz (Zoom)',
      'scale.zoom_dec': 'Reducir zoom',
      'scale.zoom_inc': 'Aumentar zoom',
      'scale.font_title': '🔤 Tamaño de Letra',
      'scale.font_dec': 'Reducir tamaño de letra',
      'scale.font_inc': 'Aumentar tamaño de letra',
      'scale.family_title': '🖋️ Tipo de Letra',
      'scale.family_inter_desc': 'Predeterminada Check Point',
      'scale.family_roboto_desc': 'Limpia y moderna',
      'scale.family_system_name': 'Sistema Nativo',
      'scale.family_system_desc': 'Segoe UI / SF Pro / Ubuntu',
      'scale.family_mono_desc': 'Modo terminal técnico SOC',
      'scale.family_dyslexic_name': 'Alta Legibilidad',
      'scale.family_dyslexic_desc': 'Atkinson Hyperlegible / Accesible',
      'scale.shortcuts_tip': '⌨️ Atajos: <kbd>Ctrl</kbd>+<kbd>+</kbd>/<kbd>-</kbd> Zoom · <kbd>Ctrl</kbd>+<kbd>0</kbd> 100%',

      // Diagnostics Hero
      'diag.hero_score_label': 'Salud / 100',
      'diag.hero_title': '<span>🚨</span> Diagnóstico Forense de Problemas y Confluencia Temporal',
      'diag.hero_desc': 'Auditoría automatizada de los datos de rendimiento de CPView (1.34 GB, 722 horas y 126.8M descartes). Se detecta <strong>confluencia crítica de indicadores</strong>: saturación periódica del CoreXL Worker #1, ráfagas de 396k conexiones/s y más de 5.8 billones de descartes por desbordamiento de cola en SecureXL.',
      'diag.pill_crit_num': '3 Críticos',
      'diag.pill_crit_label': 'Severidad Alta',
      'diag.pill_high_num': '4 Altos',
      'diag.pill_high_label': 'Riesgo Operativo',
      'diag.pill_slots_label': 'Franjas Confluentes',
      'diag.pill_cyclic_num': '2 Cíclicos',
      'diag.pill_cyclic_label': 'Patrones Diarios',

      // Diagnostics Problem Cards Section
      'diag.audit_title': '<span>🔍</span> Auditoría Sistemática de Problemas Detectados en las Tablas',
      'diag.audit_subtitle': 'Análisis multivariable de cuellos de botella en CPU, colas SecureXL, enlaces de red y descartes',
      'diag.badge_critical': 'Crítico',
      'diag.badge_high': 'Alto',
      'diag.badge_recurrent': 'Recurrente',
      'diag.badge_info': 'Informativo',
      'diag.evidence_label': 'Evidencia en tablas:',
      'diag.confluence_label': 'Confluencia Temporal:',
      'diag.rootcause_label': 'Causa Raíz & Solución:',

      // Problem Card 1
      'diag.p1_title': 'Saturación y Desequilibrio en CoreXL FW Worker #1 (fwk0_1)',
      'diag.p1_evidence': 'Core 1 acumula <strong>898 picos de CPU</strong> en Spike Detective (45.4% del total), con picos sostenidos del <strong>100%</strong> y duraciones de hasta <strong>7,711s (2.1 horas)</strong>. Los cores SND (0 y 2) promedian solo 11% de CPU.',
      'diag.p1_chip1': '🔴 CPU Core 1: 100%',
      'diag.p1_chip2': '🟣 Conn Rate: 396k/s',
      'diag.p1_chip3': '🔵 Tráfico F2F',
      'diag.p1_remedy': 'Desbalanceo de afinidad en CoreXL Dispatcher. Las conexiones pesadas no se reparten uniformemente.',

      // Problem Card 2
      'diag.p2_title': 'Colapso de Despachador SecureXL: 5.83B Enqueue Fails F2P',
      'diag.p2_evidence': '<code>fwmultik_dispatcher_vs_stats_enqueue_fail...</code> registra <strong>5,835,841,087 fallos F2P</strong> hacia espacio de usuario y <strong>43.7M fallos Inbound</strong>. Hay 123M paquetes no acelerados por <code>Inspect handler</code>.',
      'diag.p2_chip1': '🔴 F2P Drops: 5.83B',
      'diag.p2_chip2': '🔴 Worker Starvation',
      'diag.p2_chip3': '🔵 Slow Path Burst',
      'diag.p2_remedy': 'Desborde en colas de despachador hacia userspace. Aumentar el tamaño del buffer y optimizar plantillas SecureXL.',

      // Problem Card 3
      'diag.p3_title': 'Ráfagas Masivas de Nuevas Conexiones (Hasta 396k conns/s)',
      'diag.p3_evidence': 'La tasa de establecimiento se dispara de ~10k a <strong>396,498 conns/s</strong> (aumento del 3,800%), coincidiendo con picos de conexiones en estado <code>tcp_handshake</code> y saturación de cores de firewall.',
      'diag.p3_chip1': '🟣 Conn Rate: 396k/s',
      'diag.p3_chip2': '🔴 Cores 1 & 3: 98%',
      'diag.p3_chip3': '🟡 Rulebase Drops',
      'diag.p3_remedy': 'Apertura masiva de sesiones por escaneos o ráfagas SYN. Activar Accelerated SYN Defender en SecureXL.',

      // Problem Card 4
      'diag.p4_title': 'Volumen Masivo de Descartes: 124.4M Rulebase y 21M Anti-Spoofing',
      'diag.p4_evidence': '126.8M descartes totales. El 98.1% son por <code>Rulebase</code> y 21M por <code>Anti-Spoofing PPAK</code>. El <strong>13 de marzo a las 12:00 UTC</strong> se produjo un pico de <strong>535,248 drops/h</strong>.',
      'diag.p4_chip1': '🟠 Drops: 535k/h',
      'diag.p4_chip2': '🔵 Throughput: 506 Gbps',
      'diag.p4_chip3': '🔴 CPU Core 1: 94%',
      'diag.p4_remedy': 'Habilitar Drop Templates para descartar en hardware/SND antes de cargar CoreXL. Auditar topología Anti-Spoofing.',

      // Problem Card 5
      'diag.p5_title': 'Saturación Cercana a Tasa de Línea en Enlace 10G eth2-13 (9.14 Gbps)',
      'diag.p5_evidence': 'Interfaz física <code>eth2-13</code> alcanza un pico de <strong>9,138.76 Mbps (91.4% de un enlace 10G)</strong>. En agregación, <code>bond1</code> supera los <strong>9.39 Gbps</strong>, provocando riesgo inminente de micro-drops.',
      'diag.p5_chip1': '🔵 Throughput: 9.14 Gbps',
      'diag.p5_chip2': '🔴 Buffer Queuing',
      'diag.p5_remedy': 'Desbalanceo LACP. Cambiar algoritmo de hash del bond para repartir tráfico entre enlaces miembros.',

      // Problem Card 6
      'diag.p6_title': 'Patrón Cíclico a Medianoche (00:00 UTC - 83.3% de los Días)',
      'diag.p6_evidence': 'En <strong>25 de los 30 días (83.3%)</strong> a las 00:00 UTC, Core 1 supera el 75% de CPU con ráfagas de <code>sqlite3</code>, <code>fwk0_TRACK_WRTR</code> y rotación de logs.',
      'diag.p6_chip1': '🟢 25/30 Días a las 00h',
      'diag.p6_chip2': '🔴 CPU Spike Core 1',
      'diag.p6_remedy': 'Tareas programadas en crontab y rotación de logs colisionando a las 00:00. Escalonar cron jobs.',

      // Problem Card 7
      'diag.p7_title': 'Patrón Laboral de Mediodía (11:00 - 13:00 UTC - 53% de los Días)',
      'diag.p7_evidence': 'Entre semana de lunes a viernes, el 53% de los días presentan saturación coincidente de conexiones y CPU en esta franja. Fines de semana cae al 4.2%.',
      'diag.p7_chip1': '🟢 L-V 11h - 13h',
      'diag.p7_chip2': '🟣 Pico Usuarios',
      'diag.p7_remedy': 'Pico horario laboral de tráfico corporativo. Optimizar inspección SSL para tráfico no crítico.',

      // Problem Card 8
      'diag.p8_title': 'Ineficiencia en Aceleración: 223M Paquetes F2F y 51.5% CPU en Chain Modules',
      'diag.p8_evidence': 'Flofiler revela que el <strong>51.51% de ciclos de CPU</strong> se disipan en <code>Chain modules</code> y 13.0% en <code>Inbound F2F</code>. SecureXL desvía <strong>123.1M paquetes por Inspect handler</strong> y 99.8M por protocolo IP no acelerado. Tráfico de inspección dominado por DNS (UDP:53 con 21.3%) y SMB (TCP:445 con 12.6%).',
      'diag.p8_chip1': '🔴 Chain Modules: 51.5%',
      'diag.p8_chip2': '🔵 DNS / SMB L7',
      'diag.p8_chip3': '🟡 F2F Slow Path',
      'diag.p8_remedy': 'Paquetes procesados en camino lento (PPAK bypass) por inspecciones de capa 7 complejas. Optimizar SecureXL Drop Templates y plantillas de aceleración.',

      // Diagnostics Temporal Confluence Chart
      'diag.chart_title': '<span>📈</span> Correlación Temporal Multivariable de Indicadores (30 Días)',
      'diag.chart_subtitle': 'Superposición simultánea de CPU Core 1, Throughput, Tasa de Conexiones y Drops. Permite identificar confluencias críticas en la línea temporal.',
      'diag.range_all': 'Todo el Mes (30D)',
      'diag.range_14d': '14 Días',
      'diag.range_7d': '7 Días',
      'diag.range_crit': 'Ventana Crítica (11-15 Mar)',
      'diag.chart_tip': '💡 Pasa el cursor por las curvas para inspeccionar la confluencia exacta de métricas en cualquier hora.',
      'diag.chart_samples': '722 muestras horarias correlacionadas',
      'diag.ds_cpu_max': 'CPU Core 1 Max (%)',
      'diag.ds_cpu_avg': 'CPU Promedio Total (%)',
      'diag.ds_traffic_peak': 'Tráfico Pico (Gbps)',
      'diag.ds_conn_rate': 'Nuevas Conexiones (k c/s)',
      'diag.ds_drops_total': 'Descartes Totales (k drops/h)',

      // Diagnostics Heatmap
      'diag.heatmap_title': '<span>🗓️</span> Mapa de Calor de Recurrencia: Franjas Críticas por Hora y Día',
      'diag.heatmap_subtitle': 'Distribución temporal de horas con alta carga (Core 1 ≥ 75%). Revela de forma instantánea el patrón diario a medianoche y el ciclo laboral.',
      'diag.heatmap_level_label': 'Nivel de Carga:',
      'diag.heatmap_lvl_normal': 'Normal',
      'diag.heatmap_lvl_mod': 'Moderado',
      'diag.heatmap_lvl_high': 'Alto',
      'diag.heatmap_lvl_crit': 'Crítico',
      'diag.heatmap_lvl_extreme': 'Extremo',
      'diag.heatmap_lvl_saturation': 'Saturación Recurrente',

      // Diagnostics Incidents Table
      'diag.incidents_title': '<span>📋</span> Registro Detallado de Incidentes con Confluencia Multivariable',
      'diag.incidents_subtitle': 'Franjas temporales donde coincidieron 2 o más indicadores anómalos. Haz clic en cualquier fila para ver el desglose forense y remediación.',
      'diag.incidents_search_placeholder': '🔍 Buscar por fecha (ej. 2024-03-13), métrica o causa...',
      'diag.filter_all_sev': 'Todas las Severidades',
      'diag.filter_only_crit': 'Solo Críticos (🔴)',
      'diag.filter_high_crit': 'Altos y Críticos (🟠/🔴)',
      'diag.filter_med': 'Medios (🟡)',
      'diag.filter_all_nat': 'Toda Naturaleza',
      'diag.filter_recurrent': 'Solo Recurrentes (Patrón)',
      'diag.filter_punctual': 'Solo Puntuales (Anomalías)',
      'diag.th_datetime': 'Fecha y Hora (UTC)',
      'diag.th_severity': 'Severidad',
      'diag.th_nature': 'Naturaleza',
      'diag.th_confluence': 'Confluencia de Indicadores',
      'diag.th_action': 'Acción',
      'diag.btn_view_details': 'Ver Detalles',
      'diag.btn_hide_details': 'Ocultar',
      'diag.pagination_prev': '◀ Anterior',
      'diag.pagination_next': 'Siguiente ▶',
      'diag.no_incidents': 'No se encontraron incidentes para los criterios seleccionados.',
      'diag.badge_recurrent': '🔁 Recurrente',
      'diag.badge_punctual': '⚡ Puntual',
      'diag.detail_metrics_breakdown': 'Desglose de Métricas Confluyentes:',
      'diag.detail_root_cause': 'Causa Raíz Diagnosticada:',
      'diag.detail_remediation': 'Remediación Recomendada:',

      // Diagnostics Playbook
      'diag.playbook_title': '<span>🛡️</span> Playbook Ejecutivo de Remediación y Buenas Prácticas Check Point',
      'diag.playbook_subtitle': 'Comandos de consola Gaia y acciones en SmartConsole para mitigar los problemas identificados',
      'diag.pb_step1_title': 'Activar CoreXL Dynamic Dispatcher',
      'diag.pb_step1_desc': 'Elimina el cuello de botella en Core 1 redistribuyendo los flujos de tráfico pesados dinámicamente entre todos los workers disponibles.',
      'diag.pb_step2_title': 'Rebalancear Afinidad Automática CoreXL',
      'diag.pb_step2_desc': 'Optimiza la afinidad de interrupciones de interfaces de red con los cores SND (0, 2) y libera a los workers para inspección.',
      'diag.pb_step3_title': 'Ampliar Cola de Despachador SecureXL',
      'diag.pb_step3_desc': 'Previene los 5.83B fallos de encolamiento F2P aumentando el buffer de comunicación entre el kernel y userspace.',
      'diag.pb_step4_title': 'Habilitar Accelerated SYN Defense',
      'diag.pb_step4_desc': 'Protege los workers de CoreXL contra las ráfagas de 396k conns/s absorbiendo los handshakes TCP directamente en SecureXL.',
      'diag.pb_step5_title': 'Activar Drop Templates en SecureXL',
      'diag.pb_step5_desc': 'Descarta en hardware los 124.4M paquetes denegados por Rulebase sin consumir ciclos de CPU en el firewall.',
      'diag.pb_step6_title': 'Optimizar Balanceo LACP bond1 a Layer 3+4',
      'diag.pb_step6_desc': 'Reparte el tráfico entre eth1-13 y eth2-13 mediante puertos L4 para evitar saturar el enlace de 10G al 91.4%.',
      'diag.btn_copy': 'Copiar',
      'diag.btn_copied': '✓ Copiado',

      // Overview Page
      'overview.kpi_avg_thru': 'Rendimiento Inbound Promedio',
      'overview.kpi_peak_thru': 'Pico máximo:',
      'overview.kpi_conns': 'Conexiones Concurrentes',
      'overview.kpi_stable': 'Estables',
      'overview.kpi_monthly_peak': 'Pico mensual:',
      'overview.kpi_drops': 'Total Paquetes Descartados',
      'overview.kpi_psl_drops': '2.0M caídas PSL',
      'overview.kpi_spikes': 'Eventos Spike Detective',
      'overview.kpi_thread_spikes': '1,092 picos de threads',
      'overview.chart_traffic_title': '<span>📈</span> Evolución de Rendimiento y Tráfico (30 Días)',
      'overview.chart_traffic_subtitle': 'Throughput de red (Mbps) y paquetes por segundo agregados por hora',
      'overview.chart_drops_title': '<span>🚫</span> Top Razones de Descarte',
      'overview.chart_drops_subtitle': 'Distribución porcentual de drop reasons',
      'overview.chart_cpu_title': '<span>🖥️</span> Utilización de CPU Global y Memoria RAM',
      'overview.chart_cpu_subtitle': 'Porcentaje de carga media del sistema y consumo de memoria (16 GB)',
      'overview.storage_title': '<span>💾</span> Estado del Almacenamiento',
      'overview.storage_subtitle': 'Particiones de disco y porcentaje en uso',
      'overview.partition_label': 'Partición',
      'overview.free_gb': 'GB libres',

      // System Page
      'system.kpi_cores': 'Cores Asignados',
      'system.kpi_cores_sub': '2 CoreXL FW Workers + 2 SND Cores',
      'system.kpi_ram': 'Memoria RAM Total',
      'system.kpi_ram_sub': 'Uso medio:',
      'system.kpi_os': 'Versión Gaia SO',
      'system.kpi_os_sub': 'Jumbo Hotfix Main Take 28',
      'system.kpi_samples': 'Total Muestras DB',
      'system.kpi_samples_sub': '1 muestra por minuto durante 30 días',
      'system.table_cores_title': '<span>🧩</span> Desglose de Arquitectura de Cores (CoreXL / SND)',
      'system.btn_chart_cores': 'Graficar Cores',
      'system.th_core_id': 'Core ID',
      'system.th_role': 'Rol Asignado',
      'system.th_avg_usage': 'Uso Medio',
      'system.th_max_usage': 'Uso Máximo',
      'system.th_usr_time': 'Tiempo Usuario (% Usr)',
      'system.th_sys_time': 'Tiempo Sistema (% Sys)',
      'system.th_idle_time': 'Tiempo Idle (% Idle)',
      'system.th_interrupts': 'Max Interrupciones',
      'system.th_load_state': 'Estado Carga',
      'system.chart_timeline_title': '<span>📊</span> Utilización Individual por Core en el Tiempo',
      'system.chart_timeline_subtitle': 'Comparativa de carga entre Cores SND (0, 2) y CoreXL Workers (1, 3)',
      'system.details_title': '<span>📋</span> Parámetros del Nodo y Plataforma',
      'system.node_name': 'Nombre del Nodo',
      'system.os_label': 'Sistema Operativo',
      'system.cp_version': 'Versión Check Point',
      'system.jhf_branch': 'Jumbo HF Branch',
      'system.build_num': 'Build Number',
      'system.hw_model': 'Modelo Plataforma',
      'system.operating_mode': 'Modo Operativo',
      'system.cluster_status': 'Estado de Cluster',
      'system.uptime_label': 'Tiempo Activo (Uptime)',
      'system.monitored_period': 'Periodo Monitorizado',
      'system.total_snapshots': 'Total Snapshots',
      'system.rx_drops_hw': 'Drops Hardware Rx',

      // Interfaces Page
      'if.kpi_total': 'Total Interfaces',
      'if.kpi_total_sub': 'Física, Bonds y VLANs 802.1Q',
      'if.kpi_top': 'Interfaz de Mayor Tráfico',
      'if.kpi_top_sub': 'Pico: 9.25 Gbps | Media: 878.5 Mbps',
      'if.kpi_vlan': 'VLAN Más Activa',
      'if.kpi_vlan_sub': 'Pico: 7.39 Gbps | Media: 472.6 Mbps',
      'if.kpi_hw_drops': 'Errores y Drops HW',
      'if.kpi_hw_drops_sub': 'Sin pérdidas en buffers HW',
      'if.chart_top_title': '<span>📶</span> Top 10 Interfaces por Throughput Máximo (Mbps)',
      'if.chart_top_subtitle': 'Comparación de Throughput Rx y Tx en picos',
      'if.table_title': '<span>📑</span> Catálogo Completo de Interfaces de Red',
      'if.search_placeholder': 'Buscar por nombre, VLAN o IP...',
      'if.btn_chart_ifs': 'Graficar Interfaces',
      'if.filter_all': 'Todos',
      'if.filter_vlan': 'VLAN',
      'if.filter_bond': 'Bond',
      'if.filter_eth': 'Ethernet',
      'if.th_name': 'Nombre Interfaz',
      'if.th_type': 'Tipo',
      'if.th_speed': 'Velocidad',
      'if.th_state': 'Estado',
      'if.th_ipv4': 'Dirección IPv4 / Máscara',
      'if.th_rx_avg': 'Rx Media (Mbps)',
      'if.th_rx_max': 'Rx Pico (Mbps)',
      'if.th_tx_avg': 'Tx Media (Mbps)',
      'if.th_tx_max': 'Tx Pico (Mbps)',
      'if.th_drops_errors': 'Drops / Errores',
      'if.not_assigned': 'No asignada',

      // Traffic & Connections Page
      'traffic.kpi_fw_avg': 'Conexiones FW Media',
      'traffic.kpi_fw_sub': 'Handshake + Establecidas + No-TCP',
      'traffic.kpi_host_sxl': 'Conexiones Host SecureXL',
      'traffic.kpi_host_sxl_sub': 'Pico acelerado:',
      'traffic.kpi_rate_max': 'Tasa Máxima Nuevas Conexiones',
      'traffic.kpi_rate_max_sub': 'Media: 7,940 conns/sec',
      'traffic.kpi_pkt_max': 'Tasa Máxima Paquetes',
      'traffic.kpi_pkt_max_sub': 'Inbound packet rate peak',
      'traffic.chart_conns_title': '<span>🛡️</span> Desglose de Conexiones Concurrentes por Componente',
      'traffic.chart_conns_subtitle': 'Comparativa temporal de Firewall (FW), Host SXL y Host Streaming',
      'traffic.chart_states_title': '<span>🔄</span> Estados de Conexión Firewall',
      'traffic.chart_states_subtitle': 'Conexiones TCP Establecidas, Handshake y No-TCP/UDP',
      'traffic.chart_rate_title': '<span>⚡</span> Tasa de Nuevas Conexiones (Conns/sec)',

      // Drops Page
      'drops.kpi_rulebase': 'Total Caídas por Reglas',
      'drops.kpi_rulebase_sub': 'Reason 7: Rulebase Drop (Políticas)',
      'drops.kpi_psl': 'Caídas por Streaming (PSL)',
      'drops.kpi_psl_sub': 'Reason 177: General PSL',
      'drops.kpi_antispoof': 'Anti-Spoofing PPAK Drops',
      'drops.kpi_antispoof_sub': 'Aceleradas por kernel PPAK',
      'drops.kpi_templates': 'Drop Templates',
      'drops.kpi_templates_sub': 'Plantillas de descarte rápido SecureXL',
      'drops.chart_hourly_title': '<span>📉</span> Evolución Horaria de Paquetes Descartados',
      'drops.chart_ppak_title': '<span>🛡️</span> PPAK 0 Drops Category',
      'drops.table_title': '<span>📋</span> Tabla Detallada de Razones de Descarte (fwdrop_drop_resaons_tab)',
      'drops.btn_chart_drops': 'Graficar Descartes',
      'drops.th_code': 'Código Razón',
      'drops.th_desc': 'Descripción del Descarte',
      'drops.th_module': 'Módulo Afectado',
      'drops.th_total_pkts': 'Total Paquetes',
      'drops.th_pct': 'Porcentaje del Total',
      'drops.th_impact': 'Impacto Operativo',

      // Spikes Page
      'spikes.kpi_cpu': 'Picos de CPU Registrados',
      'spikes.kpi_cpu_sub': 'Eventos detectados por Spike Detective',
      'spikes.kpi_threads': 'Picos de Threads',
      'spikes.kpi_threads_sub': 'Hilos individuales de alta carga',
      'spikes.kpi_top_consumer': 'Consumidor Principal',
      'spikes.kpi_top_consumer_sub': 'Firewall Kernel Worker Core 1',
      'spikes.kpi_max_dur': 'Duración Máxima',
      'spikes.kpi_max_dur_sub': '12,717 seg continuos en fwk0_0',
      'spikes.alarm_level_label': 'Nivel Mínimo de Alarma:',
      'spikes.btn_all_levels': 'Todos los Niveles',
      'spikes.btn_mod_level': '🟡 Moderado (≥ 75%)',
      'spikes.btn_high_level': '🟠 Alto (≥ 80%)',
      'spikes.btn_crit_level': '🔴 Solo Crítico (≥ 90%)',
      'spikes.chart_timeline_title': '<span>📈</span> Frecuencia Temporal de Picos de CPU (Día a Día)',
      'spikes.chart_timeline_subtitle': 'Cantidad de eventos de pico detectados por fecha en el nodo',
      'spikes.chart_cores_title': '<span>🧩</span> Distribución por Core',
      'spikes.chart_cores_subtitle': 'Concentración de picos por núcleo CPU',
      'spikes.chart_consumers_title': '<span>🔥</span> Top Procesos Consumidores de Picos CPU',
      'spikes.chart_consumers_subtitle': 'Procesos con mayor frecuencia y severidad de picos',
      'spikes.chart_threads_title': '<span>🧵</span> Picos por Hilo (Thread Name)',
      'spikes.chart_threads_subtitle': 'Hilos individuales de mayor consumo sostenido',
      'spikes.table_title': '<span>📋</span> Registro de Eventos de Spike Detective (CPU Spikes)',
      'spikes.search_placeholder': 'Filtrar por proceso (fwk, pdpd, sqlite)...',
      'spikes.btn_chart_spikes': 'Graficar Eventos',
      'spikes.th_datetime': 'Fecha y Hora UTC',
      'spikes.th_core': 'Core',
      'spikes.th_consumer': 'Proceso Consumidor',
      'spikes.th_avg_cpu': 'Uso Medio CPU',
      'spikes.th_duration': 'Duración (seg)',
      'spikes.th_severity': 'Severidad',
      'spikes.severity_moderate': 'Moderado',
      'spikes.severity_high': 'Alto',
      'spikes.severity_crit': 'Crítico',

      // Flow Profiler (Flofiler) Page
      'flofiler.kpi_proto': 'Protocolo L4 Líder',
      'flofiler.kpi_proto_sub': '9.3M y 9.1M ciclos de CPU',
      'flofiler.kpi_kernel': 'Módulo Kernel Líder',
      'flofiler.kpi_kernel_sub': '23.8M ciclos de inspección secuencial',
      'flofiler.kpi_f2f': 'Inbound F2F',
      'flofiler.kpi_f2f_sub': 'Ciclos en paso Forward to Firewall',
      'flofiler.kpi_rules': 'Inspección de Reglas',
      'flofiler.kpi_rules_sub': 'Ciclos dedicados a Access Rulebase',
      'flofiler.chart_protocols_title': '<span>📊</span> Top Protocolos y Servicios por Ciclos de CPU',
      'flofiler.chart_components_title': '<span>🧩</span> Top Componentes de Inspección Check Point',

      // SecureXL & CoreXL Page
      'securexl.kpi_status': 'Estado SecureXL',
      'securexl.kpi_status_val': 'Activado (On)',
      'securexl.kpi_status_sub': '100% del periodo de monitorización',
      'securexl.kpi_fails': 'Colas de Enqueue Fails',
      'securexl.kpi_fails_sub': 'F2P packet userspace (Multik)',
      'securexl.kpi_inbound': 'Inbound Packet Userspace',
      'securexl.kpi_inbound_sub': 'Multik enqueue fail count',
      'securexl.kpi_ppak_peak': 'PPAK VS0 Throughput Pico',
      'securexl.kpi_ppak_peak_sub': 'Acelerado en nodo virtual 0',
      'securexl.chart_f2v_title': '<span>🔄</span> Razones de F2V (Forward to Virtual / CoreXL)',
      'securexl.chart_fails_title': '<span>📦</span> Multik Dispatcher Enqueue Fails',
      'securexl.chart_ppak_title': '<span>📈</span> PPAK VS0 - Throughput y Conexiones Aceleradas',

      // Blades Page
      'blades.kpi_tls': 'Conexiones Seguras TLS',
      'blades.kpi_tls_sub': 'Soporte criptográfico activo',
      'blades.kpi_vpn': 'VPN IPsec / IKE SAs',
      'blades.kpi_vpn_val': 'Túneles Monitoreados',
      'blades.kpi_vpn_sub': 'Cero errores de negociación IKE',
      'blades.kpi_av': 'Firmas Anti-Virus / Bot',
      'blades.kpi_av_val': 'Actualizado',
      'blades.kpi_av_sub': 'Módulos AV Lite y App Control',
      'blades.kpi_tracker': 'Log Tracker Promedio',
      'blades.kpi_tracker_sub': 'Tasa de registro de conexiones',
      'blades.chart_vpn_title': '<span>🔐</span> Actividad de Túneles VPN (Peers e IKE SAs)',

      // DB Explorer Page
      'db.console_title': '⚡ Consola de Consulta SQL Directa (Solo Lectura)',
      'db.btn_run_sql': '▶ Ejecutar SQL',
      'db.btn_sample_cpu': 'Ejemplo: CPU',
      'db.btn_sample_disks': 'Ejemplo: Discos',
      'db.btn_sample_spikes': 'Ejemplo: Spikes',
      'db.status_ready': 'Listo',
      'db.status_executing': 'Ejecutando consulta...',
      'db.status_rows_fetched': 'filas obtenidas',
      'db.results_title': '<span>📊</span> Resultado de Consulta SQL',
      'db.btn_chart_results': 'Graficar Resultados',
      'db.btn_close_results': '✕ Cerrar',
      'db.catalog_title': '<span>🗄️</span> Catálogo de Tablas en la Base de Datos SQLite (122 Tablas Activas)',
      'db.catalog_subtitle': 'Haz clic en cualquier tabla para abrir el visor interactivo de registros',
      'db.filter_tables_placeholder': 'Filtrar tablas (ej. CPU, HW, vpn, fw)...',
      'db.th_table_name': 'Nombre de Tabla',
      'db.th_category': 'Categoría / Prefijo',
      'db.th_total_rows': 'Total Registros',
      'db.th_num_cols': 'Nº Columnas',
      'db.th_key_cols': 'Columnas Clave',
      'db.th_actions': 'Acciones',
      'db.btn_view_records': '🔍 Ver Registros',

      // Modal: Load Database
      'modal_db.title': '📂 Cargar Datos de Otra Máquina CPView',
      'modal_db.subtitle': 'Visualiza y analiza el rendimiento de cualquier nodo Check Point (ficheros .CPViewDB.dat o .sqlite)',
      'modal_db.tab_detected': '📁 Ficheros en Servidor',
      'modal_db.tab_upload': '⬆️ Subir Nuevo Fichero',
      'modal_db.tab_path': '🖥️ Ruta en Servidor',
      'modal_db.detected_desc': 'Bases de datos CPView detectadas automáticamente en el directorio de la aplicación:',
      'modal_db.searching': 'Buscando bases de datos disponibles...',
      'modal_db.dropzone_title': 'Arrastra y suelta aquí el fichero de otra máquina',
      'modal_db.dropzone_desc': 'Selecciona cualquier archivo <code>.CPViewDB.dat</code> o base de datos SQLite extraída de un Check Point Security Gateway o VSX.',
      'modal_db.btn_browse': '📁 Explorar Fichero Local',
      'modal_db.uploading_label': 'Subiendo fichero...',
      'modal_db.uploading_sub': 'Transfiriendo y procesando métricas...',
      'modal_db.path_desc': 'Introduce la ruta absoluta o relativa de un fichero SQLite CPView existente en el servidor:',
      'modal_db.path_placeholder': '/ruta/hacia/SG_OTRO-NODO_CPViewDB.dat',
      'modal_db.btn_load_path': '▶ Cargar Fichero',
      'modal_db.path_example': 'Ejemplo: <code>./SG_FWNET-ch01-01_2_4_2024_16_27.CPViewDB.dat</code>',
      'modal_db.loading_title': 'Extrayendo datos de la máquina...',
      'modal_db.loading_desc': 'Agregando series temporales y resolviendo tablas de referencias CPView...',
      'modal_db.card_active': 'Activo',
      'modal_db.card_current_btn': '✓ Máquina en Pantalla',
      'modal_db.card_load_btn': '▶ Cargar Esta Máquina',

      // Modal: Custom Chart Generator
      'chartgen.title': 'Creador de Gráficos Personalizados',
      'chartgen.subtitle': 'Configura los ejes, operaciones y agrupaciones temporales',
      'chartgen.btn_toggle_controls': 'Ocultar Controles',
      'chartgen.btn_show_controls': 'Mostrar Controles',
      'chartgen.btn_fullscreen': 'Pantalla Completa',
      'chartgen.opt_cpu_cores': '🧩 Tabla: Cores CPU',
      'chartgen.opt_interfaces': '🌐 Tabla: Interfaces',
      'chartgen.opt_drop_reasons': '📋 Tabla: Razones de Descarte',
      'chartgen.opt_cpu_spikes': '🔍 Tabla: Eventos Spike Detective',
      'chartgen.opt_sql_results': '⚡ Tabla: Resultados SQL',
      'chartgen.opt_modal_table': '🗄️ Tabla: Visor SQLite Activo',
      'chartgen.label_x': '📍 Eje X (Categoría / Dimensión / Tiempo)',
      'chartgen.label_time': '⏱️ Tratamiento Temporal (Timestamp)',
      'chartgen.opt_time_none': 'Texto / Sin formato temporal',
      'chartgen.opt_time_datetime': '📅 Fecha y Hora completa (DD/MM HH:mm)',
      'chartgen.opt_time_date': '📆 Sólamente Días (DD/MM/YYYY)',
      'chartgen.opt_time_hour': '⏰ Sólamente Horas del día (00h - 23h)',
      'chartgen.opt_time_weekday': '🗓️ Día de la semana (Lunes - Domingo)',
      'chartgen.opt_time_hour_dt': '⏱️ Por Hora cronológica (DD/MM HH:00)',
      'chartgen.opt_time_minute': '⏱️ Por Minuto cronológico (DD/MM HH:mm)',
      'chartgen.label_y': '📈 Eje Y (Métrica / Valor a Representar)',
      'chartgen.label_op': '🧮 Operación / Agregación',
      'chartgen.opt_op_sum': 'Sumatorio de Valores (SUM)',
      'chartgen.opt_op_sum_day': '📅 Sumatorio por Días (SUM por Día)',
      'chartgen.opt_op_sum_hour': '⏰ Sumatorio por Horas (SUM por Hora)',
      'chartgen.opt_op_sum_min': '⏱️ Sumatorio por Minutos (SUM por Minuto)',
      'chartgen.opt_op_count': 'Conteo de Filas / Frecuencia (COUNT)',
      'chartgen.opt_op_avg': 'Promedio / Media (AVG)',
      'chartgen.opt_op_max': 'Pico Máximo (MAX)',
      'chartgen.opt_op_min': 'Valor Mínimo (MIN)',
      'chartgen.opt_op_raw': 'Valores Directos (Sin agrupar)',
      'chartgen.label_slice': '🔢 Selección / Límite de Registros',
      'chartgen.opt_slice_all': 'Todos los registros de la tabla',
      'chartgen.opt_slice_last100': 'Últimos 100 registros (más recientes)',
      'chartgen.opt_slice_last500': 'Últimos 500 registros',
      'chartgen.opt_slice_last1000': 'Últimos 1,000 registros',
      'chartgen.opt_slice_last5000': 'Últimos 5,000 registros',
      'chartgen.opt_slice_first100': 'Primeros 100 registros (más antiguos)',
      'chartgen.opt_slice_first500': 'Primeros 500 registros',
      'chartgen.opt_slice_first1000': 'Primeros 1,000 registros',
      'chartgen.label_date_range': '📅 Rango Temporal (Fecha Desde — Hasta)',
      'chartgen.date_to_separator': 'a',
      'chartgen.btn_reset_dates': '✕ Todo',
      'chartgen.label_shortcuts': '⚡ Atajos de Rango',
      'chartgen.preset_all': 'Todo',
      'chartgen.label_type': 'Tipo:',
      'chartgen.type_bar': '📊 Barras',
      'chartgen.type_horiz': '📉 Horiz',
      'chartgen.type_line': '📈 Línea',
      'chartgen.type_area': '🏔️ Área',
      'chartgen.type_pie': '🥧 Tarta',
      'chartgen.type_doughnut': '🍩 Donut',
      'chartgen.label_sort': 'Ordenar:',
      'chartgen.opt_sort_ydesc': 'Mayor a Menor (Top Y)',
      'chartgen.opt_sort_yasc': 'Menor a Mayor (Y asc)',
      'chartgen.opt_sort_xasc': 'Eje X Ascendente (A-Z / Crono)',
      'chartgen.opt_sort_xdesc': 'Eje X Descendente',
      'chartgen.opt_sort_original': 'Orden Original de Filas',
      'chartgen.label_limit': 'Límite:',
      'chartgen.opt_limit_all': 'Todos',
      'chartgen.opt_limit_10': 'Top 10',
      'chartgen.opt_limit_15': 'Top 15',
      'chartgen.opt_limit_25': 'Top 25',
      'chartgen.opt_limit_50': 'Top 50',
      'chartgen.label_color': 'Color:',
      'chartgen.view_summary': '📊 Vista de Gráfico:',
      'chartgen.no_data': 'ℹ️ No hay datos para graficar con la configuración actual.',
      'chartgen.stat_categories': 'Categorías / Puntos',
      'chartgen.stat_sum': 'Suma Total',
      'chartgen.stat_avg': 'Media / Promedio',
      'chartgen.stat_max': 'Pico Máximo',
      'chartgen.stat_min': 'Mínimo',
      'chartgen.footer_info': 'Gráfico interactivo generado en tiempo real',
      'chartgen.btn_copy_csv': '📋 Copiar CSV',
      'chartgen.btn_download_png': '💾 Descargar Imagen PNG',
      'chartgen.btn_close': 'Cerrar',

      // Modal: Table Viewer
      'tableview.subtitle': 'Registros directos con resolución de referencias CPView',
      'tableview.search_placeholder': 'Filtrar filas actuales...',
      'tableview.btn_chart': '📊 Graficar Registros',
      'tableview.loading': 'Cargando registros...',
      'tableview.page_prefix': 'Página',
      'tableview.btn_prev': '◀ Anterior',
      'tableview.btn_next': 'Siguiente ▶',
      'tableview.empty': 'Sin registros',

      // Common Terms & Days
      'common.empty_val': '(Vacío)',
      'common.day_mon': 'Lunes',
      'common.day_tue': 'Martes',
      'common.day_wed': 'Miércoles',
      'common.day_thu': 'Jueves',
      'common.day_fri': 'Viernes',
      'common.day_sat': 'Sábado',
      'common.day_sun': 'Domingo',
      'common.showing': 'Mostrando',
      'common.of': 'de',
      'common.events': 'eventos',
      'common.incidents': 'incidentes',
      'common.all': 'Todos',
      'if.kpi_excellent': 'Excelente',
      'db.console_db_label': 'Base de datos:',
      'chartgen.lbl_toggle_controls': 'Ocultar Controles',
      'chartgen.lbl_fullscreen': 'Pantalla Completa',
      'diag.cause_cpu_conns': 'Confluencia crítica: saturación de CoreXL Worker 1 provocada por ráfaga masiva de apertura de conexiones TCP en camino lento.',
      'diag.remedy_cpu_conns': 'Activar Dynamic Dispatcher (fw ctl multik dynamic_disp on) y Accelerated SYN Defense (fw ctl set int sim_syn_defense 1).',
      'diag.cause_drops_traffic': 'Confluencia de alto throughput con ráfagas de descarte en Rulebase o Anti-Spoofing PPAK. Sobrecarga en pipeline de inspección.',
      'diag.remedy_drops_traffic': 'Habilitar Drop Templates en SecureXL (fw accel drop_templates on) y revisar grupos de topología de interfaz.',
      'diag.cause_midnight': 'Degradación cíclica nocturna por tareas batch en crontab, volcados de CPView y rotación de logs a las 00:00 UTC.',
      'diag.remedy_midnight': 'Escalonar los cron jobs de medianoche en crontab (rotación a 01:15, backups a 02:30, compresión a 03:45).',
      'diag.cause_multivar': 'Anomalía puntual multivariable que genera contención temporal de recursos de kernel y buffers de red.',
      'diag.remedy_multivar': 'Verificar sim affinity -a y ampliar buffers de encolamiento de SecureXL (sim_dispatcher_queue_size 4096).',
      'diag.incidents_filtered': '{count} incidentes filtrados (de {total})',
      'diag.filter_tag': 'Filtrado: {day} {hour}h',
      'diag.btn_reset_filter': '✕ Limpiar',
      'diag.btn_copy_report': '📋 Copiar Reporte Forense',
      'diag.btn_report_copied': '✓ Reporte Copiado',
      'diag.exact_values': '📊 Valores Exactos en la Franja',
      'diag.drawer_cause': '🔍 Diagnóstico y Causa Raíz',
      'diag.drawer_remedy': '🛠️ Remediación Check Point Recomendada',
      'spikes.filtered_active': 'picos activos',
      'spikes.all_levels': 'Todos los niveles',
      'spikes.moderate_label': 'Moderada (≥ 75% CPU)',
      'spikes.high_label': 'Alta y Crítica (≥ 80% CPU)',
      'spikes.critical_label': 'Solo Crítica (≥ 90% CPU)',
      'spikes.no_events': 'No se encontraron eventos',
      'spikes.showing_pagination': 'Mostrando {start} - {end} de {total} eventos',
      'system.high_demand': 'Alta Demanda',
      'system.normal': 'Normal',
      'diag.showing_pagination': 'Mostrando {start} - {end} de {total} incidentes (Pág. {page} de {totalPages})',
      'diag.no_incidents_match': 'No hay incidentes que coincidan con los filtros',
      'diag.no_incidents_found': 'No se encontraron incidentes para los criterios seleccionados.',
      'diag.btn_hide': '▲ Ocultar',
      'diag.btn_view_detail': '▼ Ver Detalle',
      'modal.table_prefix': 'Tabla:',
      'modal.loading_data': 'Cargando datos...',
      'modal.querying_records': 'Consultando registros...',
      'modal.sample_pre_extracted': 'Muestra pre-extraída (Total en SQLite: {total})',
      'modal.page_total_records': 'Página {page} (Total: {total} registros)',
      'modal.error_load': 'No se pudieron cargar registros para esta tabla.',
      'db.rows_fetched_count': '{count} filas obtenidas',
      'header.days_suffix': 'días',
      'sidebar.badge_tables_suffix': 'Tablas'
    },

    en: {
      // Language Selector
      'lang.select_language': 'Language / Idioma',
      'lang.es_name': 'Español',
      'lang.es_desc': 'Spanish (Castellano)',
      'lang.en_name': 'English',
      'lang.en_desc': 'English (Default for NOC/SOC)',
      'lang.pt_name': 'Português',
      'lang.pt_desc': 'Portuguese (Brasil / Portugal)',

      // Sidebar
      'sidebar.node_active': 'Active Node',
      'sidebar.cores_count': '4 Cores',
      'sidebar.sec_diag': 'Diagnostics & Health',
      'sidebar.nav_diagnostics': 'Problem Analysis',
      'sidebar.badge_anomalies': '8 Alerts',
      'sidebar.sec_monitor': 'General Monitoring',
      'sidebar.nav_overview': 'Executive Summary',
      'sidebar.nav_system': 'System & CPU',
      'sidebar.badge_cores': '4 Cores',
      'sidebar.nav_interfaces': 'Network Interfaces',
      'sidebar.badge_ifs': '50+ IFs',
      'sidebar.sec_traffic': 'Traffic & Inspection',
      'sidebar.nav_traffic': 'Traffic & Connections',
      'sidebar.badge_conns': '400k',
      'sidebar.nav_drops': 'Drops & Discards',
      'sidebar.badge_drops': '124M',
      'sidebar.nav_flofiler': 'Flow Profiler (CPU)',
      'sidebar.nav_securexl': 'SecureXL & CoreXL',
      'sidebar.sec_blades': 'Diagnostics & Blades',
      'sidebar.nav_spikes': 'Spike Detective',
      'sidebar.badge_spikes': '1.9k',
      'sidebar.nav_blades': 'VPN & Blades',
      'sidebar.nav_db_explorer': 'SQLite Explorer',
      'sidebar.badge_tables': '122 Tables',
      'sidebar.footer_os': 'Check Point Gaia 64-bit',
      'sidebar.footer_take': 'Take 28',

      // Top Header
      'header.node_label': 'Machine:',
      'header.uptime_label': 'Uptime:',
      'header.cluster_label': 'Cluster:',
      'header.btn_theme_title': 'Select high-contrast visual theme',
      'header.btn_scale_title': 'Adjust UI scale and typography',
      'header.btn_chart_builder': 'Chart Builder',
      'header.btn_chart_builder_title': 'Open custom chart generator for any table',
      'header.btn_load_db': 'Load Other Machine / DB',
      'header.btn_export_json': 'Export JSON',
      'header.days_suffix': 'days',

      // Page Titles
      'title.diagnostics': '<span>🚨</span> Problem Diagnostics & Temporal Confluence Analysis',
      'title.overview': '<span>📊</span> Gateway Executive Summary',
      'title.system': '<span>🖥️</span> System Architecture, CPU & Memory',
      'title.interfaces': '<span>🌐</span> Network Interfaces Catalog & Performance',
      'title.traffic': '<span>🛡️</span> Firewall Connections & Traffic Rates',
      'title.drops': '<span>🚫</span> Detailed Packet Drop Reasons Analysis',
      'title.spikes': '<span>🔍</span> Spike Detective - Process Diagnostics',
      'title.flofiler': '<span>🌊</span> Flow Profiler - CPU Cycle Distribution',
      'title.securexl': '<span>⚡</span> SecureXL & CoreXL Acceleration',
      'title.blades': '<span>🔐</span> Software Blades, VPN & Secure Connections',
      'title.db_explorer': '<span>🗄️</span> SQLite Tables & Direct Query Explorer',

      // Theme Selector Menu
      'theme.header': 'High-Contrast Themes',
      'theme.default_name': 'Cyber Dark (Original)',
      'theme.default_desc': 'Dark Check Point with cyan accents',
      'theme.gold_name': 'Obsidian & Gold',
      'theme.gold_desc': 'Jet black with gold and amber',
      'theme.emerald_name': 'Matrix Emerald',
      'theme.emerald_desc': 'Neon emerald green for NOC/SOC',
      'theme.sapphire_name': 'Midnight Sapphire',
      'theme.sapphire_desc': 'Deep royal blue with ice accents',
      'theme.violet_name': 'Neon Violet',
      'theme.violet_desc': 'Cosmic amethyst with magenta glow',
      'theme.monochrome_name': 'Monochrome OLED',
      'theme.monochrome_desc': 'Pure black and maximum white contrast',
      'theme.light_name': 'Solarized Light',
      'theme.light_desc': 'Crisp, high-contrast light mode',

      // Scale & Font Menu
      'scale.header': 'Scale & Typography',
      'scale.reset_btn': '↺ Reset',
      'scale.reset_title': 'Reset to default values (100%)',
      'scale.zoom_title': '🖥️ Interface Scale (Zoom)',
      'scale.zoom_dec': 'Decrease zoom',
      'scale.zoom_inc': 'Increase zoom',
      'scale.font_title': '🔤 Font Size',
      'scale.font_dec': 'Decrease font size',
      'scale.font_inc': 'Increase font size',
      'scale.family_title': '🖋️ Font Family',
      'scale.family_inter_desc': 'Check Point Default',
      'scale.family_roboto_desc': 'Clean and modern',
      'scale.family_system_name': 'Native System',
      'scale.family_system_desc': 'Segoe UI / SF Pro / Ubuntu',
      'scale.family_mono_desc': 'SOC Technical Terminal mode',
      'scale.family_dyslexic_name': 'High Legibility',
      'scale.family_dyslexic_desc': 'Atkinson Hyperlegible / Accessible',
      'scale.shortcuts_tip': '⌨️ Shortcuts: <kbd>Ctrl</kbd>+<kbd>+</kbd>/<kbd>-</kbd> Zoom · <kbd>Ctrl</kbd>+<kbd>0</kbd> 100%',

      // Diagnostics Hero
      'diag.hero_score_label': 'Health / 100',
      'diag.hero_title': '<span>🚨</span> Forensic Diagnostics & Multivariable Temporal Confluence',
      'diag.hero_desc': 'Automated audit of CPView performance data (1.34 GB, 722 hours and 126.8M dropped packets). <strong>Critical indicator confluence</strong> detected: periodic saturation on CoreXL Worker #1, 396k conns/s bursts, and over 5.8 billion drops due to SecureXL queue overflow.',
      'diag.pill_crit_num': '3 Critical',
      'diag.pill_crit_label': 'High Severity',
      'diag.pill_high_num': '4 High',
      'diag.pill_high_label': 'Operational Risk',
      'diag.pill_slots_label': 'Confluent Windows',
      'diag.pill_cyclic_num': '2 Cyclic',
      'diag.pill_cyclic_label': 'Daily Patterns',

      // Diagnostics Problem Cards Section
      'diag.audit_title': '<span>🔍</span> Systematic Audit of Detected Table Problems',
      'diag.audit_subtitle': 'Multivariable analysis of bottlenecks across CPU, SecureXL queues, network links and discards',
      'diag.badge_critical': 'Critical',
      'diag.badge_high': 'High',
      'diag.badge_recurrent': 'Recurrent',
      'diag.badge_info': 'Informational',
      'diag.evidence_label': 'Evidence in tables:',
      'diag.confluence_label': 'Temporal Confluence:',
      'diag.rootcause_label': 'Root Cause & Fix:',

      // Problem Card 1
      'diag.p1_title': 'Saturation & Imbalance on CoreXL FW Worker #1 (fwk0_1)',
      'diag.p1_evidence': 'Core 1 accumulates <strong>898 CPU spikes</strong> in Spike Detective (45.4% of total), with sustained <strong>100%</strong> spikes and durations up to <strong>7,711s (2.1 hours)</strong>. SND cores (0 and 2) average only 11% CPU load.',
      'diag.p1_chip1': '🔴 CPU Core 1: 100%',
      'diag.p1_chip2': '🟣 Conn Rate: 396k/s',
      'diag.p1_chip3': '🔵 F2F Traffic',
      'diag.p1_remedy': 'CoreXL Dispatcher affinity imbalance. Heavy flows are not evenly distributed across workers.',

      // Problem Card 2
      'diag.p2_title': 'SecureXL Dispatcher Collapse: 5.83B F2P Enqueue Fails',
      'diag.p2_evidence': '<code>fwmultik_dispatcher_vs_stats_enqueue_fail...</code> records <strong>5,835,841,087 F2P drops</strong> to userspace and <strong>43.7M Inbound drops</strong>. 123M packets bypassed acceleration due to <code>Inspect handler</code>.',
      'diag.p2_chip1': '🔴 F2P Drops: 5.83B',
      'diag.p2_chip2': '🔴 Worker Starvation',
      'diag.p2_chip3': '🔵 Slow Path Burst',
      'diag.p2_remedy': 'Dispatcher queue buffer overflow toward userspace. Increase buffer capacity and optimize SecureXL templates.',

      // Problem Card 3
      'diag.p3_title': 'Massive Connection Setup Bursts (Up to 396k conns/sec)',
      'diag.p3_evidence': 'Establishment rate jumps from ~10k to <strong>396,498 conns/s</strong> (a 3,800% increase), coinciding with spikes in <code>tcp_handshake</code> state and firewall core saturation.',
      'diag.p3_chip1': '🟣 Conn Rate: 396k/s',
      'diag.p3_chip2': '🔴 Cores 1 & 3: 98%',
      'diag.p3_chip3': '🟡 Rulebase Drops',
      'diag.p3_remedy': 'Massive session initialization from scans or SYN floods. Enable Accelerated SYN Defender in SecureXL.',

      // Problem Card 4
      'diag.p4_title': 'Massive Drop Volume: 124.4M Rulebase & 21M Anti-Spoofing',
      'diag.p4_evidence': '126.8M total dropped packets. 98.1% caused by <code>Rulebase</code> and 21M by <code>Anti-Spoofing PPAK</code>. On <strong>March 13 at 12:00 UTC</strong>, an extreme peak of <strong>535,248 drops/h</strong> occurred.',
      'diag.p4_chip1': '🟠 Drops: 535k/h',
      'diag.p4_chip2': '🔵 Throughput: 506 Gbps',
      'diag.p4_chip3': '🔴 CPU Core 1: 94%',
      'diag.p4_remedy': 'Enable Drop Templates to discard packets in hardware/SND before hitting CoreXL. Audit Anti-Spoofing topology groups.',

      // Problem Card 5
      'diag.p5_title': 'Near Wire-Rate Saturation on 10G Link eth2-13 (9.14 Gbps)',
      'diag.p5_evidence': 'Physical interface <code>eth2-13</code> reaches <strong>9,138.76 Mbps (91.4% of a 10G link)</strong>. In aggregate, <code>bond1</code> exceeds <strong>9.39 Gbps</strong>, posing immediate micro-drop risk.',
      'diag.p5_chip1': '🔵 Throughput: 9.14 Gbps',
      'diag.p5_chip2': '🔴 Buffer Queuing',
      'diag.p5_remedy': 'LACP hashing imbalance. Switch bond hashing algorithm to distribute traffic across member links evenly.',

      // Problem Card 6
      'diag.p6_title': 'Midnight Cyclic Degradation (00:00 UTC - 83.3% of Days)',
      'diag.p6_evidence': 'On <strong>25 out of 30 days (83.3%)</strong> at 00:00 UTC, Core 1 exceeds 75% CPU load with bursts of <code>sqlite3</code>, <code>fwk0_TRACK_WRTR</code>, and log rotations.',
      'diag.p6_chip1': '🟢 25/30 Days at 00h',
      'diag.p6_chip2': '🔴 CPU Spike Core 1',
      'diag.p6_remedy': 'Scheduled crontab jobs, CPView dumps, and log rotation colliding at 00:00. Stagger maintenance cron jobs.',

      // Problem Card 7
      'diag.p7_title': 'Midday Business Hours Peak (11:00 - 13:00 UTC - 53% of Days)',
      'diag.p7_evidence': 'On weekdays (Mon-Fri), 53% of days exhibit concurrent connection and CPU saturation during this window. On weekends it drops to 4.2%.',
      'diag.p7_chip1': '🟢 Mon-Fri 11h - 13h',
      'diag.p7_chip2': '🟣 Peak Users',
      'diag.p7_remedy': 'Workday corporate traffic rush. Optimize SSL inspection policies and bypass non-critical internal traffic.',

      // Problem Card 8
      'diag.p8_title': 'Acceleration Inefficiency: 223M F2F Packets & 51.5% CPU in Chain Modules',
      'diag.p8_evidence': 'Flofiler shows <strong>51.51% of CPU cycles</strong> consumed in <code>Chain modules</code> and 13.0% in <code>Inbound F2F</code>. SecureXL diverted <strong>123.1M packets via Inspect handler</strong> and 99.8M due to non-accelerated IP protocols. DNS (UDP:53 at 21.3%) and SMB (TCP:445 at 12.6%) dominate inspection.',
      'diag.p8_chip1': '🔴 Chain Modules: 51.5%',
      'diag.p8_chip2': '🔵 DNS / SMB L7',
      'diag.p8_chip3': '🟡 F2F Slow Path',
      'diag.p8_remedy': 'Packets handled in slow path (PPAK bypass) by complex layer-7 inspections. Tune SecureXL Drop Templates and acceleration bypass rules.',

      // Diagnostics Temporal Confluence Chart
      'diag.chart_title': '<span>📈</span> Multivariable Temporal Indicator Correlation (30 Days)',
      'diag.chart_subtitle': 'Simultaneous superposition of CPU Core 1, Throughput, Connection Rate and Drops. Identifies critical confluence along the timeline.',
      'diag.range_all': 'Full Month (30D)',
      'diag.range_14d': '14 Days',
      'diag.range_7d': '7 Days',
      'diag.range_crit': 'Critical Window (Mar 11-15)',
      'diag.chart_tip': '💡 Hover over curves to inspect the exact confluence of metrics at any hour.',
      'diag.chart_samples': '722 correlated hourly samples',
      'diag.ds_cpu_max': 'CPU Core 1 Max (%)',
      'diag.ds_cpu_avg': 'Total Avg CPU (%)',
      'diag.ds_traffic_peak': 'Peak Traffic (Gbps)',
      'diag.ds_conn_rate': 'New Connections (k c/s)',
      'diag.ds_drops_total': 'Total Drops (k drops/h)',

      // Diagnostics Heatmap
      'diag.heatmap_title': '<span>🗓️</span> Recurrence Heatmap: Critical Windows by Hour & Day',
      'diag.heatmap_subtitle': 'Temporal distribution of high-load hours (Core 1 ≥ 75%). Instantly highlights the midnight pattern and workday cycle.',
      'diag.heatmap_level_label': 'Load Level:',
      'diag.heatmap_lvl_normal': 'Normal',
      'diag.heatmap_lvl_mod': 'Moderate',
      'diag.heatmap_lvl_high': 'High',
      'diag.heatmap_lvl_crit': 'Critical',
      'diag.heatmap_lvl_extreme': 'Extreme',
      'diag.heatmap_lvl_saturation': 'Recurrent Saturation',

      // Diagnostics Incidents Table
      'diag.incidents_title': '<span>📋</span> Detailed Incident Log with Multivariable Confluence',
      'diag.incidents_subtitle': 'Time slots where 2 or more anomalous indicators coincided. Click any row for forensic breakdown and remediation.',
      'diag.incidents_search_placeholder': '🔍 Search by date (e.g. 2024-03-13), metric or cause...',
      'diag.filter_all_sev': 'All Severities',
      'diag.filter_only_crit': 'Critical Only (🔴)',
      'diag.filter_high_crit': 'High & Critical (🟠/🔴)',
      'diag.filter_med': 'Medium (🟡)',
      'diag.filter_all_nat': 'All Natures',
      'diag.filter_recurrent': 'Recurrent Only (Pattern)',
      'diag.filter_punctual': 'Punctual Only (Anomalies)',
      'diag.th_datetime': 'Date & Time (UTC)',
      'diag.th_severity': 'Severity',
      'diag.th_nature': 'Nature',
      'diag.th_confluence': 'Indicator Confluence',
      'diag.th_action': 'Action',
      'diag.btn_view_details': 'View Details',
      'diag.btn_hide_details': 'Hide',
      'diag.pagination_prev': '◀ Previous',
      'diag.pagination_next': 'Next ▶',
      'diag.no_incidents': 'No incidents found matching selected filter criteria.',
      'diag.badge_recurrent': '🔁 Recurrent',
      'diag.badge_punctual': '⚡ Punctual',
      'diag.detail_metrics_breakdown': 'Confluent Metrics Breakdown:',
      'diag.detail_root_cause': 'Diagnosed Root Cause:',
      'diag.detail_remediation': 'Recommended Remediation:',

      // Diagnostics Playbook
      'diag.playbook_title': '<span>🛡️</span> Executive Remediation Playbook & Check Point Best Practices',
      'diag.playbook_subtitle': 'Gaia shell commands and SmartConsole actions to mitigate diagnosed issues',
      'diag.pb_step1_title': 'Enable CoreXL Dynamic Dispatcher',
      'diag.pb_step1_desc': 'Eliminates the Core 1 bottleneck by dynamically distributing heavy traffic flows across all available workers.',
      'diag.pb_step2_title': 'Rebalance CoreXL Automatic Affinity',
      'diag.pb_step2_desc': 'Optimizes interface interrupt affinities on SND cores (0, 2) and frees worker cores for deep inspection.',
      'diag.pb_step3_title': 'Expand SecureXL Dispatcher Queue',
      'diag.pb_step3_desc': 'Prevents 5.83B F2P enqueue drops by increasing communication buffer size between kernel and userspace.',
      'diag.pb_step4_title': 'Enable Accelerated SYN Defense',
      'diag.pb_step4_desc': 'Protects CoreXL workers from 396k conns/s bursts by terminating TCP handshakes directly inside SecureXL.',
      'diag.pb_step5_title': 'Activate Drop Templates in SecureXL',
      'diag.pb_step5_desc': 'Hardware-drops the 124.4M Rulebase-denied packets without wasting CPU inspection cycles on firewall workers.',
      'diag.pb_step6_title': 'Optimize bond1 LACP Hashing to Layer 3+4',
      'diag.pb_step6_desc': 'Distributes traffic between eth1-13 and eth2-13 across L4 ports to prevent link saturation at 91.4% capacity.',
      'diag.btn_copy': 'Copy',
      'diag.btn_copied': '✓ Copied',

      // Overview Page
      'overview.kpi_avg_thru': 'Average Inbound Throughput',
      'overview.kpi_peak_thru': 'Peak maximum:',
      'overview.kpi_conns': 'Concurrent Connections',
      'overview.kpi_stable': 'Stable',
      'overview.kpi_monthly_peak': 'Monthly peak:',
      'overview.kpi_drops': 'Total Dropped Packets',
      'overview.kpi_psl_drops': '2.0M PSL drops',
      'overview.kpi_spikes': 'Spike Detective Events',
      'overview.kpi_thread_spikes': '1,092 thread spikes',
      'overview.chart_traffic_title': '<span>📈</span> Throughput & Network Traffic Evolution (30 Days)',
      'overview.chart_traffic_subtitle': 'Network throughput (Mbps) and packets per second aggregated hourly',
      'overview.chart_drops_title': '<span>🚫</span> Top Drop Reasons',
      'overview.chart_drops_subtitle': 'Percentage distribution of drop reasons',
      'overview.chart_cpu_title': '<span>🖥️</span> Overall CPU & RAM Memory Utilization',
      'overview.chart_cpu_subtitle': 'Average system load percentage and memory consumption (16 GB)',
      'overview.storage_title': '<span>💾</span> Storage Status',
      'overview.storage_subtitle': 'Disk partitions and percentage utilized',
      'overview.partition_label': 'Partition',
      'overview.free_gb': 'GB free',

      // System Page
      'system.kpi_cores': 'Assigned Cores',
      'system.kpi_cores_sub': '2 CoreXL FW Workers + 2 SND Cores',
      'system.kpi_ram': 'Total RAM Memory',
      'system.kpi_ram_sub': 'Average usage:',
      'system.kpi_os': 'Gaia OS Version',
      'system.kpi_os_sub': 'Jumbo Hotfix Main Take 28',
      'system.kpi_samples': 'Total DB Snapshots',
      'system.kpi_samples_sub': '1 sample per minute over 30 days',
      'system.table_cores_title': '<span>🧩</span> Core Architecture Breakdown (CoreXL / SND)',
      'system.btn_chart_cores': 'Chart Cores',
      'system.th_core_id': 'Core ID',
      'system.th_role': 'Assigned Role',
      'system.th_avg_usage': 'Avg Usage',
      'system.th_max_usage': 'Peak Usage',
      'system.th_usr_time': 'User Time (% Usr)',
      'system.th_sys_time': 'System Time (% Sys)',
      'system.th_idle_time': 'Idle Time (% Idle)',
      'system.th_interrupts': 'Max Interrupts',
      'system.th_load_state': 'Load State',
      'system.chart_timeline_title': '<span>📊</span> Individual Core Utilization Over Time',
      'system.chart_timeline_subtitle': 'Load comparison between SND Cores (0, 2) and CoreXL Workers (1, 3)',
      'system.details_title': '<span>📋</span> Node & Platform Parameters',
      'system.node_name': 'Node Name',
      'system.os_label': 'Operating System',
      'system.cp_version': 'Check Point Version',
      'system.jhf_branch': 'Jumbo HF Branch',
      'system.build_num': 'Build Number',
      'system.hw_model': 'Hardware Model',
      'system.operating_mode': 'Operating Mode',
      'system.cluster_status': 'Cluster Status',
      'system.uptime_label': 'Uptime',
      'system.monitored_period': 'Monitored Period',
      'system.total_snapshots': 'Total Snapshots',
      'system.rx_drops_hw': 'Rx Hardware Drops',

      // Interfaces Page
      'if.kpi_total': 'Total Interfaces',
      'if.kpi_total_sub': 'Physical, Bonds and 802.1Q VLANs',
      'if.kpi_top': 'Highest Traffic Interface',
      'if.kpi_top_sub': 'Peak: 9.25 Gbps | Avg: 878.5 Mbps',
      'if.kpi_vlan': 'Most Active VLAN',
      'if.kpi_vlan_sub': 'Peak: 7.39 Gbps | Avg: 472.6 Mbps',
      'if.kpi_hw_drops': 'HW Errors & Drops',
      'if.kpi_hw_drops_sub': 'No loss in HW ring buffers',
      'if.chart_top_title': '<span>📶</span> Top 10 Interfaces by Peak Throughput (Mbps)',
      'if.chart_top_subtitle': 'Comparison of peak Rx and Tx throughput',
      'if.table_title': '<span>📑</span> Complete Network Interface Inventory',
      'if.search_placeholder': 'Search by name, VLAN, or IP...',
      'if.btn_chart_ifs': 'Chart Interfaces',
      'if.filter_all': 'All',
      'if.filter_vlan': 'VLAN',
      'if.filter_bond': 'Bond',
      'if.filter_eth': 'Ethernet',
      'if.th_name': 'Interface Name',
      'if.th_type': 'Type',
      'if.th_speed': 'Speed',
      'if.th_state': 'State',
      'if.th_ipv4': 'IPv4 Address / Netmask',
      'if.th_rx_avg': 'Rx Avg (Mbps)',
      'if.th_rx_max': 'Rx Peak (Mbps)',
      'if.th_tx_avg': 'Tx Avg (Mbps)',
      'if.th_tx_max': 'Tx Peak (Mbps)',
      'if.th_drops_errors': 'Drops / Errors',
      'if.not_assigned': 'Not assigned',

      // Traffic & Connections Page
      'traffic.kpi_fw_avg': 'Avg FW Connections',
      'traffic.kpi_fw_sub': 'Handshake + Established + Non-TCP',
      'traffic.kpi_host_sxl': 'Host SecureXL Conns',
      'traffic.kpi_host_sxl_sub': 'Accelerated peak:',
      'traffic.kpi_rate_max': 'Max New Connection Rate',
      'traffic.kpi_rate_max_sub': 'Avg: 7,940 conns/sec',
      'traffic.kpi_pkt_max': 'Peak Packet Rate',
      'traffic.kpi_pkt_max_sub': 'Inbound packet rate peak',
      'traffic.chart_conns_title': '<span>🛡️</span> Concurrent Connections Breakdown by Component',
      'traffic.chart_conns_subtitle': 'Timeline comparing Firewall (FW), Host SXL, and Host Streaming',
      'traffic.chart_states_title': '<span>🔄</span> Firewall Connection States',
      'traffic.chart_states_subtitle': 'Established TCP, Handshake, and Non-TCP/UDP Connections',
      'traffic.chart_rate_title': '<span>⚡</span> New Connection Rate (Conns/sec)',

      // Drops Page
      'drops.kpi_rulebase': 'Total Policy Drops',
      'drops.kpi_rulebase_sub': 'Reason 7: Rulebase Drop (Policies)',
      'drops.kpi_psl': 'Streaming (PSL) Drops',
      'drops.kpi_psl_sub': 'Reason 177: General PSL',
      'drops.kpi_antispoof': 'Anti-Spoofing PPAK Drops',
      'drops.kpi_antispoof_sub': 'Kernel PPAK accelerated',
      'drops.kpi_templates': 'Drop Templates',
      'drops.kpi_templates_sub': 'SecureXL fast hardware discard',
      'drops.chart_hourly_title': '<span>📉</span> Hourly Discarded Packets Evolution',
      'drops.chart_ppak_title': '<span>🛡️</span> PPAK 0 Drops Category',
      'drops.table_title': '<span>📋</span> Detailed Drop Reasons Table (fwdrop_drop_resaons_tab)',
      'drops.btn_chart_drops': 'Chart Drops',
      'drops.th_code': 'Reason Code',
      'drops.th_desc': 'Drop Description',
      'drops.th_module': 'Affected Module',
      'drops.th_total_pkts': 'Total Packets',
      'drops.th_pct': 'Percentage of Total',
      'drops.th_impact': 'Operational Impact',

      // Spikes Page
      'spikes.kpi_cpu': 'Recorded CPU Spikes',
      'spikes.kpi_cpu_sub': 'Events detected by Spike Detective',
      'spikes.kpi_threads': 'Thread Spikes',
      'spikes.kpi_threads_sub': 'Individual high-load threads',
      'spikes.kpi_top_consumer': 'Top Consumer',
      'spikes.kpi_top_consumer_sub': 'Firewall Kernel Worker Core 1',
      'spikes.kpi_max_dur': 'Max Duration',
      'spikes.kpi_max_dur_sub': '12,717 continuous sec in fwk0_0',
      'spikes.alarm_level_label': 'Minimum Alarm Level:',
      'spikes.btn_all_levels': 'All Levels',
      'spikes.btn_mod_level': '🟡 Moderate (≥ 75%)',
      'spikes.btn_high_level': '🟠 High (≥ 80%)',
      'spikes.btn_crit_level': '🔴 Critical Only (≥ 90%)',
      'spikes.chart_timeline_title': '<span>📈</span> Daily CPU Spike Frequency Timeline',
      'spikes.chart_timeline_subtitle': 'Number of spike events detected by date on the node',
      'spikes.chart_cores_title': '<span>🧩</span> Distribution by Core',
      'spikes.chart_cores_subtitle': 'Concentration of spikes per CPU core',
      'spikes.chart_consumers_title': '<span>🔥</span> Top CPU-Consuming Processes',
      'spikes.chart_consumers_subtitle': 'Processes with highest spike frequency and severity',
      'spikes.chart_threads_title': '<span>🧵</span> Spikes by Thread Name',
      'spikes.chart_threads_subtitle': 'Individual threads with highest sustained consumption',
      'spikes.table_title': '<span>📋</span> Spike Detective Event Log (CPU Spikes)',
      'spikes.search_placeholder': 'Filter by process (fwk, pdpd, sqlite)...',
      'spikes.btn_chart_spikes': 'Chart Events',
      'spikes.th_datetime': 'UTC Date & Time',
      'spikes.th_core': 'Core',
      'spikes.th_consumer': 'Consumer Process',
      'spikes.th_avg_cpu': 'Avg CPU Usage',
      'spikes.th_duration': 'Duration (sec)',
      'spikes.th_severity': 'Severity',
      'spikes.severity_moderate': 'Moderate',
      'spikes.severity_high': 'High',
      'spikes.severity_crit': 'Critical',

      // Flow Profiler (Flofiler) Page
      'flofiler.kpi_proto': 'Leading L4 Protocol',
      'flofiler.kpi_proto_sub': '9.3M and 9.1M CPU cycles',
      'flofiler.kpi_kernel': 'Leading Kernel Module',
      'flofiler.kpi_kernel_sub': '23.8M sequential inspection cycles',
      'flofiler.kpi_f2f': 'Inbound F2F',
      'flofiler.kpi_f2f_sub': 'Forward to Firewall cycles',
      'flofiler.kpi_rules': 'Rule Inspection',
      'flofiler.kpi_rules_sub': 'Cycles dedicated to Access Rulebase',
      'flofiler.chart_protocols_title': '<span>📊</span> Top Protocols & Services by CPU Cycles',
      'flofiler.chart_components_title': '<span>🧩</span> Top Check Point Inspection Components',

      // SecureXL & CoreXL Page
      'securexl.kpi_status': 'SecureXL Status',
      'securexl.kpi_status_val': 'Enabled (On)',
      'securexl.kpi_status_sub': '100% of monitoring window',
      'securexl.kpi_fails': 'Enqueue Fails Queues',
      'securexl.kpi_fails_sub': 'F2P packet userspace (Multik)',
      'securexl.kpi_inbound': 'Inbound Packet Userspace',
      'securexl.kpi_inbound_sub': 'Multik enqueue fail count',
      'securexl.kpi_ppak_peak': 'PPAK VS0 Peak Throughput',
      'securexl.kpi_ppak_peak_sub': 'Accelerated in virtual node 0',
      'securexl.chart_f2v_title': '<span>🔄</span> F2V Reasons (Forward to Virtual / CoreXL)',
      'securexl.chart_fails_title': '<span>📦</span> Multik Dispatcher Enqueue Fails',
      'securexl.chart_ppak_title': '<span>📈</span> PPAK VS0 - Accelerated Throughput & Connections',

      // Blades Page
      'blades.kpi_tls': 'TLS Secure Connections',
      'blades.kpi_tls_sub': 'Active cryptographic cipher suites',
      'blades.kpi_vpn': 'IPsec VPN / IKE SAs',
      'blades.kpi_vpn_val': 'Monitored Tunnels',
      'blades.kpi_vpn_sub': 'Zero IKE negotiation failures',
      'blades.kpi_av': 'Anti-Virus / Bot Signatures',
      'blades.kpi_av_val': 'Up to date',
      'blades.kpi_av_sub': 'AV Lite and App Control modules',
      'blades.kpi_tracker': 'Avg Log Tracker Rate',
      'blades.kpi_tracker_sub': 'Connection logging throughput',
      'blades.chart_vpn_title': '<span>🔐</span> VPN Tunnel Activity (Peers & IKE SAs)',

      // DB Explorer Page
      'db.console_title': '⚡ Direct SQL Query Console (Read-Only)',
      'db.btn_run_sql': '▶ Execute SQL',
      'db.btn_sample_cpu': 'Example: CPU',
      'db.btn_sample_disks': 'Example: Disks',
      'db.btn_sample_spikes': 'Example: Spikes',
      'db.status_ready': 'Ready',
      'db.status_executing': 'Executing query...',
      'db.status_rows_fetched': 'rows fetched',
      'db.results_title': '<span>📊</span> SQL Query Results',
      'db.btn_chart_results': 'Chart Results',
      'db.btn_close_results': '✕ Close',
      'db.catalog_title': '<span>🗄️</span> SQLite Database Tables Catalog (122 Active Tables)',
      'db.catalog_subtitle': 'Click on any table to open the interactive live record viewer',
      'db.filter_tables_placeholder': 'Filter tables (e.g. CPU, HW, vpn, fw)...',
      'db.th_table_name': 'Table Name',
      'db.th_category': 'Category / Prefix',
      'db.th_total_rows': 'Total Rows',
      'db.th_num_cols': 'Col Count',
      'db.th_key_cols': 'Key Columns',
      'db.th_actions': 'Actions',
      'db.btn_view_records': '🔍 View Records',

      // Modal: Load Database
      'modal_db.title': '📂 Load Another CPView Machine Data',
      'modal_db.subtitle': 'Visualize and analyze performance data from any Check Point node (.CPViewDB.dat or .sqlite files)',
      'modal_db.tab_detected': '📁 Server Files',
      'modal_db.tab_upload': '⬆️ Upload New File',
      'modal_db.tab_path': '🖥️ Server Path',
      'modal_db.detected_desc': 'CPView databases automatically detected in application directory:',
      'modal_db.searching': 'Searching for available databases...',
      'modal_db.dropzone_title': 'Drag and drop another machine file here',
      'modal_db.dropzone_desc': 'Select any <code>.CPViewDB.dat</code> or SQLite database extracted from a Check Point Security Gateway or VSX.',
      'modal_db.btn_browse': '📁 Browse Local File',
      'modal_db.uploading_label': 'Uploading file...',
      'modal_db.uploading_sub': 'Transferring and extracting metrics...',
      'modal_db.path_desc': 'Enter absolute or relative path to an existing CPView SQLite file on the server:',
      'modal_db.path_placeholder': '/path/to/SG_OTHER-NODE_CPViewDB.dat',
      'modal_db.btn_load_path': '▶ Load File',
      'modal_db.path_example': 'Example: <code>./SG_FWNET-ch01-01_2_4_2024_16_27.CPViewDB.dat</code>',
      'modal_db.loading_title': 'Extracting node metrics...',
      'modal_db.loading_desc': 'Aggregating time-series data and resolving CPView reference tables...',
      'modal_db.card_active': 'Active',
      'modal_db.card_current_btn': '✓ Active Machine',
      'modal_db.card_load_btn': '▶ Load This Machine',

      // Modal: Custom Chart Generator
      'chartgen.title': 'Custom Table Chart Builder',
      'chartgen.subtitle': 'Configure axes, metrics, aggregation operations and temporal grouping',
      'chartgen.btn_toggle_controls': 'Hide Controls',
      'chartgen.btn_show_controls': 'Show Controls',
      'chartgen.btn_fullscreen': 'Fullscreen',
      'chartgen.opt_cpu_cores': '🧩 Table: CPU Cores',
      'chartgen.opt_interfaces': '🌐 Table: Interfaces',
      'chartgen.opt_drop_reasons': '📋 Table: Drop Reasons',
      'chartgen.opt_cpu_spikes': '🔍 Table: Spike Detective Events',
      'chartgen.opt_sql_results': '⚡ Table: SQL Query Results',
      'chartgen.opt_modal_table': '🗄️ Table: Active SQLite Viewer',
      'chartgen.label_x': '📍 X Axis (Category / Dimension / Time)',
      'chartgen.label_time': '⏱️ Time Format Treatment',
      'chartgen.opt_time_none': 'Plain Text / No date formatting',
      'chartgen.opt_time_datetime': '📅 Full Date & Time (DD/MM HH:mm)',
      'chartgen.opt_time_date': '📆 Days Only (DD/MM/YYYY)',
      'chartgen.opt_time_hour': '⏰ Hour of Day (00h - 23h)',
      'chartgen.opt_time_weekday': '🗓️ Day of Week (Monday - Sunday)',
      'chartgen.opt_time_hour_dt': '⏱️ Chronological Hourly (DD/MM HH:00)',
      'chartgen.opt_time_minute': '⏱️ Chronological Minute (DD/MM HH:mm)',
      'chartgen.label_y': '📈 Y Axis (Metric / Measure)',
      'chartgen.label_op': '🧮 Operation / Aggregation',
      'chartgen.opt_op_sum': 'Sum of Values (SUM)',
      'chartgen.opt_op_sum_day': '📅 Daily Sum (SUM by Day)',
      'chartgen.opt_op_sum_hour': '⏰ Hourly Sum (SUM by Hour)',
      'chartgen.opt_op_sum_min': '⏱️ Minute Sum (SUM by Minute)',
      'chartgen.opt_op_count': 'Row Count / Frequency (COUNT)',
      'chartgen.opt_op_avg': 'Average / Mean (AVG)',
      'chartgen.opt_op_max': 'Maximum Peak (MAX)',
      'chartgen.opt_op_min': 'Minimum Value (MIN)',
      'chartgen.opt_op_raw': 'Direct Raw Values (No grouping)',
      'chartgen.label_slice': '🔢 Record Selection / Slicing',
      'chartgen.opt_slice_all': 'All table records',
      'chartgen.opt_slice_last100': 'Last 100 records (most recent)',
      'chartgen.opt_slice_last500': 'Last 500 records',
      'chartgen.opt_slice_last1000': 'Last 1,000 records',
      'chartgen.opt_slice_last5000': 'Last 5,000 records',
      'chartgen.opt_slice_first100': 'First 100 records (oldest)',
      'chartgen.opt_slice_first500': 'First 500 records',
      'chartgen.opt_slice_first1000': 'First 1,000 records',
      'chartgen.label_date_range': '📅 Date Range (From — To)',
      'chartgen.date_to_separator': 'to',
      'chartgen.btn_reset_dates': '✕ All',
      'chartgen.label_shortcuts': '⚡ Range Shortcuts',
      'chartgen.preset_all': 'All',
      'chartgen.label_type': 'Type:',
      'chartgen.type_bar': '📊 Bars',
      'chartgen.type_horiz': '📉 Horiz',
      'chartgen.type_line': '📈 Line',
      'chartgen.type_area': '🏔️ Area',
      'chartgen.type_pie': '🥧 Pie',
      'chartgen.type_doughnut': '🍩 Donut',
      'chartgen.label_sort': 'Sort:',
      'chartgen.opt_sort_ydesc': 'Highest to Lowest (Top Y)',
      'chartgen.opt_sort_yasc': 'Lowest to Highest (Y asc)',
      'chartgen.opt_sort_xasc': 'X Axis Ascending (A-Z / Chrono)',
      'chartgen.opt_sort_xdesc': 'X Axis Descending',
      'chartgen.opt_sort_original': 'Original Row Order',
      'chartgen.label_limit': 'Limit:',
      'chartgen.opt_limit_all': 'All',
      'chartgen.opt_limit_10': 'Top 10',
      'chartgen.opt_limit_15': 'Top 15',
      'chartgen.opt_limit_25': 'Top 25',
      'chartgen.opt_limit_50': 'Top 50',
      'chartgen.label_color': 'Color:',
      'chartgen.view_summary': '📊 Chart View:',
      'chartgen.no_data': 'ℹ️ No data available to plot with current configuration.',
      'chartgen.stat_categories': 'Categories / Points',
      'chartgen.stat_sum': 'Total Sum',
      'chartgen.stat_avg': 'Average / Mean',
      'chartgen.stat_max': 'Maximum Peak',
      'chartgen.stat_min': 'Minimum',
      'chartgen.footer_info': 'Interactive chart generated in real-time',
      'chartgen.btn_copy_csv': '📋 Copy CSV',
      'chartgen.btn_download_png': '💾 Download PNG Image',
      'chartgen.btn_close': 'Close',

      // Modal: Table Viewer
      'tableview.subtitle': 'Direct records with CPView reference mapping',
      'tableview.search_placeholder': 'Filter current rows...',
      'tableview.btn_chart': '📊 Chart Records',
      'tableview.loading': 'Loading records...',
      'tableview.page_prefix': 'Page',
      'tableview.btn_prev': '◀ Previous',
      'tableview.btn_next': 'Next ▶',
      'tableview.empty': 'No records found',

      // Common Terms & Days
      'common.empty_val': '(Empty)',
      'common.day_mon': 'Monday',
      'common.day_tue': 'Tuesday',
      'common.day_wed': 'Wednesday',
      'common.day_thu': 'Thursday',
      'common.day_fri': 'Friday',
      'common.day_sat': 'Saturday',
      'common.day_sun': 'Sunday',
      'common.showing': 'Showing',
      'common.of': 'of',
      'common.events': 'events',
      'common.incidents': 'incidents',
      'common.all': 'All',
      'if.kpi_excellent': 'Excellent',
      'db.console_db_label': 'Database:',
      'chartgen.lbl_toggle_controls': 'Hide Controls',
      'chartgen.lbl_fullscreen': 'Full Screen',
      'diag.cause_cpu_conns': 'Critical confluence: CoreXL Worker 1 saturation caused by massive burst of slow-path TCP connection establishments.',
      'diag.remedy_cpu_conns': 'Enable Dynamic Dispatcher (fw ctl multik dynamic_disp on) and Accelerated SYN Defense (fw ctl set int sim_syn_defense 1).',
      'diag.cause_drops_traffic': 'High throughput confluence with drop bursts in Rulebase or Anti-Spoofing PPAK. Inspection pipeline overload.',
      'diag.remedy_drops_traffic': 'Enable Drop Templates in SecureXL (fw accel drop_templates on) and review interface topology groups.',
      'diag.cause_midnight': 'Nightly cyclic degradation due to batch jobs in crontab, CPView dumps, and log rotation at 00:00 UTC.',
      'diag.remedy_midnight': 'Stagger midnight cron jobs in crontab (rotation at 01:15, backups at 02:30, compression at 03:45).',
      'diag.cause_multivar': 'Punctual multivariable anomaly generating transient contention of kernel resources and network buffers.',
      'diag.remedy_multivar': 'Check sim affinity -a and expand SecureXL queue buffers (sim_dispatcher_queue_size 4096).',
      'diag.incidents_filtered': '{count} filtered incidents (of {total})',
      'diag.filter_tag': 'Filtered: {day} {hour}h',
      'diag.btn_reset_filter': '✕ Clear',
      'diag.btn_copy_report': '📋 Copy Forensic Report',
      'diag.btn_report_copied': '✓ Report Copied',
      'diag.exact_values': '📊 Exact Metrics in Window',
      'diag.drawer_cause': '🔍 Diagnosis & Root Cause',
      'diag.drawer_remedy': '🛠️ Recommended Check Point Remediation',
      'spikes.filtered_active': 'active spikes',
      'spikes.all_levels': 'All levels',
      'spikes.moderate_label': 'Moderate (≥ 75% CPU)',
      'spikes.high_label': 'High & Critical (≥ 80% CPU)',
      'spikes.critical_label': 'Critical Only (≥ 90% CPU)',
      'spikes.no_events': 'No events found',
      'spikes.showing_pagination': 'Showing {start} - {end} of {total} events',
      'system.high_demand': 'High Demand',
      'system.normal': 'Normal',
      'diag.showing_pagination': 'Showing {start} - {end} of {total} incidents (Page {page} of {totalPages})',
      'diag.no_incidents_match': 'No incidents match the filters',
      'diag.no_incidents_found': 'No incidents found matching the selected criteria.',
      'diag.btn_hide': '▲ Hide',
      'diag.btn_view_detail': '▼ View Details',
      'modal.table_prefix': 'Table:',
      'modal.loading_data': 'Loading data...',
      'modal.querying_records': 'Querying records...',
      'modal.sample_pre_extracted': 'Pre-extracted sample (Total in SQLite: {total})',
      'modal.page_total_records': 'Page {page} (Total: {total} records)',
      'modal.error_load': 'Could not load records for this table.',
      'db.rows_fetched_count': '{count} rows fetched',
      'header.days_suffix': 'days',
      'sidebar.badge_tables_suffix': 'Tables'
    },

    pt: {
      // Language Selector
      'lang.select_language': 'Idioma / Language',
      'lang.es_name': 'Español',
      'lang.es_desc': 'Espanhol (Castelhano)',
      'lang.en_name': 'English',
      'lang.en_desc': 'Inglês (Internacional)',
      'lang.pt_name': 'Português',
      'lang.pt_desc': 'Português (Brasil / Portugal)',

      // Sidebar
      'sidebar.node_active': 'Nó Ativo',
      'sidebar.cores_count': '4 Cores',
      'sidebar.sec_diag': 'Diagnóstico e Saúde',
      'sidebar.nav_diagnostics': 'Análise de Problemas',
      'sidebar.badge_anomalies': '8 Alertas',
      'sidebar.sec_monitor': 'Monitoramento Geral',
      'sidebar.nav_overview': 'Resumo Executivo',
      'sidebar.nav_system': 'Sistema e CPU',
      'sidebar.badge_cores': '4 Cores',
      'sidebar.nav_interfaces': 'Interfaces de Rede',
      'sidebar.badge_ifs': '50+ IFs',
      'sidebar.sec_traffic': 'Tráfego e Inspeção',
      'sidebar.nav_traffic': 'Tráfego e Conexões',
      'sidebar.badge_conns': '400k',
      'sidebar.nav_drops': 'Descartes e Drops',
      'sidebar.badge_drops': '124M',
      'sidebar.nav_flofiler': 'Flow Profiler (CPU)',
      'sidebar.nav_securexl': 'SecureXL e CoreXL',
      'sidebar.sec_blades': 'Diagnóstico e Blades',
      'sidebar.nav_spikes': 'Spike Detective',
      'sidebar.badge_spikes': '1.9k',
      'sidebar.nav_blades': 'VPN e Blades',
      'sidebar.nav_db_explorer': 'Explorador SQLite',
      'sidebar.badge_tables': '122 Tabelas',
      'sidebar.footer_os': 'Check Point Gaia 64-bit',
      'sidebar.footer_take': 'Take 28',

      // Top Header
      'header.node_label': 'Máquina:',
      'header.uptime_label': 'Uptime:',
      'header.cluster_label': 'Cluster:',
      'header.btn_theme_title': 'Selecionar tema visual de alto contraste',
      'header.btn_scale_title': 'Ajustar escala da interface e tipografia',
      'header.btn_chart_builder': 'Criador de Gráficos',
      'header.btn_chart_builder_title': 'Abrir criador de gráficos personalizados para qualquer tabela',
      'header.btn_load_db': 'Carregar Outra Máquina / BD',
      'header.btn_export_json': 'Exportar JSON',
      'header.days_suffix': 'dias',

      // Page Titles
      'title.diagnostics': '<span>🚨</span> Diagnóstico e Análise Forense de Problemas e Incidentes',
      'title.overview': '<span>📊</span> Resumo Executivo do Gateway',
      'title.system': '<span>🖥️</span> Arquitetura de Sistema, CPU e Memória',
      'title.interfaces': '<span>🌐</span> Catálogo e Desempenho de Interfaces de Rede',
      'title.traffic': '<span>🛡️</span> Conexões e Taxas de Tráfego Firewall',
      'title.drops': '<span>🚫</span> Análise Detalhada de Descartes (Drop Reasons)',
      'title.spikes': '<span>🔍</span> Spike Detective - Diagnóstico de Processos',
      'title.flofiler': '<span>🌊</span> Flow Profiler - Distribuição de Ciclos CPU',
      'title.securexl': '<span>⚡</span> SecureXL e Aceleração CoreXL',
      'title.blades': '<span>🔐</span> Software Blades, VPN e Conexões Seguras',
      'title.db_explorer': '<span>🗄️</span> Explorador de Tabelas e Consultas SQLite',

      // Theme Selector Menu
      'theme.header': 'Temas de Alto Contraste',
      'theme.default_name': 'Cyber Dark (Original)',
      'theme.default_desc': 'Check Point escuro com ciano',
      'theme.gold_name': 'Obsidian & Gold',
      'theme.gold_desc': 'Preto azeviche com ouro e âmbar',
      'theme.emerald_name': 'Matrix Emerald',
      'theme.emerald_desc': 'Verde esmeralda neon NOC/SOC',
      'theme.sapphire_name': 'Midnight Sapphire',
      'theme.sapphire_desc': 'Azul real profundo com gelo',
      'theme.violet_name': 'Neon Violet',
      'theme.violet_desc': 'Ametista cósmico com magenta',
      'theme.monochrome_name': 'Monochrome OLED',
      'theme.monochrome_desc': 'Preto puro e branco de contraste máximo',
      'theme.light_name': 'Solarized Light',
      'theme.light_desc': 'Modo claro nítido de alto contraste',

      // Scale & Font Menu
      'scale.header': 'Escala e Tipografia',
      'scale.reset_btn': '↺ Redefinir',
      'scale.reset_title': 'Restaurar valores padrão (100%)',
      'scale.zoom_title': '🖥️ Escala da Interface (Zoom)',
      'scale.zoom_dec': 'Reduzir zoom',
      'scale.zoom_inc': 'Aumentar zoom',
      'scale.font_title': '🔤 Tamanho da Fonte',
      'scale.font_dec': 'Reduzir tamanho da fonte',
      'scale.font_inc': 'Aumentar tamanho da fonte',
      'scale.family_title': '🖋️ Tipo de Fonte',
      'scale.family_inter_desc': 'Padrão Check Point',
      'scale.family_roboto_desc': 'Limpa e moderna',
      'scale.family_system_name': 'Sistema Nativo',
      'scale.family_system_desc': 'Segoe UI / SF Pro / Ubuntu',
      'scale.family_mono_desc': 'Modo terminal técnico SOC',
      'scale.family_dyslexic_name': 'Alta Legibilidade',
      'scale.family_dyslexic_desc': 'Atkinson Hyperlegible / Acessível',
      'scale.shortcuts_tip': '⌨️ Atalhos: <kbd>Ctrl</kbd>+<kbd>+</kbd>/<kbd>-</kbd> Zoom · <kbd>Ctrl</kbd>+<kbd>0</kbd> 100%',

      // Diagnostics Hero
      'diag.hero_score_label': 'Saúde / 100',
      'diag.hero_title': '<span>🚨</span> Diagnóstico Forense de Problemas e Confluência Temporal',
      'diag.hero_desc': 'Auditoria automatizada dos dados de desempenho do CPView (1.34 GB, 722 horas e 126.8M descartes). Detectada <strong>confluência crítica de indicadores</strong>: saturação periódica do CoreXL Worker #1, rajadas de 396k conexões/s e mais de 5.8 bilhões de descartes por transbordamento de fila no SecureXL.',
      'diag.pill_crit_num': '3 Críticos',
      'diag.pill_crit_label': 'Severidade Alta',
      'diag.pill_high_num': '4 Altos',
      'diag.pill_high_label': 'Risco Operacional',
      'diag.pill_slots_label': 'Faixas Confluentes',
      'diag.pill_cyclic_num': '2 Cíclicos',
      'diag.pill_cyclic_label': 'Padrões Diários',

      // Diagnostics Problem Cards Section
      'diag.audit_title': '<span>🔍</span> Auditoria Sistemática de Problemas Detectados nas Tabelas',
      'diag.audit_subtitle': 'Análise multivariável de gargalos em CPU, filas SecureXL, enlaces de rede e descartes',
      'diag.badge_critical': 'Crítico',
      'diag.badge_high': 'Alto',
      'diag.badge_recurrent': 'Recorrente',
      'diag.badge_info': 'Informativo',
      'diag.evidence_label': 'Evidência nas tabelas:',
      'diag.confluence_label': 'Confluência Temporal:',
      'diag.rootcause_label': 'Causa Raiz & Solução:',

      // Problem Card 1
      'diag.p1_title': 'Saturação e Desequilíbrio no CoreXL FW Worker #1 (fwk0_1)',
      'diag.p1_evidence': 'Core 1 acumula <strong>898 picos de CPU</strong> no Spike Detective (45.4% do total), com picos contínuos de <strong>100%</strong> e durações de até <strong>7,711s (2.1 horas)</strong>. Os cores SND (0 e 2) têm média de apenas 11% de CPU.',
      'diag.p1_chip1': '🔴 CPU Core 1: 100%',
      'diag.p1_chip2': '🟣 Conn Rate: 396k/s',
      'diag.p1_chip3': '🔵 Tráfego F2F',
      'diag.p1_remedy': 'Desbalanceamento de afinidade no CoreXL Dispatcher. Conexões pesadas não são distribuídas uniformemente.',

      // Problem Card 2
      'diag.p2_title': 'Colapso do Despachador SecureXL: 5.83B Falhas F2P',
      'diag.p2_evidence': '<code>fwmultik_dispatcher_vs_stats_enqueue_fail...</code> registra <strong>5,835,841,087 falhas F2P</strong> para espaço de usuário e <strong>43.7M falhas Inbound</strong>. Há 123M pacotes não acelerados por <code>Inspect handler</code>.',
      'diag.p2_chip1': '🔴 F2P Drops: 5.83B',
      'diag.p2_chip2': '🔴 Worker Starvation',
      'diag.p2_chip3': '🔵 Slow Path Burst',
      'diag.p2_remedy': 'Transbordamento de filas no despachador para userspace. Aumentar o tamanho do buffer e otimizar templates SecureXL.',

      // Problem Card 3
      'diag.p3_title': 'Rajadas Massivas de Novas Conexões (Até 396k conns/s)',
      'diag.p3_evidence': 'A taxa de estabelecimento dispara de ~10k para <strong>396,498 conns/s</strong> (aumento de 3,800%), coincidindo com picos de conexões em estado <code>tcp_handshake</code> e saturação de cores do firewall.',
      'diag.p3_chip1': '🟣 Conn Rate: 396k/s',
      'diag.p3_chip2': '🔴 Cores 1 & 3: 98%',
      'diag.p3_chip3': '🟡 Rulebase Drops',
      'diag.p3_remedy': 'Abertura massiva de sessões por varreduras ou ataques SYN. Ativar Accelerated SYN Defender no SecureXL.',

      // Problem Card 4
      'diag.p4_title': 'Volume Massivo de Descartes: 124.4M Rulebase e 21M Anti-Spoofing',
      'diag.p4_evidence': '126.8M descartes totais. 98.1% originados por <code>Rulebase</code> e 21M por <code>Anti-Spoofing PPAK</code>. Em <strong>13 de março às 12:00 UTC</strong> ocorreu um pico extremo de <strong>535,248 drops/h</strong>.',
      'diag.p4_chip1': '🟠 Drops: 535k/h',
      'diag.p4_chip2': '🔵 Throughput: 506 Gbps',
      'diag.p4_chip3': '🔴 CPU Core 1: 94%',
      'diag.p4_remedy': 'Habilitar Drop Templates para descartar em hardware/SND antes de carregar o CoreXL. Auditar topologia Anti-Spoofing.',

      // Problem Card 5
      'diag.p5_title': 'Saturação Próxima à Taxa de Linha no Enlace 10G eth2-13 (9.14 Gbps)',
      'diag.p5_evidence': 'Interface física <code>eth2-13</code> atinge pico de <strong>9,138.76 Mbps (91.4% de um link 10G)</strong>. Em agregação, <code>bond1</code> supera <strong>9.39 Gbps</strong>, gerando risco imediato de micro-drops.',
      'diag.p5_chip1': '🔵 Throughput: 9.14 Gbps',
      'diag.p5_chip2': '🔴 Buffer Queuing',
      'diag.p5_remedy': 'Desbalanceamento LACP. Alterar o algoritmo de hash do bond para distribuir tráfego uniformemente entre os enlaces.',

      // Problem Card 6
      'diag.p6_title': 'Padrão Cíclico à Meia-noite (00:00 UTC - 83.3% dos Dias)',
      'diag.p6_evidence': 'Em <strong>25 dos 30 dias (83.3%)</strong> às 00:00 UTC, o Core 1 ultrapassa 75% de CPU com rajadas de <code>sqlite3</code>, <code>fwk0_TRACK_WRTR</code> e rotação de logs.',
      'diag.p6_chip1': '🟢 25/30 Dias às 00h',
      'diag.p6_chip2': '🔴 CPU Spike Core 1',
      'diag.p6_remedy': 'Tarefas agendadas no crontab e rotação de logs colidindo às 00:00. Escalonar horários no crontab.',

      // Problem Card 7
      'diag.p7_title': 'Padrão Comercial de Meio-dia (11:00 - 13:00 UTC - 53% dos Dias)',
      'diag.p7_evidence': 'Em dias úteis (seg-sex), 53% dos dias apresentam saturação coincidente de conexões e CPU nesta faixa. Nos fins de semana cai para 4.2%.',
      'diag.p7_chip1': '🟢 Seg-Sex 11h - 13h',
      'diag.p7_chip2': '🟣 Pico Usuários',
      'diag.p7_remedy': 'Pico de tráfego corporativo no horário comercial. Otimizar inspeção SSL para tráfego não crítico.',

      // Problem Card 8
      'diag.p8_title': 'Ineficiência na Aceleração: 223M Pacotes F2F e 51.5% CPU em Chain Modules',
      'diag.p8_evidence': 'Flofiler revela que <strong>51.51% dos ciclos de CPU</strong> são dissipados em <code>Chain modules</code> e 13.0% em <code>Inbound F2F</code>. SecureXL desviou <strong>123.1M pacotes por Inspect handler</strong> e 99.8M por protocolo IP não acelerado. Tráfego dominado por DNS (UDP:53 com 21.3%) e SMB (TCP:445 com 12.6%).',
      'diag.p8_chip1': '🔴 Chain Modules: 51.5%',
      'diag.p8_chip2': '🔵 DNS / SMB L7',
      'diag.p8_chip3': '🟡 F2F Slow Path',
      'diag.p8_remedy': 'Pacotes processados no caminho lento (PPAK bypass) por inspeções complexas de camada 7. Otimizar SecureXL Drop Templates e regras de aceleração.',

      // Diagnostics Temporal Confluence Chart
      'diag.chart_title': '<span>📈</span> Correlação Temporal Multivariável de Indicadores (30 Dias)',
      'diag.chart_subtitle': 'Sobreposição simultânea de CPU Core 1, Throughput, Taxa de Conexões e Drops. Permite identificar confluências críticas na linha temporal.',
      'diag.range_all': 'Mês Completo (30D)',
      'diag.range_14d': '14 Dias',
      'diag.range_7d': '7 Dias',
      'diag.range_crit': 'Janela Crítica (11-15 Mar)',
      'diag.chart_tip': '💡 Passe o cursor pelas curvas para inspecionar a confluência exata das métricas em qualquer hora.',
      'diag.chart_samples': '722 amostras horárias correlacionadas',
      'diag.ds_cpu_max': 'CPU Core 1 Máx (%)',
      'diag.ds_cpu_avg': 'CPU Média Total (%)',
      'diag.ds_traffic_peak': 'Tráfego Pico (Gbps)',
      'diag.ds_conn_rate': 'Novas Conexões (k c/s)',
      'diag.ds_drops_total': 'Descartes Totais (k drops/h)',

      // Diagnostics Heatmap
      'diag.heatmap_title': '<span>🗓️</span> Mapa de Calor de Recorrência: Faixas Críticas por Hora e Dia',
      'diag.heatmap_subtitle': 'Distribuição temporal de horas com alta carga (Core 1 ≥ 75%). Revela instantaneamente o padrão diário à meia-noite e o ciclo de trabalho.',
      'diag.heatmap_level_label': 'Nível de Carga:',
      'diag.heatmap_lvl_normal': 'Normal',
      'diag.heatmap_lvl_mod': 'Moderado',
      'diag.heatmap_lvl_high': 'Alto',
      'diag.heatmap_lvl_crit': 'Crítico',
      'diag.heatmap_lvl_extreme': 'Extremo',
      'diag.heatmap_lvl_saturation': 'Saturação Recorrente',

      // Diagnostics Incidents Table
      'diag.incidents_title': '<span>📋</span> Registro Detalhado de Incidentes com Confluência Multivariável',
      'diag.incidents_subtitle': 'Faixas temporais onde coincidiram 2 ou mais indicadores anômalos. Clique em qualquer linha para ver o detalhamento forense e remediação.',
      'diag.incidents_search_placeholder': '🔍 Buscar por data (ex. 2024-03-13), métrica ou causa...',
      'diag.filter_all_sev': 'Todas as Severidades',
      'diag.filter_only_crit': 'Apenas Críticos (🔴)',
      'diag.filter_high_crit': 'Altos e Críticos (🟠/🔴)',
      'diag.filter_med': 'Médios (🟡)',
      'diag.filter_all_nat': 'Todas as Naturezas',
      'diag.filter_recurrent': 'Apenas Recorrentes (Padrão)',
      'diag.filter_punctual': 'Apenas Pontuais (Anomalias)',
      'diag.th_datetime': 'Data e Hora (UTC)',
      'diag.th_severity': 'Severidade',
      'diag.th_nature': 'Natureza',
      'diag.th_confluence': 'Confluência de Indicadores',
      'diag.th_action': 'Ação',
      'diag.btn_view_details': 'Ver Detalhes',
      'diag.btn_hide_details': 'Ocultar',
      'diag.pagination_prev': '◀ Anterior',
      'diag.pagination_next': 'Seguinte ▶',
      'diag.no_incidents': 'Nenhum incidente encontrado para os critérios selecionados.',
      'diag.badge_recurrent': '🔁 Recorrente',
      'diag.badge_punctual': '⚡ Pontual',
      'diag.detail_metrics_breakdown': 'Detalhamento de Métricas Confluentes:',
      'diag.detail_root_cause': 'Causa Raiz Diagnosticada:',
      'diag.detail_remediation': 'Remediação Recomendada:',

      // Diagnostics Playbook
      'diag.playbook_title': '<span>🛡️</span> Playbook Executivo de Remediação e Boas Práticas Check Point',
      'diag.playbook_subtitle': 'Comandos de console Gaia e ações no SmartConsole para mitigar os problemas diagnosticados',
      'diag.pb_step1_title': 'Ativar CoreXL Dynamic Dispatcher',
      'diag.pb_step1_desc': 'Elimina o gargalo no Core 1 redistribuindo dinamicamente os fluxos de tráfego pesados entre todos os workers disponíveis.',
      'diag.pb_step2_title': 'Rebalancear Afinidade Automática CoreXL',
      'diag.pb_step2_desc': 'Otimiza a afinidade de interrupções de interfaces nos cores SND (0, 2) e libera os workers para inspeção.',
      'diag.pb_step3_title': 'Expandir Fila do Despachador SecureXL',
      'diag.pb_step3_desc': 'Previne as 5.83B falhas F2P aumentando o buffer de comunicação entre o kernel e o userspace.',
      'diag.pb_step4_title': 'Habilitar Accelerated SYN Defense',
      'diag.pb_step4_desc': 'Protege os workers de CoreXL contra rajadas de 396k conns/s absorvendo os handshakes TCP diretamente no SecureXL.',
      'diag.pb_step5_title': 'Ativar Drop Templates no SecureXL',
      'diag.pb_step5_desc': 'Descarta em hardware os 124.4M pacotes negados por Rulebase sem desperdiçar ciclos de CPU no firewall.',
      'diag.pb_step6_title': 'Otimizar Balanceamento LACP bond1 para Layer 3+4',
      'diag.pb_step6_desc': 'Distribui o tráfego entre eth1-13 e eth2-13 por portas L4 para evitar saturar o enlace 10G a 91.4%.',
      'diag.btn_copy': 'Copiar',
      'diag.btn_copied': '✓ Copiado',

      // Overview Page
      'overview.kpi_avg_thru': 'Throughput Inbound Médio',
      'overview.kpi_peak_thru': 'Pico máximo:',
      'overview.kpi_conns': 'Conexões Simultâneas',
      'overview.kpi_stable': 'Estáveis',
      'overview.kpi_monthly_peak': 'Pico mensal:',
      'overview.kpi_drops': 'Total de Pacotes Descartados',
      'overview.kpi_psl_drops': '2.0M quedas PSL',
      'overview.kpi_spikes': 'Eventos Spike Detective',
      'overview.kpi_thread_spikes': '1,092 picos de threads',
      'overview.chart_traffic_title': '<span>📈</span> Evolução de Desempenho e Tráfego (30 Dias)',
      'overview.chart_traffic_subtitle': 'Throughput de rede (Mbps) e pacotes por segundo agregados por hora',
      'overview.chart_drops_title': '<span>🚫</span> Top Razões de Descarte',
      'overview.chart_drops_subtitle': 'Distribuição percentual de drop reasons',
      'overview.chart_cpu_title': '<span>🖥️</span> Utilização Global de CPU e Memória RAM',
      'overview.chart_cpu_subtitle': 'Percentual de carga média do sistema e consumo de memória (16 GB)',
      'overview.storage_title': '<span>💾</span> Estado do Armazenamento',
      'overview.storage_subtitle': 'Partições de disco e percentual em uso',
      'overview.partition_label': 'Partição',
      'overview.free_gb': 'GB livres',

      // System Page
      'system.kpi_cores': 'Cores Atribuídos',
      'system.kpi_cores_sub': '2 CoreXL FW Workers + 2 SND Cores',
      'system.kpi_ram': 'Memória RAM Total',
      'system.kpi_ram_sub': 'Uso médio:',
      'system.kpi_os': 'Versão Gaia SO',
      'system.kpi_os_sub': 'Jumbo Hotfix Main Take 28',
      'system.kpi_samples': 'Total Amostras DB',
      'system.kpi_samples_sub': '1 amostra por minuto durante 30 dias',
      'system.table_cores_title': '<span>🧩</span> Detalhamento da Arquitetura de Cores (CoreXL / SND)',
      'system.btn_chart_cores': 'Graficar Cores',
      'system.th_core_id': 'Core ID',
      'system.th_role': 'Papel Atribuído',
      'system.th_avg_usage': 'Uso Médio',
      'system.th_max_usage': 'Uso Máximo',
      'system.th_usr_time': 'Tempo Usuário (% Usr)',
      'system.th_sys_time': 'Tempo Sistema (% Sys)',
      'system.th_idle_time': 'Tempo Idle (% Idle)',
      'system.th_interrupts': 'Máx Interrupções',
      'system.th_load_state': 'Estado da Carga',
      'system.chart_timeline_title': '<span>📊</span> Utilização Individual por Core ao Longo do Tempo',
      'system.chart_timeline_subtitle': 'Comparativo de carga entre Cores SND (0, 2) e CoreXL Workers (1, 3)',
      'system.details_title': '<span>📋</span> Parâmetros do Nó e Plataforma',
      'system.node_name': 'Nome do Nó',
      'system.os_label': 'Sistema Operacional',
      'system.cp_version': 'Versão Check Point',
      'system.jhf_branch': 'Jumbo HF Branch',
      'system.build_num': 'Build Number',
      'system.hw_model': 'Modelo Plataforma',
      'system.operating_mode': 'Modo Operacional',
      'system.cluster_status': 'Estado do Cluster',
      'system.uptime_label': 'Tempo Ativo (Uptime)',
      'system.monitored_period': 'Período Monitorado',
      'system.total_snapshots': 'Total de Snapshots',
      'system.rx_drops_hw': 'Drops Hardware Rx',

      // Interfaces Page
      'if.kpi_total': 'Total de Interfaces',
      'if.kpi_total_sub': 'Físicas, Bonds e VLANs 802.1Q',
      'if.kpi_top': 'Interface de Maior Tráfego',
      'if.kpi_top_sub': 'Pico: 9.25 Gbps | Média: 878.5 Mbps',
      'if.kpi_vlan': 'VLAN Mais Ativa',
      'if.kpi_vlan_sub': 'Pico: 7.39 Gbps | Média: 472.6 Mbps',
      'if.kpi_hw_drops': 'Erros e Drops HW',
      'if.kpi_hw_drops_sub': 'Sem perdas em buffers HW',
      'if.chart_top_title': '<span>📶</span> Top 10 Interfaces por Throughput Máximo (Mbps)',
      'if.chart_top_subtitle': 'Comparação de Throughput Rx e Tx em picos',
      'if.table_title': '<span>📑</span> Catálogo Completo de Interfaces de Rede',
      'if.search_placeholder': 'Buscar por nome, VLAN ou IP...',
      'if.btn_chart_ifs': 'Graficar Interfaces',
      'if.filter_all': 'Todos',
      'if.filter_vlan': 'VLAN',
      'if.filter_bond': 'Bond',
      'if.filter_eth': 'Ethernet',
      'if.th_name': 'Nome da Interface',
      'if.th_type': 'Tipo',
      'if.th_speed': 'Velocidade',
      'if.th_state': 'Estado',
      'if.th_ipv4': 'Endereço IPv4 / Máscara',
      'if.th_rx_avg': 'Rx Média (Mbps)',
      'if.th_rx_max': 'Rx Pico (Mbps)',
      'if.th_tx_avg': 'Tx Média (Mbps)',
      'if.th_tx_max': 'Tx Pico (Mbps)',
      'if.th_drops_errors': 'Drops / Erros',
      'if.not_assigned': 'Não atribuída',

      // Traffic & Connections Page
      'traffic.kpi_fw_avg': 'Média Conexões FW',
      'traffic.kpi_fw_sub': 'Handshake + Estabelecidas + Não-TCP',
      'traffic.kpi_host_sxl': 'Conexões Host SecureXL',
      'traffic.kpi_host_sxl_sub': 'Pico acelerado:',
      'traffic.kpi_rate_max': 'Taxa Máxima Novas Conexões',
      'traffic.kpi_rate_max_sub': 'Média: 7,940 conns/sec',
      'traffic.kpi_pkt_max': 'Taxa Máxima de Pacotes',
      'traffic.kpi_pkt_max_sub': 'Pico de pacotes inbound',
      'traffic.chart_conns_title': '<span>🛡️</span> Detalhamento de Conexões Simultâneas por Componente',
      'traffic.chart_conns_subtitle': 'Comparativo temporal de Firewall (FW), Host SXL e Host Streaming',
      'traffic.chart_states_title': '<span>🔄</span> Estados de Conexão Firewall',
      'traffic.chart_states_subtitle': 'Conexões TCP Estabelecidas, Handshake e Não-TCP/UDP',
      'traffic.chart_rate_title': '<span>⚡</span> Taxa de Novas Conexões (Conns/sec)',

      // Drops Page
      'drops.kpi_rulebase': 'Total Quedas por Regras',
      'drops.kpi_rulebase_sub': 'Reason 7: Rulebase Drop (Políticas)',
      'drops.kpi_psl': 'Quedas por Streaming (PSL)',
      'drops.kpi_psl_sub': 'Reason 177: General PSL',
      'drops.kpi_antispoof': 'Anti-Spoofing PPAK Drops',
      'drops.kpi_antispoof_sub': 'Aceleradas pelo kernel PPAK',
      'drops.kpi_templates': 'Drop Templates',
      'drops.kpi_templates_sub': 'Templates de descarte rápido SecureXL',
      'drops.chart_hourly_title': '<span>📉</span> Evolução Horária de Pacotes Descartados',
      'drops.chart_ppak_title': '<span>🛡️</span> Categoria de Drops PPAK 0',
      'drops.table_title': '<span>📋</span> Tabela Detalhada de Razões de Descarte (fwdrop_drop_resaons_tab)',
      'drops.btn_chart_drops': 'Graficar Descartes',
      'drops.th_code': 'Código Razão',
      'drops.th_desc': 'Descrição do Descarte',
      'drops.th_module': 'Módulo Afetado',
      'drops.th_total_pkts': 'Total de Pacotes',
      'drops.th_pct': 'Percentual do Total',
      'drops.th_impact': 'Impacto Operacional',

      // Spikes Page
      'spikes.kpi_cpu': 'Picos de CPU Registrados',
      'spikes.kpi_cpu_sub': 'Eventos detectados por Spike Detective',
      'spikes.kpi_threads': 'Picos de Threads',
      'spikes.kpi_threads_sub': 'Threads individuais de alta carga',
      'spikes.kpi_top_consumer': 'Consumidor Principal',
      'spikes.kpi_top_consumer_sub': 'Firewall Kernel Worker Core 1',
      'spikes.kpi_max_dur': 'Duração Máxima',
      'spikes.kpi_max_dur_sub': '12,717 seg contínuos em fwk0_0',
      'spikes.alarm_level_label': 'Nível Mínimo de Alarme:',
      'spikes.btn_all_levels': 'Todos os Níveis',
      'spikes.btn_mod_level': '🟡 Moderado (≥ 75%)',
      'spikes.btn_high_level': '🟠 Alto (≥ 80%)',
      'spikes.btn_crit_level': '🔴 Apenas Crítico (≥ 90%)',
      'spikes.chart_timeline_title': '<span>📈</span> Frequência Temporal de Picos de CPU (Dia a Dia)',
      'spikes.chart_timeline_subtitle': 'Quantidade de eventos de pico detectados por data no nó',
      'spikes.chart_cores_title': '<span>🧩</span> Distribuição por Core',
      'spikes.chart_cores_subtitle': 'Concentração de picos por núcleo de CPU',
      'spikes.chart_consumers_title': '<span>🔥</span> Top Processos Consumidores de Picos CPU',
      'spikes.chart_consumers_subtitle': 'Processos com maior frequência e severidade de picos',
      'spikes.chart_threads_title': '<span>🧵</span> Picos por Thread (Thread Name)',
      'spikes.chart_threads_subtitle': 'Threads individuais de maior consumo sustentado',
      'spikes.table_title': '<span>📋</span> Registro de Eventos do Spike Detective (CPU Spikes)',
      'spikes.search_placeholder': 'Filtrar por processo (fwk, pdpd, sqlite)...',
      'spikes.btn_chart_spikes': 'Graficar Eventos',
      'spikes.th_datetime': 'Data e Hora UTC',
      'spikes.th_core': 'Core',
      'spikes.th_consumer': 'Processo Consumidor',
      'spikes.th_avg_cpu': 'Uso Médio CPU',
      'spikes.th_duration': 'Duração (seg)',
      'spikes.th_severity': 'Severidade',
      'spikes.severity_moderate': 'Moderado',
      'spikes.severity_high': 'Alto',
      'spikes.severity_crit': 'Crítico',

      // Flow Profiler (Flofiler) Page
      'flofiler.kpi_proto': 'Protocolo L4 Líder',
      'flofiler.kpi_proto_sub': '9.3M e 9.1M ciclos de CPU',
      'flofiler.kpi_kernel': 'Módulo Kernel Líder',
      'flofiler.kpi_kernel_sub': '23.8M ciclos de inspeção sequencial',
      'flofiler.kpi_f2f': 'Inbound F2F',
      'flofiler.kpi_f2f_sub': 'Ciclos em Forward to Firewall',
      'flofiler.kpi_rules': 'Inspeção de Regras',
      'flofiler.kpi_rules_sub': 'Ciclos dedicados à Access Rulebase',
      'flofiler.chart_protocols_title': '<span>📊</span> Top Protocolos e Serviços por Ciclos de CPU',
      'flofiler.chart_components_title': '<span>🧩</span> Top Componentes de Inspeção Check Point',

      // SecureXL & CoreXL Page
      'securexl.kpi_status': 'Estado SecureXL',
      'securexl.kpi_status_val': 'Ativado (On)',
      'securexl.kpi_status_sub': '100% do período de monitoramento',
      'securexl.kpi_fails': 'Filas de Falhas Enqueue',
      'securexl.kpi_fails_sub': 'F2P packet userspace (Multik)',
      'securexl.kpi_inbound': 'Inbound Packet Userspace',
      'securexl.kpi_inbound_sub': 'Contagem de falhas de fila Multik',
      'securexl.kpi_ppak_peak': 'Pico de Throughput PPAK VS0',
      'securexl.kpi_ppak_peak_sub': 'Acelerado no nó virtual 0',
      'securexl.chart_f2v_title': '<span>🔄</span> Razões de F2V (Forward to Virtual / CoreXL)',
      'securexl.chart_fails_title': '<span>📦</span> Falhas de Enfileiramento Multik Dispatcher',
      'securexl.chart_ppak_title': '<span>📈</span> PPAK VS0 - Throughput e Conexões Aceleradas',

      // Blades Page
      'blades.kpi_tls': 'Conexões Seguras TLS',
      'blades.kpi_tls_sub': 'Suporte criptográfico ativo',
      'blades.kpi_vpn': 'VPN IPsec / IKE SAs',
      'blades.kpi_vpn_val': 'Túneis Monitorados',
      'blades.kpi_vpn_sub': 'Zero erros de negociação IKE',
      'blades.kpi_av': 'Assinaturas Anti-Vírus / Bot',
      'blades.kpi_av_val': 'Atualizado',
      'blades.kpi_av_sub': 'Módulos AV Lite e App Control',
      'blades.kpi_tracker': 'Média Log Tracker',
      'blades.kpi_tracker_sub': 'Taxa de registro de conexões',
      'blades.chart_vpn_title': '<span>🔐</span> Atividade de Túneis VPN (Peers e IKE SAs)',

      // DB Explorer Page
      'db.console_title': '⚡ Console de Consulta SQL Direta (Somente Leitura)',
      'db.btn_run_sql': '▶ Executar SQL',
      'db.btn_sample_cpu': 'Exemplo: CPU',
      'db.btn_sample_disks': 'Exemplo: Discos',
      'db.btn_sample_spikes': 'Exemplo: Spikes',
      'db.status_ready': 'Pronto',
      'db.status_executing': 'Executando consulta...',
      'db.status_rows_fetched': 'linhas obtidas',
      'db.results_title': '<span>📊</span> Resultado da Consulta SQL',
      'db.btn_chart_results': 'Graficar Resultados',
      'db.btn_close_results': '✕ Fechar',
      'db.catalog_title': '<span>🗄️</span> Catálogo de Tabelas no Banco SQLite (122 Tabelas Ativas)',
      'db.catalog_subtitle': 'Clique em qualquer tabela para abrir o visualizador interativo de registros',
      'db.filter_tables_placeholder': 'Filtrar tabelas (ex. CPU, HW, vpn, fw)...',
      'db.th_table_name': 'Nome da Tabela',
      'db.th_category': 'Categoria / Prefixo',
      'db.th_total_rows': 'Total Registros',
      'db.th_num_cols': 'Nº Colunas',
      'db.th_key_cols': 'Colunas Principais',
      'db.th_actions': 'Ações',
      'db.btn_view_records': '🔍 Ver Registros',

      // Modal: Load Database
      'modal_db.title': '📂 Carregar Dados de Outra Máquina CPView',
      'modal_db.subtitle': 'Visualize e analise o desempenho de qualquer nó Check Point (arquivos .CPViewDB.dat ou .sqlite)',
      'modal_db.tab_detected': '📁 Arquivos no Servidor',
      'modal_db.tab_upload': '⬆️ Enviar Novo Arquivo',
      'modal_db.tab_path': '🖥️ Caminho no Servidor',
      'modal_db.detected_desc': 'Bancos de dados CPView detectados automaticamente no diretório da aplicação:',
      'modal_db.searching': 'Buscando bancos de dados disponíveis...',
      'modal_db.dropzone_title': 'Arraste e solte aqui o arquivo de outra máquina',
      'modal_db.dropzone_desc': 'Selecione qualquer arquivo <code>.CPViewDB.dat</code> ou banco SQLite extraído de um Check Point Security Gateway ou VSX.',
      'modal_db.btn_browse': '📁 Navegar no Arquivo Local',
      'modal_db.uploading_label': 'Enviando arquivo...',
      'modal_db.uploading_sub': 'Transferindo e processando métricas...',
      'modal_db.path_desc': 'Insira o caminho absoluto ou relativo de um arquivo SQLite CPView existente no servidor:',
      'modal_db.path_placeholder': '/caminho/para/SG_OUTRO-NO_CPViewDB.dat',
      'modal_db.btn_load_path': '▶ Carregar Arquivo',
      'modal_db.path_example': 'Exemplo: <code>./SG_FWNET-ch01-01_2_4_2024_16_27.CPViewDB.dat</code>',
      'modal_db.loading_title': 'Extraindo dados da máquina...',
      'modal_db.loading_desc': 'Agregando séries temporais e resolvendo tabelas de referências CPView...',
      'modal_db.card_active': 'Ativo',
      'modal_db.card_current_btn': '✓ Máquina em Exibição',
      'modal_db.card_load_btn': '▶ Carregar Esta Máquina',

      // Modal: Custom Chart Generator
      'chartgen.title': 'Criador de Gráficos Personalizados',
      'chartgen.subtitle': 'Configure eixos, métricas, operações de agregação e agrupamentos temporais',
      'chartgen.btn_toggle_controls': 'Ocultar Controles',
      'chartgen.btn_show_controls': 'Mostrar Controles',
      'chartgen.btn_fullscreen': 'Tela Inteira',
      'chartgen.opt_cpu_cores': '🧩 Tabela: Cores CPU',
      'chartgen.opt_interfaces': '🌐 Tabela: Interfaces',
      'chartgen.opt_drop_reasons': '📋 Tabela: Razões de Descarte',
      'chartgen.opt_cpu_spikes': '🔍 Tabela: Eventos Spike Detective',
      'chartgen.opt_sql_results': '⚡ Tabela: Resultados SQL',
      'chartgen.opt_modal_table': '🗄️ Tabela: Visualizador SQLite Ativo',
      'chartgen.label_x': '📍 Eixo X (Categoria / Dimensão / Tempo)',
      'chartgen.label_time': '⏱️ Tratamento Temporal (Timestamp)',
      'chartgen.opt_time_none': 'Texto Simples / Sem formato de data',
      'chartgen.opt_time_datetime': '📅 Data e Hora completa (DD/MM HH:mm)',
      'chartgen.opt_time_date': '📆 Somente Dias (DD/MM/YYYY)',
      'chartgen.opt_time_hour': '⏰ Somente Horas do dia (00h - 23h)',
      'chartgen.opt_time_weekday': '🗓️ Dia da semana (Segunda - Domingo)',
      'chartgen.opt_time_hour_dt': '⏱️ Por Hora cronológica (DD/MM HH:00)',
      'chartgen.opt_time_minute': '⏱️ Por Minuto cronológico (DD/MM HH:mm)',
      'chartgen.label_y': '📈 Eixo Y (Métrica / Valor a Representar)',
      'chartgen.label_op': '🧮 Operação / Agregação',
      'chartgen.opt_op_sum': 'Somatório de Valores (SUM)',
      'chartgen.opt_op_sum_day': '📅 Somatório por Dias (SUM por Dia)',
      'chartgen.opt_op_sum_hour': '⏰ Somatório por Horas (SUM por Hora)',
      'chartgen.opt_op_sum_min': '⏱️ Somatório por Minutos (SUM por Minuto)',
      'chartgen.opt_op_count': 'Contagem de Linhas / Frequência (COUNT)',
      'chartgen.opt_op_avg': 'Média / Valor Médio (AVG)',
      'chartgen.opt_op_max': 'Pico Máximo (MAX)',
      'chartgen.opt_op_min': 'Valor Mínimo (MIN)',
      'chartgen.opt_op_raw': 'Valores Diretos (Sem agrupar)',
      'chartgen.label_slice': '🔢 Seleção / Limite de Registros',
      'chartgen.opt_slice_all': 'Todos os registros da tabela',
      'chartgen.opt_slice_last100': 'Últimos 100 registros (mais recentes)',
      'chartgen.opt_slice_last500': 'Últimos 500 registros',
      'chartgen.opt_slice_last1000': 'Últimos 1,000 registros',
      'chartgen.opt_slice_last5000': 'Últimos 5,000 registros',
      'chartgen.opt_slice_first100': 'Primeiros 100 registros (mais antigos)',
      'chartgen.opt_slice_first500': 'Primeiros 500 registros',
      'chartgen.opt_slice_first1000': 'Primeiros 1,000 registros',
      'chartgen.label_date_range': '📅 Intervalo Temporal (Data De — Até)',
      'chartgen.date_to_separator': 'a',
      'chartgen.btn_reset_dates': '✕ Tudo',
      'chartgen.label_shortcuts': '⚡ Atalhos de Intervalo',
      'chartgen.preset_all': 'Tudo',
      'chartgen.label_type': 'Tipo:',
      'chartgen.type_bar': '📊 Barras',
      'chartgen.type_horiz': '📉 Horiz',
      'chartgen.type_line': '📈 Linha',
      'chartgen.type_area': '🏔️ Área',
      'chartgen.type_pie': '🥧 Pizza',
      'chartgen.type_doughnut': '🍩 Rosca',
      'chartgen.label_sort': 'Ordenar:',
      'chartgen.opt_sort_ydesc': 'Maior para Menor (Top Y)',
      'chartgen.opt_sort_yasc': 'Menor para Maior (Y asc)',
      'chartgen.opt_sort_xasc': 'Eixo X Crescente (A-Z / Crono)',
      'chartgen.opt_sort_xdesc': 'Eixo X Decrescente',
      'chartgen.opt_sort_original': 'Ordem Original das Linhas',
      'chartgen.label_limit': 'Limite:',
      'chartgen.opt_limit_all': 'Todos',
      'chartgen.opt_limit_10': 'Top 10',
      'chartgen.opt_limit_15': 'Top 15',
      'chartgen.opt_limit_25': 'Top 25',
      'chartgen.opt_limit_50': 'Top 50',
      'chartgen.label_color': 'Cor:',
      'chartgen.view_summary': '📊 Visualização do Gráfico:',
      'chartgen.no_data': 'ℹ️ Não há dados para graficar com a configuração atual.',
      'chartgen.stat_categories': 'Categorias / Pontos',
      'chartgen.stat_sum': 'Soma Total',
      'chartgen.stat_avg': 'Média',
      'chartgen.stat_max': 'Pico Máximo',
      'chartgen.stat_min': 'Mínimo',
      'chartgen.footer_info': 'Gráfico interativo gerado em tempo real',
      'chartgen.btn_copy_csv': '📋 Copiar CSV',
      'chartgen.btn_download_png': '💾 Baixar Imagem PNG',
      'chartgen.btn_close': 'Fechar',

      // Modal: Table Viewer
      'tableview.subtitle': 'Registros diretos com resolução de referências CPView',
      'tableview.search_placeholder': 'Filtrar linhas atuais...',
      'tableview.btn_chart': '📊 Graficar Registros',
      'tableview.loading': 'Carregando registros...',
      'tableview.page_prefix': 'Página',
      'tableview.btn_prev': '◀ Anterior',
      'tableview.btn_next': 'Seguinte ▶',
      'tableview.empty': 'Sem registros',

      // Common Terms & Days
      'common.empty_val': '(Vazio)',
      'common.day_mon': 'Segunda-feira',
      'common.day_tue': 'Terça-feira',
      'common.day_wed': 'Quarta-feira',
      'common.day_thu': 'Quinta-feira',
      'common.day_fri': 'Sexta-feira',
      'common.day_sat': 'Sábado',
      'common.day_sun': 'Domingo',
      'common.showing': 'Exibindo',
      'common.of': 'de',
      'common.events': 'eventos',
      'common.incidents': 'incidentes',
      'common.all': 'Todos',
      'if.kpi_excellent': 'Excelente',
      'db.console_db_label': 'Banco de dados:',
      'chartgen.lbl_toggle_controls': 'Ocultar Controles',
      'chartgen.lbl_fullscreen': 'Tela Cheia',
      'diag.cause_cpu_conns': 'Confluência crítica: saturação do CoreXL Worker 1 causada por disparo massivo de abertura de conexões TCP em slow path.',
      'diag.remedy_cpu_conns': 'Ativar Dynamic Dispatcher (fw ctl multik dynamic_disp on) e Accelerated SYN Defense (fw ctl set int sim_syn_defense 1).',
      'diag.cause_drops_traffic': 'Confluência de alto throughput com rajadas de descarte em Rulebase ou Anti-Spoofing PPAK. Sobrecarga no pipeline de inspeção.',
      'diag.remedy_drops_traffic': 'Habilitar Drop Templates no SecureXL (fw accel drop_templates on) e revisar grupos de topologia de interface.',
      'diag.cause_midnight': 'Degradação cíclica noturna por tarefas em lote no crontab, dumps de CPView e rotação de logs às 00:00 UTC.',
      'diag.remedy_midnight': 'Escalonar os cron jobs da meia-noite no crontab (rotação às 01:15, backups às 02:30, compressão às 03:45).',
      'diag.cause_multivar': 'Anomalia pontual multivariável gerando contenção transitória de recursos de kernel e buffers de rede.',
      'diag.remedy_multivar': 'Verificar sim affinity -a e expandir buffers de enfileiramento do SecureXL (sim_dispatcher_queue_size 4096).',
      'diag.incidents_filtered': '{count} incidentes filtrados (de {total})',
      'diag.filter_tag': 'Filtrado: {day} {hour}h',
      'diag.btn_reset_filter': '✕ Limpar',
      'diag.btn_copy_report': '📋 Copiar Relatório Forense',
      'diag.btn_report_copied': '✓ Relatório Copiado',
      'diag.exact_values': '📊 Valores Exatos no Intervalo',
      'diag.drawer_cause': '🔍 Diagnóstico e Causa Raiz',
      'diag.drawer_remedy': '🛠️ Remediação Check Point Recomendada',
      'spikes.filtered_active': 'picos ativos',
      'spikes.all_levels': 'Todos os níveis',
      'spikes.moderate_label': 'Moderada (≥ 75% CPU)',
      'spikes.high_label': 'Alta e Crítica (≥ 80% CPU)',
      'spikes.critical_label': 'Apenas Crítica (≥ 90% CPU)',
      'spikes.no_events': 'Nenhum evento encontrado',
      'spikes.showing_pagination': 'Mostrando {start} - {end} de {total} eventos',
      'system.high_demand': 'Alta Demanda',
      'system.normal': 'Normal',
      'diag.showing_pagination': 'Mostrando {start} - {end} de {total} incidentes (Pág. {page} de {totalPages})',
      'diag.no_incidents_match': 'Nenhum incidente corresponde aos filtros',
      'diag.no_incidents_found': 'Nenhum incidente encontrado para os critérios selecionados.',
      'diag.btn_hide': '▲ Ocultar',
      'diag.btn_view_detail': '▼ Ver Detalhes',
      'modal.table_prefix': 'Tabela:',
      'modal.loading_data': 'Carregando dados...',
      'modal.querying_records': 'Consultando registros...',
      'modal.sample_pre_extracted': 'Amostra pré-extraída (Total no SQLite: {total})',
      'modal.page_total_records': 'Página {page} (Total: {total} registros)',
      'modal.error_load': 'Não foi possível carregar registros para esta tabela.',
      'db.rows_fetched_count': '{count} linhas obtidas',
      'header.days_suffix': 'dias',
      'sidebar.badge_tables_suffix': 'Tabelas'
    }
  };

  // Translation function
  function t(key, fallback = '', params = {}) {
    const dict = I18N[currentLang] || I18N[DEFAULT_LANG];
    let val = dict[key];
    if (val === undefined) {
      val = I18N[DEFAULT_LANG][key];
    }
    if (val === undefined) {
      val = fallback || key;
    }
    if (params && typeof val === 'string') {
      Object.keys(params).forEach(k => {
        val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
      });
    }
    return val;
  }

  // Get current language code
  function getCurrentLanguage() {
    return currentLang;
  }

  // Change language and apply everywhere
  const listeners = [];

  function onLanguageChange(fn) {
    if (typeof fn === 'function') {
      listeners.push(fn);
    }
  }

  function setLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}

    document.documentElement.lang = lang;

    // Update Language Selector button & dropdown
    updateLanguageSelectorUI();

    // Update all elements with data-i18n attributes
    applyTranslationsToDOM();

    // Trigger all subscribers (app.js UI refresh, charts, etc.)
    listeners.forEach(fn => {
      try { fn(lang); } catch (e) { console.error('Error in i18n listener:', e); }
    });
  }

  function updateLanguageSelectorUI() {
    const flags = { es: '🇪🇸', en: '🇬🇧', pt: '🇧🇷' };
    const names = { es: 'Español', en: 'English', pt: 'Português' };

    const flagEl = document.getElementById('lang-selector-flag');
    const labelEl = document.getElementById('lang-selector-label');
    if (flagEl) flagEl.textContent = flags[currentLang] || '🌐';
    if (labelEl) labelEl.textContent = names[currentLang] || currentLang.toUpperCase();

    // Update active class in dropdown
    document.querySelectorAll('.lang-option').forEach(opt => {
      const optLang = opt.getAttribute('data-lang');
      if (optLang === currentLang) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
  }

  // Apply translations to all DOM nodes
  function applyTranslationsToDOM() {
    document.documentElement.lang = currentLang;

    // 1. Text elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const trans = t(key);
      if (trans !== undefined) {
        el.innerHTML = trans;
      }
    });

    // 2. Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      const trans = t(key);
      if (trans !== undefined) {
        el.placeholder = trans;
      }
    });

    // 3. Titles / tooltips
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (!key) return;
      const trans = t(key);
      if (trans !== undefined) {
        el.title = trans;
      }
    });

    // 4. Update dynamic select options in Custom Chart Generator
    updateChartGenOptionTexts();
  }

  function updateChartGenOptionTexts() {
    const chartgenTableSel = document.getElementById('chartgen-table-selector');
    if (chartgenTableSel) {
      const opts = {
        'cpu-cores': t('chartgen.opt_cpu_cores'),
        'interfaces': t('chartgen.opt_interfaces'),
        'drop-reasons': t('chartgen.opt_drop_reasons'),
        'cpu-spikes': t('chartgen.opt_cpu_spikes'),
        'sql-results': t('chartgen.opt_sql_results'),
        'modal-table': t('chartgen.opt_modal_table')
      };
      Array.from(chartgenTableSel.options).forEach(opt => {
        if (opts[opt.value]) opt.textContent = opts[opt.value];
      });
    }

    const timeFmtSel = document.getElementById('chartgen-time-format');
    if (timeFmtSel) {
      const opts = {
        'none': t('chartgen.opt_time_none'),
        'datetime': t('chartgen.opt_time_datetime'),
        'date': t('chartgen.opt_time_date'),
        'hour': t('chartgen.opt_time_hour'),
        'weekday': t('chartgen.opt_time_weekday'),
        'hour_datetime': t('chartgen.opt_time_hour_dt'),
        'minute': t('chartgen.opt_time_minute')
      };
      Array.from(timeFmtSel.options).forEach(opt => {
        if (opts[opt.value]) opt.textContent = opts[opt.value];
      });
    }

    const opSel = document.getElementById('chartgen-op');
    if (opSel) {
      const opts = {
        'SUM': t('chartgen.opt_op_sum'),
        'SUM_DAY': t('chartgen.opt_op_sum_day'),
        'SUM_HOUR': t('chartgen.opt_op_sum_hour'),
        'SUM_MINUTE': t('chartgen.opt_op_sum_min'),
        'COUNT': t('chartgen.opt_op_count'),
        'AVG': t('chartgen.opt_op_avg'),
        'MAX': t('chartgen.opt_op_max'),
        'MIN': t('chartgen.opt_op_min'),
        'RAW': t('chartgen.opt_op_raw')
      };
      Array.from(opSel.options).forEach(opt => {
        if (opts[opt.value]) opt.textContent = opts[opt.value];
      });
    }

    const sliceSel = document.getElementById('chartgen-record-slice');
    if (sliceSel) {
      const opts = {
        'all': t('chartgen.opt_slice_all'),
        'last-100': t('chartgen.opt_slice_last100'),
        'last-500': t('chartgen.opt_slice_last500'),
        'last-1000': t('chartgen.opt_slice_last1000'),
        'last-5000': t('chartgen.opt_slice_last5000'),
        'first-100': t('chartgen.opt_slice_first100'),
        'first-500': t('chartgen.opt_slice_first500'),
        'first-1000': t('chartgen.opt_slice_first1000')
      };
      Array.from(sliceSel.options).forEach(opt => {
        if (opts[opt.value]) opt.textContent = opts[opt.value];
      });
    }

    const sortSel = document.getElementById('chartgen-sort');
    if (sortSel) {
      const opts = {
        'y-desc': t('chartgen.opt_sort_ydesc'),
        'y-asc': t('chartgen.opt_sort_yasc'),
        'x-asc': t('chartgen.opt_sort_xasc'),
        'x-desc': t('chartgen.opt_sort_xdesc'),
        'original': t('chartgen.opt_sort_original')
      };
      Array.from(sortSel.options).forEach(opt => {
        if (opts[opt.value]) opt.textContent = opts[opt.value];
      });
    }

    const limitSel = document.getElementById('chartgen-limit');
    if (limitSel) {
      const opts = {
        '0': t('chartgen.opt_limit_all'),
        '10': t('chartgen.opt_limit_10'),
        '15': t('chartgen.opt_limit_15'),
        '25': t('chartgen.opt_limit_25'),
        '50': t('chartgen.opt_limit_50')
      };
      Array.from(limitSel.options).forEach(opt => {
        if (opts[opt.value]) opt.textContent = opts[opt.value];
      });
    }
  }

  // Setup Language Selector Dropdown Interaction
  function setupLanguageSystem() {
    const btn = document.getElementById('btn-lang-selector');
    const menu = document.getElementById('lang-dropdown-menu');

    if (btn && menu) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = menu.style.display === 'flex';

        // Close other top-header menus if open
        const themeMenu = document.getElementById('theme-dropdown-menu');
        const themeBtn = document.getElementById('btn-theme-selector');
        if (themeMenu) themeMenu.style.display = 'none';
        if (themeBtn) themeBtn.setAttribute('aria-expanded', 'false');

        const scaleMenu = document.getElementById('scale-dropdown-menu');
        const scaleBtn = document.getElementById('btn-scale-selector');
        if (scaleMenu) scaleMenu.style.display = 'none';
        if (scaleBtn) scaleBtn.setAttribute('aria-expanded', 'false');

        menu.style.display = isVisible ? 'none' : 'flex';
        btn.setAttribute('aria-expanded', !isVisible);
      });

      document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
          menu.style.display = 'none';
          btn.setAttribute('aria-expanded', 'false');
        }
      });

      document.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const lang = opt.getAttribute('data-lang');
          setLanguage(lang);
          menu.style.display = 'none';
          btn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // Set initial UI state
    updateLanguageSelectorUI();
    applyTranslationsToDOM();
  }

  // Expose i18n object globally
  window.i18n = {
    t,
    getCurrentLanguage,
    setLanguage,
    applyTranslationsToDOM,
    setupLanguageSystem,
    onLanguageChange,
    I18N
  };

  // Immediate language application on script load
  document.documentElement.lang = currentLang;

  // Run DOM setup as soon as content is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupLanguageSystem();
    });
  } else {
    setupLanguageSystem();
  }
})();
