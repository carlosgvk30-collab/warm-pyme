// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://mzojochsxcqqrnvbkixo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16b2pvY2hzeGNxcXJudmJraXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MzAyMjUsImV4cCI6MjEwMDQwNjIyNX0.-LQK0nJVazgO6RmUP7Y7pLf9W-wAS-lTZgenkfgkXB0';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// WHATSAPP — escribe aquí el número de contacto del negocio.
// Formato: 57 + número de 10 dígitos, sin "+", espacios ni guiones. Ej: '573001234567'
// Mientras esté vacío ('') el botón de WhatsApp NO aparece en la página.
// ==========================================
const WHATSAPP_NUMERO = '';
const WHATSAPP_MENSAJE = 'Hola, vi la página de A Warm Place y quiero información para mi negocio.';

let ultimaAuditoriaId = null;

// Costo-hora cargado (salario + prestaciones) de referencia para pymes de un municipio
// pequeño como El Banco, Magdalena. Ajústalo si tienes un dato más preciso.
const COSTO_HORA_COP = 15000;

function formatoCOP(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(valor || 0);
}

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 0. BOTÓN FLOTANTE DE WHATSAPP (solo si WHATSAPP_NUMERO tiene un número)
    // ==========================================
    const numeroWa = WHATSAPP_NUMERO.replace(/\D/g, '');
    if (numeroWa.length >= 11) {
        const enlace = document.createElement('a');
        enlace.id = 'btn-whatsapp';
        enlace.className = 'whatsapp-flotante';
        enlace.href = `https://wa.me/${numeroWa}?text=${encodeURIComponent(WHATSAPP_MENSAJE)}`;
        enlace.target = '_blank';
        enlace.rel = 'noopener noreferrer';
        enlace.setAttribute('aria-label', 'Escribir por WhatsApp');
        enlace.innerHTML = '<span aria-hidden="true">💬</span> WhatsApp';
        document.body.appendChild(enlace);
    }

    // ==========================================
    // 4. CALCULADORA DE ROI (simulador rápido)
    // ==========================================
    const rangeEmpleados = document.getElementById('calc-empleados');
    const rangeHoras = document.getElementById('calc-horas');
    const spanEmpNum = document.getElementById('val-emp-num');
    const spanHorasNum = document.getElementById('val-horas-num');
    const roiResultado = document.getElementById('roi-resultado');

    function actualizarROI() {
        if (!rangeEmpleados || !rangeHoras || !roiResultado) return;
        const emp = parseInt(rangeEmpleados.value, 10);
        const horas = parseInt(rangeHoras.value, 10);
        spanEmpNum.textContent = emp;
        spanHorasNum.textContent = horas;
        const perdidaAnual = emp * horas * COSTO_HORA_COP * 52;
        roiResultado.textContent = `${formatoCOP(perdidaAnual)} / año`;
    }
    rangeEmpleados?.addEventListener('input', actualizarROI);
    rangeHoras?.addEventListener('input', actualizarROI);
    actualizarROI();

    // ==========================================
    // 5. SIMULADOR RÁPIDO DE INDEX.HTML
    // ==========================================
    const formDiagnostico = document.getElementById('form-diagnostico');
    formDiagnostico?.addEventListener('submit', (e) => {
        e.preventDefault();
        const sector = document.getElementById('diag-sector').value;
        const empleados = document.getElementById('diag-empleados').value;
        const cuello = document.getElementById('diag-cuello').value;

        sessionStorage.setItem('auditoriaTemp', JSON.stringify({
            sector, empleados: parseInt(empleados, 10), detalle: cuello, empresa: 'Tu Empresa'
        }));

        const resultadoDiv = document.getElementById('resultado-diagnostico');
        const contenidoAuditoria = document.getElementById('contenido-auditoria');
        if (resultadoDiv && contenidoAuditoria) {
            contenidoAuditoria.innerHTML = `
                <p><strong>Sector analizado:</strong> ${sector.toUpperCase()}</p>
                <p><strong>Impacto estimado:</strong> Con un equipo de ${empleados} personas, detectamos oportunidades críticas de automatización en tus canales de comunicación y gestión de datos.</p>
                <p><em>Cuello de botella registrado:</em> "${cuello || 'Sin especificar'}"</p>
                <a href="auditoria.html" style="display:inline-block;margin-top:15px;background:#0057FF;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;font-weight:bold;">Acceder a Auditoría Avanzada Completa &rarr;</a>
            `;
            resultadoDiv.style.display = 'block';
        }
    });

    // ==========================================
    // 6. FORMULARIO COMPLETO DE AUDITORÍA -> GUARDA EN SUPABASE (tabla: auditorias)
    // ==========================================
    const formAuditoriaCompleto = document.getElementById('form-auditoria-completo');
    formAuditoriaCompleto?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const empresa = document.getElementById('aud-empresa').value.trim();
        const emailForm = document.getElementById('aud-email').value.trim();
        const ciudad = document.getElementById('aud-ciudad')?.value.trim() || '';
        const sector = document.getElementById('aud-sector').value;
        const empleados = parseInt(document.getElementById('aud-empleados').value, 10) || 0;
        const horas = parseInt(document.getElementById('aud-horas').value, 10) || 0;
        const detalle = document.getElementById('aud-detalle').value.trim();
        const presupuesto = document.getElementById('aud-presupuesto')?.value || '';
        const urgencia = document.getElementById('aud-urgencia')?.value || '';
        const herramientasActuales = Array.from(
            document.querySelectorAll('input[name="herramienta_actual"]:checked')
        ).map(cb => cb.value);

        const checkboxesCanal = document.querySelectorAll('input[name="var_canal"]:checked');
        const checkboxesProc = document.querySelectorAll('input[name="var_proc"]:checked');
        const totalVariablesRiesgo = checkboxesCanal.length + checkboxesProc.length;

        const { data: { session } } = await _supabase.auth.getSession();
        const emailFinal = session?.user?.email || emailForm;

        const perdidaAnualPreliminar = empleados * horas * COSTO_HORA_COP * 52;
        const textoResultado = `Diagnóstico Operativo Inicial para ${empresa} (${ciudad}). ` +
            `Equipo de ${empleados} colaboradores dedicando ${horas} horas semanales cada uno en el sector ${sector}. ` +
            `Se identific${totalVariablesRiesgo === 1 ? 'ó' : 'aron'} ${totalVariablesRiesgo} ${totalVariablesRiesgo === 1 ? 'punto crítico de fricción' : 'puntos críticos de fricción'} vinculados a procesos manuales.`;

        const contenedorResultado = document.getElementById('resultado-auditoria-container');
        const textoResultadoGratis = document.getElementById('texto-resultado-gratis');
        if (contenedorResultado && textoResultadoGratis) {
            textoResultadoGratis.innerHTML = `
                <h4 style="color:#FF6B00;margin-bottom:10px;">Diagnóstico Operativo Inicial para ${empresa}</h4>
                <p style="margin-bottom:8px;">Hemos procesado los datos de tu equipo de <strong>${empleados} colaboradores</strong> en <strong>${ciudad}</strong>, dedicando <strong>${horas} horas semanales</strong> cada uno en el sector de <strong>${sector}</strong>.</p>
                <p style="margin-bottom:8px;">Se identific${totalVariablesRiesgo === 1 ? 'ó' : 'aron'} <strong>${totalVariablesRiesgo} ${totalVariablesRiesgo === 1 ? 'punto crítico de fricción' : 'puntos críticos de fricción'}</strong> vinculados a procesos manuales. Pérdida operativa preliminar estimada: <strong style="color:#FF8A3D;">${formatoCOP(perdidaAnualPreliminar)} / año</strong>.</p>
                <blockquote style="background:rgba(255,107,0,0.05);border-left:4px solid #FF6B00;padding:10px;margin:10px 0;color:#cbd5e1;">"${detalle || 'Sin detalles adicionales'}"</blockquote>
                <p style="color:#94a3b8;font-style:italic;margin-top:10px;">Desbloquea la versión profesional para ver el desglose financiero exacto de pérdidas y el roadmap de implementación con Inteligencia Artificial.</p>
            `;
            contenedorResultado.style.display = 'block';
            contenedorResultado.scrollIntoView({ behavior: 'smooth' });
        }

        const variablesCanal = Array.from(checkboxesCanal).map(cb => cb.value);
        const variablesProceso = Array.from(checkboxesProc).map(cb => cb.value);

        sessionStorage.setItem('auditoriaTemp', JSON.stringify({
            empresa, email: emailFinal, ciudad, sector, empleados, horas, detalle,
            presupuesto, urgencia, herramientasActuales,
            variablesCanal, variablesProceso
        }));

        if (!emailFinal) {
            alert('Ingresa un correo (o inicia sesión) para poder guardar tu auditoría.');
            return;
        }

        const { data, error } = await _supabase
            .from('auditorias')
            .insert([{
                email: emailFinal,
                empresa,
                sector,
                empleados,
                horas,
                detalle,
                resultado: textoResultado
            }])
            .select();

        if (error) {
            console.error('Error al guardar la auditoría:', error);
            alert('Tu diagnóstico se generó, pero hubo un error al guardarlo en el historial: ' + error.message);
            return;
        }

        ultimaAuditoriaId = data?.[0]?.id ?? null;

        if (session?.user?.email) {
            cargarReportesAnteriores(session.user.email);
        }
    });

    // ==========================================
    // 7. AUTENTICACIÓN
    // ==========================================
    const btnLogin = document.getElementById('btn-login');
    const btnRegistro = document.getElementById('btn-registro');
    const btnLogout = document.getElementById('btn-logout');
    const authFormContainer = document.getElementById('auth-form-container');
    const authUserInfo = document.getElementById('auth-user-info');
    const userEmailDisplay = document.getElementById('user-email-display');
    const seccionHistorial = document.getElementById('seccion-historial-reportes');

    function actualizarInterfazUsuario(user) {
        if (user) {
            if (authFormContainer) authFormContainer.style.display = 'none';
            if (authUserInfo) authUserInfo.style.display = 'block';
            if (userEmailDisplay) userEmailDisplay.textContent = user.email;
            if (seccionHistorial) seccionHistorial.style.display = 'block';
            cargarReportesAnteriores(user.email);
        } else {
            if (authFormContainer) authFormContainer.style.display = 'block';
            if (authUserInfo) authUserInfo.style.display = 'none';
            if (userEmailDisplay) userEmailDisplay.textContent = '';
            if (seccionHistorial) seccionHistorial.style.display = 'none';
        }
    }

    _supabase.auth.getSession().then(({ data: { session } }) => {
        actualizarInterfazUsuario(session?.user ?? null);
    });

    _supabase.auth.onAuthStateChange((event, session) => {
        actualizarInterfazUsuario(session?.user ?? null);
    });

    btnRegistro?.addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        if (!email || !password) {
            alert('Por favor ingresa correo y contraseña.');
            return;
        }
        btnRegistro.disabled = true;
        btnRegistro.textContent = 'Registrando...';
        const { error } = await _supabase.auth.signUp({ email, password });
        btnRegistro.disabled = false;
        btnRegistro.textContent = 'Registrarse';

        if (error) {
            alert('Error en el registro: ' + error.message);
        } else {
            alert('¡Registro exitoso! Revisa tu correo si se requiere confirmación, o ya puedes iniciar sesión.');
        }
    });

    btnLogin?.addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        if (!email || !password) {
            alert('Por favor ingresa correo y contraseña.');
            return;
        }
        btnLogin.disabled = true;
        btnLogin.textContent = 'Iniciando...';
        const { error } = await _supabase.auth.signInWithPassword({ email, password });
        btnLogin.disabled = false;
        btnLogin.textContent = 'Iniciar Sesión';

        if (error) {
            alert('Credenciales incorrectas: ' + error.message);
        }
    });

    btnLogout?.addEventListener('click', async () => {
        await _supabase.auth.signOut();
    });

    // ==========================================
    // 8. DESBLOQUEO PREMIUM -> genera reporte estructurado + gráficos, actualiza "auditorias"
    // ==========================================
    const btnDesbloquear = document.getElementById('btn-desbloquear-premium');
    const seccionAgendamiento = document.getElementById('seccion-agendamiento');
    const btnDescargarPdf = document.getElementById('btn-descargar-pdf');

    function reporteFallback(datos) {
        const perdidaAnual = datos.empleados * datos.horas * COSTO_HORA_COP * 52;
        const ahorroMensual = Array.from({ length: 12 }, (_, i) => Math.round((perdidaAnual / 12) * ((i + 1) / 12)));
        return {
            diagnosticoFinanciero: `No pudimos conectar con la IA en este momento. Estimación preliminar basada en ${datos.empleados} empleados x ${datos.horas} horas semanales en ${datos.ciudad || 'tu municipio'}.`,
            perdidaAnualCOP: perdidaAnual,
            ahorroMensualProyectado: ahorroMensual,
            cuelloBotellaAnalisis: datos.detalle || 'Sin detalle adicional disponible.',
            benchmarkSector: 'No disponible temporalmente.',
            matrizRiesgos: [],
            stackRecomendado: [],
            impactoEquipo: 'No disponible temporalmente.',
            roadmap: [],
            cierre: 'Por favor intenta de nuevo en unos minutos para obtener el reporte completo.',
        };
    }

    function badgeNivel(nivel) {
        const colores = { alto: '#ef4444', medio: '#f59e0b', bajo: '#22c55e' };
        const color = colores[nivel] || '#64748b';
        return `<span class="rpt-badge" data-nivel="${nivel}" style="background:${color};color:#0b0f19;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:bold;text-transform:uppercase;">${nivel || 'N/A'}</span>`;
    }

    function renderReporteEstructurado(reporte, datos) {
        const contenedor = document.createElement('div');
        contenedor.style.cssText = 'margin-top:20px;padding:25px;background:#0b0f19;border:2px solid #0057FF;border-radius:12px;color:#f3f4f6;line-height:1.6;';

        const ahorroTotal12m = (reporte.ahorroMensualProyectado || []).reduce((a, b) => a + b, 0);
        const perdidaBase = reporte.perdidaAnualCOP || 0;
        const pctRecuperable = perdidaBase > 0 ? Math.min(Math.round((ahorroTotal12m / perdidaBase) * 100), 100) : 0;

        const tarjeta = (etiqueta, valor, color, tono) => `
            <div class="rpt-tarjeta" style="background:#111827;border:1px solid ${color};border-radius:12px;padding:16px;text-align:center;">
                <div style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${etiqueta}</div>
                <div class="rpt-valor-${tono}" style="color:${color};font-size:22px;font-weight:800;line-height:1.2;">${valor}</div>
            </div>`;

        contenedor.innerHTML = `
            <h3 style="color:#FF6B00;border-bottom:2px solid #0057FF;padding-bottom:8px;margin-bottom:20px;">
                Reporte Ejecutivo de Auditoría y Roadmap de IA: ${datos.empresa}
            </h3>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:25px;">
                ${tarjeta('Pérdida anual estimada', formatoCOP(perdidaBase), '#ef4444', 'rojo')}
                ${tarjeta('Ahorro proyectado a 12 meses', formatoCOP(ahorroTotal12m), '#22c55e', 'verde')}
                ${tarjeta('Pérdida recuperable', pctRecuperable + '%', '#4D8BFF', 'azul')}
            </div>

            <h4 style="color:#FF6B00;margin-bottom:8px;">📊 Diagnóstico Financiero</h4>
            <p style="margin-bottom:6px;">${reporte.diagnosticoFinanciero || ''}</p>
            <p style="background:#111827;padding:10px;border-radius:6px;color:#FF8A3D;font-weight:bold;margin-bottom:20px;">
                Pérdida anual estimada: ${formatoCOP(reporte.perdidaAnualCOP)}
            </p>

            <div style="margin-bottom:25px;">
                <canvas id="chart-comparativa" height="140"></canvas>
            </div>
            <div style="margin-bottom:25px;">
                <canvas id="chart-ahorro" height="140"></canvas>
            </div>

            <h4 style="color:#FF6B00;margin-bottom:8px;">🔍 Cuello de Botella Principal</h4>
            <p style="margin-bottom:20px;">${reporte.cuelloBotellaAnalisis || ''}</p>

            <h4 style="color:#FF6B00;margin-bottom:8px;">📈 Benchmark del Sector</h4>
            <p style="margin-bottom:20px;">${reporte.benchmarkSector || ''}</p>

            <h4 style="color:#FF6B00;margin-bottom:8px;">⚠️ Matriz de Riesgos</h4>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
                ${(reporte.matrizRiesgos || []).map(r => `
                    <div class="rpt-bloque" style="background:#111827;padding:10px 14px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
                        <div><strong>${r.area}</strong><br><span style="color:#94a3b8;font-size:13px;">${r.impacto}</span></div>
                        ${badgeNivel(r.nivel)}
                    </div>
                `).join('') || '<p style="color:#64748b;">Sin datos suficientes.</p>'}
            </div>

            <h4 style="color:#FF6B00;margin-bottom:8px;">🛠️ Stack Tecnológico Recomendado</h4>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">
                ${(reporte.stackRecomendado || []).map(s => `<span style="background:rgba(255,107,0,0.1);border:1px solid #FF6B00;color:#FF6B00;padding:5px 12px;border-radius:999px;font-size:13px;">${s}</span>`).join('') || '<p style="color:#64748b;">Sin datos suficientes.</p>'}
            </div>

            <h4 style="color:#FF6B00;margin-bottom:8px;">👥 Impacto en el Equipo</h4>
            <p style="margin-bottom:20px;">${reporte.impactoEquipo || ''}</p>

            <h4 style="color:#FF6B00;margin-bottom:8px;">🗺️ Roadmap de Implementación</h4>
            <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
                ${(reporte.roadmap || []).map(f => `
                    <div class="rpt-bloque" style="background:#111827;padding:14px;border-radius:8px;border-left:4px solid #FF6B00;">
                        <strong style="color:#FF8A3D;">${f.fase}</strong>
                        <ul style="margin-top:6px;padding-left:18px;color:#e5e7eb;">
                            ${(f.acciones || []).map(a => `<li>${a}</li>`).join('')}
                        </ul>
                    </div>
                `).join('') || '<p style="color:#64748b;">Sin datos suficientes.</p>'}
            </div>

            <p style="color:#94a3b8;font-style:italic;">${reporte.cierre || ''}</p>
        `;
        return contenedor;
    }

    function dibujarGraficos(reporte) {
        if (typeof Chart === 'undefined') return;

        const ahorro = reporte.ahorroMensualProyectado || [];
        const perdidaAnual = reporte.perdidaAnualCOP || 0;

        const ctxComparativa = document.getElementById('chart-comparativa');
        if (ctxComparativa) {
            new Chart(ctxComparativa, {
                type: 'bar',
                data: {
                    labels: ['Sin automatización', 'Con automatización'],
                    datasets: [{
                        label: 'Costo operativo anual (COP)',
                        data: [perdidaAnual, Math.max(perdidaAnual - (ahorro.reduce((a, b) => a + b, 0)), 0)],
                        backgroundColor: ['#ef4444', '#22c55e'],
                    }],
                },
                options: {
                    plugins: { legend: { display: false }, title: { display: true, text: 'Comparativa de costo operativo anual', color: '#f3f4f6' } },
                    scales: {
                        y: { ticks: { color: '#94a3b8' }, grid: { color: '#1f2937' } },
                        x: { ticks: { color: '#e5e7eb' }, grid: { display: false } },
                    },
                },
            });
        }

        const ctxAhorro = document.getElementById('chart-ahorro');
        if (ctxAhorro && ahorro.length) {
            let acumulado = 0;
            const acumulados = ahorro.map(v => (acumulado += v));
            new Chart(ctxAhorro, {
                type: 'line',
                data: {
                    labels: acumulados.map((_, i) => `Mes ${i + 1}`),
                    datasets: [{
                        label: 'Ahorro acumulado proyectado (COP)',
                        data: acumulados,
                        borderColor: '#4D8BFF',
                        backgroundColor: 'rgba(77,139,255,0.18)',
                        fill: true,
                        tension: 0.3,
                    }],
                },
                options: {
                    plugins: { legend: { display: false }, title: { display: true, text: 'Ahorro acumulado proyectado (12 meses)', color: '#f3f4f6' } },
                    scales: {
                        y: { ticks: { color: '#94a3b8' }, grid: { color: '#1f2937' } },
                        x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                    },
                },
            });
        }
    }

    btnDesbloquear?.addEventListener('click', async () => {
        const datosGuardadosJson = sessionStorage.getItem('auditoriaTemp');
        if (!datosGuardadosJson) {
            alert('Por favor completa primero el formulario de diagnóstico.');
            return;
        }
        const datos = JSON.parse(datosGuardadosJson);

        btnDesbloquear.textContent = 'Procesando pago y generando reporte con IA...';
        btnDesbloquear.disabled = true;

        let reporte;
        try {
            const { data: fnData, error: fnError } = await _supabase.functions.invoke(
                'hyper-endpoint',
                { body: datos }
            );
            if (fnError) throw new Error(fnError.message || 'Error desconocido de la función.');
            if (fnData.error) throw new Error(fnData.error);
            reporte = fnData.reporte;
        } catch (err) {
            console.error('Error al generar el reporte con IA:', err);
            reporte = reporteFallback(datos);
        }

        const textoResultadoGratis = document.getElementById('texto-resultado-gratis');
        const nodoReporte = renderReporteEstructurado(reporte, datos);
        if (textoResultadoGratis) {
            textoResultadoGratis.appendChild(nodoReporte);
        }
        dibujarGraficos(reporte);

        btnDesbloquear.textContent = '¡Reporte Generado con Éxito!';
        btnDesbloquear.style.display = 'none';
        if (btnDescargarPdf) btnDescargarPdf.style.display = 'block';
        if (seccionAgendamiento) seccionAgendamiento.style.display = 'block';

        let checklist = [];
        if (ultimaAuditoriaId) {
            checklist = construirChecklistDesdeRoadmap(reporte.roadmap || []);
            const { error } = await _supabase
                .from('auditorias')
                .update({ resultado: JSON.stringify(reporte), plan_checklist: checklist })
                .eq('id', ultimaAuditoriaId);
            if (error) console.error('Error al actualizar la auditoría con el reporte premium:', error);
        }

        const seccionPlan = document.getElementById('seccion-plan-interactivo');
        if (seccionPlan && checklist.length) {
            seccionPlan.style.display = 'block';
            renderChecklist(checklist);
        }

        const seccionChat = document.getElementById('seccion-chat-consultor');
        const chatLoginAviso = document.getElementById('chat-login-aviso');
        const chatInput = document.getElementById('chat-input');
        const chatEnviarBtn = document.getElementById('chat-enviar');
        if (seccionChat) {
            seccionChat.style.display = 'block';
            const { data: { session: sesionActual } } = await _supabase.auth.getSession();
            if (sesionActual?.user && ultimaAuditoriaId) {
                if (chatInput) chatInput.disabled = false;
                if (chatEnviarBtn) chatEnviarBtn.disabled = false;
                if (chatLoginAviso) chatLoginAviso.style.display = 'none';
                cargarHistorialChat(ultimaAuditoriaId);
            } else {
                if (chatInput) chatInput.disabled = true;
                if (chatEnviarBtn) chatEnviarBtn.disabled = true;
                if (chatLoginAviso) chatLoginAviso.style.display = 'block';
            }
        }
    });

    // ==========================================
    // 8b. PLAN INTERACTIVO
    // ==========================================
    function construirChecklistDesdeRoadmap(roadmap) {
        const rangosDias = { 'Días 0-15': [0, 15], 'Días 16-30': [16, 30], 'Días 31-60': [31, 60] };
        const items = [];
        let contador = 0;
        (roadmap || []).forEach((fase) => {
            const rango = rangosDias[fase.fase] || [0, 15];
            (fase.acciones || []).forEach((accion, idx) => {
                const diasOffset = rango[0] + Math.round((rango[1] - rango[0]) * (idx / Math.max((fase.acciones.length - 1), 1)));
                const fecha = new Date();
                fecha.setDate(fecha.getDate() + diasOffset);
                items.push({
                    id: `item-${contador++}`,
                    fase: fase.fase,
                    accion,
                    fecha: fecha.toISOString().slice(0, 10),
                    completado: false,
                });
            });
        });
        return items;
    }

    function renderChecklist(checklist) {
        const contenedor = document.getElementById('lista-plan-checklist');
        if (!contenedor) return;
        contenedor.innerHTML = checklist.map(item => `
            <label style="display:flex;align-items:flex-start;gap:10px;background:#111827;padding:12px 14px;border-radius:8px;cursor:pointer;">
                <input type="checkbox" data-item-id="${item.id}" ${item.completado ? 'checked' : ''} style="margin-top:3px;width:18px;height:18px;accent-color:#22c55e;cursor:pointer;">
                <span style="flex:1;color:${item.completado ? '#64748b' : '#e5e7eb'};text-decoration:${item.completado ? 'line-through' : 'none'};">
                    ${item.accion}
                    <br><span style="font-size:11px;color:#FF6B00;">${item.fase} · Fecha objetivo: ${item.fecha}</span>
                </span>
            </label>
        `).join('');

        contenedor.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', async (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                const item = checklist.find(i => i.id === itemId);
                if (item) item.completado = e.target.checked;
                renderChecklist(checklist);
                if (ultimaAuditoriaId) {
                    const { error } = await _supabase
                        .from('auditorias')
                        .update({ plan_checklist: checklist })
                        .eq('id', ultimaAuditoriaId);
                    if (error) console.error('Error al guardar el progreso del plan:', error);
                }
            });
        });
    }

    // ==========================================
    // 8c. CHAT CON EL CONSULTOR DE IA
    // ==========================================
    function renderMensajeChat(rol, contenido) {
        const lista = document.getElementById('chat-mensajes-lista');
        if (!lista) return;
        const esUsuario = rol === 'user';
        const burbuja = document.createElement('div');
        burbuja.style.cssText = `align-self:${esUsuario ? 'flex-end' : 'flex-start'};max-width:80%;background:${esUsuario ? '#0057FF' : '#1e293b'};color:#f3f4f6;padding:10px 14px;border-radius:12px;font-size:14px;white-space:pre-wrap;`;
        burbuja.textContent = contenido;
        lista.appendChild(burbuja);
        lista.scrollTop = lista.scrollHeight;
    }

    async function cargarHistorialChat(auditoriaId) {
        const lista = document.getElementById('chat-mensajes-lista');
        if (lista) lista.innerHTML = '';
        const { data, error } = await _supabase
            .from('chat_mensajes')
            .select('rol, contenido')
            .eq('auditoria_id', auditoriaId)
            .order('created_at', { ascending: true });
        if (error) {
            console.error('Error al cargar el historial de chat:', error);
            return;
        }
        (data || []).forEach(m => renderMensajeChat(m.rol, m.contenido));
        if (!data || data.length === 0) {
            renderMensajeChat('assistant', '¡Hola! Ya revisé tu auditoría. Pregúntame por dónde empezar con tu roadmap, o cualquier duda sobre cómo implementar alguna de las acciones.');
        }
    }

    async function enviarMensajeChat() {
        const chatInput = document.getElementById('chat-input');
        const chatEnviarBtn = document.getElementById('chat-enviar');
        const mensaje = chatInput?.value.trim();
        if (!mensaje || !ultimaAuditoriaId) return;

        renderMensajeChat('user', mensaje);
        chatInput.value = '';
        chatInput.disabled = true;
        chatEnviarBtn.disabled = true;
        chatEnviarBtn.textContent = '...';

        try {
            const { data, error } = await _supabase.functions.invoke('hyper-processor', {
                body: { auditoriaId: ultimaAuditoriaId, mensaje },
            });
            if (error) throw new Error(error.message || 'Error al chatear.');
            if (data.error) throw new Error(data.error);
            renderMensajeChat('assistant', data.respuesta);
        } catch (err) {
            console.error('Error en el chat:', err);
            renderMensajeChat('assistant', 'Uy, no pude responder en este momento. Intenta de nuevo en unos segundos.');
        } finally {
            chatInput.disabled = false;
            chatEnviarBtn.disabled = false;
            chatEnviarBtn.textContent = 'Enviar';
            chatInput.focus();
        }
    }

    document.getElementById('chat-enviar')?.addEventListener('click', enviarMensajeChat);
    document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enviarMensajeChat();
    });

    // ==========================================
    // 9. INFORME EN PDF — usa el diálogo del navegador ("Guardar como PDF").
    // La clase en <body> activa en style.css la vista de impresión solo del informe.
    // ==========================================
    btnDescargarPdf?.addEventListener('click', () => {
        document.body.classList.add('imprimiendo-reporte');
        setTimeout(() => window.print(), 100);
    });
    window.addEventListener('afterprint', () => {
        document.body.classList.remove('imprimiendo-reporte');
    });

    // ==========================================
    // 10. FORMULARIO DE CONTACTO — canal de captación de clientes
    // ==========================================
    const contactForm = document.getElementById('contact-form');
    contactForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputs = contactForm.querySelectorAll('input, textarea');
        const boton = contactForm.querySelector('button[type="submit"]');
        if (boton) { boton.disabled = true; boton.textContent = 'Enviando...'; }

        const { error } = await _supabase
            .from('contactos_agencia')
            .insert([{
                nombre: inputs[0].value.trim(),
                empresa: inputs[1].value.trim(),
                email: inputs[2].value.trim(),
                desafio: inputs[3].value.trim()
            }]);

        if (boton) { boton.disabled = false; boton.textContent = 'Enviar mi solicitud'; }
        if (error) {
            console.error('Error al enviar el contacto:', error);
            alert('Hubo un error al enviar tu mensaje. Inténtalo de nuevo.');
        } else {
            alert('¡Gracias! Recibimos tu solicitud y pronto nos pondremos en contacto contigo.');
            contactForm.reset();
        }
    });

});

// ==========================================
// HISTORIAL (tabla real "auditorias")
// ==========================================
async function cargarReportesAnteriores(emailUser) {
    const contenedorLista = document.getElementById('lista-reportes-anteriores');
    if (!contenedorLista) return;

    contenedorLista.innerHTML = '<p style="color:#94a3b8;font-size:13px;">Buscando reportes previos...</p>';

    const { data, error } = await _supabase
        .from('auditorias')
        .select('*')
        .eq('email', emailUser)
        .order('created_at', { ascending: false });

    if (error) {
        contenedorLista.innerHTML = `<p style="color:#ef4444;font-size:13px;">Error al cargar el historial: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        contenedorLista.innerHTML = '<p style="color:#64748b;font-size:13px;font-style:italic;">No se encontraron auditorías guardadas con este correo.</p>';
        return;
    }

    contenedorLista.innerHTML = '';
    data.forEach((reporte) => {
        const item = document.createElement('div');
        item.style.cssText = 'background:#1e293b;padding:15px;border-radius:8px;border:1px solid #475569;';
        item.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <strong style="color:#FF6B00;font-size:14px;">${reporte.empresa || 'Sin nombre'}</strong>
                    <p style="color:#94a3b8;font-size:12px;margin:4px 0 0 0;">
                        ${reporte.sector || ''} · ${reporte.empleados ?? '?'} empleados · ${new Date(reporte.created_at).toLocaleDateString()}
                    </p>
                </div>
                <span style="background:#0057FF;color:white;padding:5px 10px;border-radius:4px;font-size:12px;font-weight:bold;">Guardado</span>
            </div>
            <details style="margin-top:10px;">
                <summary style="cursor:pointer;color:#94a3b8;font-size:12px;">Ver diagnóstico</summary>
                <div style="margin-top:8px;color:#d1d5db;font-size:13px;">${reporte.resultado || 'Sin detalle disponible.'}</div>
            </details>
            <button class="btn-continuar-chat" data-auditoria-id="${reporte.id}" style="margin-top:10px;background:transparent;border:1px solid #FF6B00;color:#FF6B00;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;">💬 Continuar conversación</button>
        `;
        contenedorLista.appendChild(item);
    });

    contenedorLista.querySelectorAll('.btn-continuar-chat').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-auditoria-id'), 10);
            ultimaAuditoriaId = id;
            const seccionChat = document.getElementById('seccion-chat-consultor');
            const contenedorPadre = document.getElementById('resultado-auditoria-container');
            const chatInput = document.getElementById('chat-input');
            const chatEnviarBtn = document.getElementById('chat-enviar');
            const chatLoginAviso = document.getElementById('chat-login-aviso');
            if (seccionChat) {
                if (contenedorPadre) contenedorPadre.style.display = 'block';
                seccionChat.style.display = 'block';
                if (chatInput) chatInput.disabled = false;
                if (chatEnviarBtn) chatEnviarBtn.disabled = false;
                if (chatLoginAviso) chatLoginAviso.style.display = 'none';
                cargarHistorialChat(id);
                seccionChat.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}