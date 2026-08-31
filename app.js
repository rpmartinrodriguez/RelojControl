import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBLpdyO43EQaXEuPqAvsiHfWaGkKtSYji0",
  authDomain: "relojcontrol-7ad3d.firebaseapp.com",
  projectId: "relojcontrol-7ad3d",
  storageBucket: "relojcontrol-7ad3d.firebasestorage.app",
  messagingSenderId: "194296134237",
  appId: "1:194296134237:web:621227c70f4012fdd6abb4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PASS_ADMIN = "Siipallets2256";
let personaSeleccionadaDni = null;
let editandoId = null;

// --- REGISTRO DE SW ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error:', err));
}

// --- NAVEGACIÓN TAB ---
window.switchTab = function(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(sec => sec.classList.remove('active'));
  
  if (tabName === 'registro') {
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.getElementById('tab-registro').classList.add('active');
    document.getElementById('dniInput').focus();
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('tab-personal').classList.add('active');
    cargarListaPersonal();
  }
};

// --- LÓGICA FICHAJE ---
window.registrarFichaje = async function() {
  const dniInput = document.getElementById('dniInput');
  const dni = dniInput.value.trim();
  
  if (!dni) {
    mostrarMensaje("Por favor, ingrese un DNI válido.", "error");
    return;
  }

  try {
    const qPersonal = query(collection(db, "personal"), where("dni", "==", dni));
    const snapPersonal = await getDocs(qPersonal);

    if (snapPersonal.empty) {
      mostrarMensaje(`❌ DNI ${dni} no registrado. Solicite alta.`, "error");
      dniInput.value = "";
      dniInput.focus();
      return; 
    }

    const empleadoNombre = snapPersonal.docs[0].data().nombre;
    const hoy = new Date().toISOString().split('T')[0];
    const horaActual = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    const qFichaje = query(collection(db, "fichajes"), where("dni", "==", dni), where("fecha", "==", hoy));
    const querySnapshot = await getDocs(qFichaje);

    if (querySnapshot.empty) {
      await addDoc(collection(db, "fichajes"), {
        dni: dni,
        nombre: empleadoNombre, 
        fecha: hoy,
        horaIngreso: horaActual,
        horaEgreso: null,
        totalHoras: 0
      });
      mostrarMensaje(`🟢 Ingreso: ${empleadoNombre} a las ${horaActual}`, "exito");
    } else {
      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();

      if (!data.horaEgreso) {
        const total = calcularHoras(data.horaIngreso, horaActual);
        await updateDoc(doc(db, "fichajes", docSnap.id), {
          horaEgreso: horaActual,
          totalHoras: total
        });
        mostrarMensaje(`🔴 Egreso: ${empleadoNombre} a las ${horaActual} (${total} hs)`, "exito");
      } else {
        mostrarMensaje(`⚠️ ${empleadoNombre} ya completó su jornada hoy.`, "alerta");
      }
    }
    dniInput.value = "";
    dniInput.focus();
  } catch (error) {
    console.error("Error en fichaje:", error);
    mostrarMensaje("Ocurrió un error en el sistema.", "error");
  }
};

function calcularHoras(ingresoStr, egresoStr) {
  const [h1, m1] = ingresoStr.split(':').map(Number);
  const [h2, m2] = egresoStr.split(':').map(Number);
  const totalMinutos = (h2 * 60 + m2) - (h1 * 60 + m1);
  return (totalMinutos / 60).toFixed(2);
}

function mostrarMensaje(texto, tipo) {
  const msgEl = document.getElementById('mensajeStatus');
  msgEl.innerText = texto;
  msgEl.className = `status-msg ${tipo}`;
  setTimeout(() => { msgEl.className = 'status-msg'; msgEl.innerText = ''; }, 6000);
}

// --- GESTIÓN DE PERSONAL ---
async function cargarListaPersonal() {
  const tbody = document.getElementById('tablaPersonalBody');
  tbody.innerHTML = "<tr><td colspan='3'>Cargando datos...</td></tr>";

  try {
    const querySnapshot = await getDocs(collection(db, "personal"));
    document.getElementById('totalPersonalBadge').innerText = `Total: ${querySnapshot.size}`;
    tbody.innerHTML = "";

    if(querySnapshot.empty) {
      tbody.innerHTML = "<tr><td colspan='3' class='text-center'>No hay personal registrado</td></tr>";
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const p = docSnap.data();
      const id = docSnap.id;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${p.dni}</strong></td>
        <td>${p.nombre}</td>
        <td class="action-cell">
          <button class="btn-icon" title="Editar" onclick="editarPersona('${p.dni}', '${p.nombre}', '${id}')">✏️</button>
          <button class="btn-icon" title="Imprimir Reporte" onclick="abrirReporte('${p.dni}', '${p.nombre}')">🖨️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = "<tr><td colspan='3'>Error al cargar datos.</td></tr>";
  }
}

window.agregarPersona = function() {
  const pass = prompt("🔑 Ingrese contraseña de administrador:");
  if (pass === PASS_ADMIN) {
    editandoId = null; 
    document.getElementById('personaDni').value = "";
    document.getElementById('personaDni').disabled = false;
    document.getElementById('personaNombre').value = "";
    document.getElementById('modalPersonaTitulo').innerText = "Alta de Empleado";
    document.getElementById('modalPersona').classList.remove('hidden');
    setTimeout(() => document.getElementById('personaDni').focus(), 100);
  } else if (pass !== null) {
    alert("❌ Contraseña incorrecta.");
  }
};

window.editarPersona = function(dni, nombre, docId) {
  const pass = prompt("🔑 Ingrese contraseña de administrador:");
  if (pass === PASS_ADMIN) {
    editandoId = docId; 
    document.getElementById('personaDni').value = dni;
    document.getElementById('personaDni').disabled = true; 
    document.getElementById('personaNombre').value = nombre;
    document.getElementById('modalPersonaTitulo').innerText = "Editar Empleado";
    document.getElementById('modalPersona').classList.remove('hidden');
    setTimeout(() => document.getElementById('personaNombre').focus(), 100);
  } else if (pass !== null) {
    alert("❌ Contraseña incorrecta.");
  }
};

window.cerrarModalPersona = function() {
  document.getElementById('modalPersona').classList.add('hidden');
};

window.guardarPersona = async function() {
  const dni = document.getElementById('personaDni').value.trim();
  const nombre = document.getElementById('personaNombre').value.trim();
  const btnGuardar = document.getElementById('btnGuardarPersona');

  if (!dni || !nombre) { alert("⚠️ Complete DNI y Nombre."); return; }

  btnGuardar.innerText = "⏳ Guardando...";
  btnGuardar.disabled = true;

  try {
    if (editandoId) {
      await updateDoc(doc(db, "personal", editandoId), { nombre: nombre });
    } else {
      const q = query(collection(db, "personal"), where("dni", "==", dni));
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert("❌ Este DNI ya está registrado.");
        btnGuardar.innerText = "Guardar Empleado";
        btnGuardar.disabled = false;
        return;
      }
      await addDoc(collection(db, "personal"), { dni: dni, nombre: nombre });
    }
    cerrarModalPersona();
    cargarListaPersonal(); 
  } catch (error) {
    alert("❌ Error al guardar. Verifica tu conexión.");
  } finally {
    btnGuardar.innerText = "Guardar Empleado";
    btnGuardar.disabled = false;
  }
};

// --- CÁLCULO DE ATRASOS Y EXTRAS ---
function calcularAtraso(ingresoStr) {
  if (!ingresoStr) return "-";
  const [h, m] = ingresoStr.split(':').map(Number);
  const minutosTotales = h * 60 + m;
  const limite = 7 * 60 + 15; // 07:15 tolerancia
  const base = 7 * 60; // 07:00

  if (minutosTotales > limite) {
    return (minutosTotales - base) + "m";
  }
  return "-";
}

function calcularExtras(egresoStr) {
  if (!egresoStr) return "-";
  const [h, m] = egresoStr.split(':').map(Number);
  const minutosTotales = h * 60 + m;
  const base = 16 * 60; // 16:00

  if (minutosTotales > base) {
    return (minutosTotales - base) + "m";
  }
  return "-";
}

// --- REPORTE Y PDF ---
window.abrirReporte = function(dni, nombre) {
  const pass = prompt("🔑 Ingrese contraseña de administrador para ver el reporte:");
  
  if (pass === PASS_ADMIN) {
    personaSeleccionadaDni = dni;
    document.getElementById('reportePersonaNombre').innerText = `Empleado: ${nombre}`;
    document.getElementById('pdfTitulo').innerText = `Reporte Control Horario - DNI: ${dni} (${nombre})`;
    
    // Fechas por defecto: mes en curso (Día 1 hasta hoy)
    const hoy = new Date();
    const pad = n => n.toString().padStart(2, '0');
    
    const primerDia = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-01`;
    const diaActual = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

    document.getElementById('fechaDesde').value = primerDia;
    document.getElementById('fechaHasta').value = diaActual;
    
    document.getElementById('modalReporte').classList.remove('hidden');
    generarReporte(); // Genera automáticamente
  } else if (pass !== null) {
    alert("❌ Contraseña incorrecta.");
  }
};

window.cerrarModalReporte = function() {
  document.getElementById('modalReporte').classList.add('hidden');
};

window.generarReporte = async function() {
  const desde = document.getElementById('fechaDesde').value;
  const hasta = document.getElementById('fechaHasta').value;
  const tbody = document.getElementById('reporteBody');
  tbody.innerHTML = "<tr><td colspan='7' class='text-center'>Buscando registros...</td></tr>";

  try {
    const q = query(collection(db, "fichajes"), where("dni", "==", personaSeleccionadaDni));
    const snap = await getDocs(q);

    let html = "";
    let sumaHoras = 0;
    
    let registros = [];
    snap.forEach(docSnap => registros.push(docSnap.data()));
    registros.sort((a, b) => a.fecha.localeCompare(b.fecha)); // Orden cronológico

    registros.forEach(data => {
      if ((!desde || data.fecha >= desde) && (!hasta || data.fecha <= hasta)) {
        const horasNum = parseFloat(data.totalHoras || 0);
        sumaHoras += horasNum;
        
        const atraso = calcularAtraso(data.horaIngreso);
        const extra = calcularExtras(data.horaEgreso);
        const cumplio = horasNum >= 9 ? '<span class="status-ok">Sí</span>' : '<span class="status-bad">No</span>';

        html += `
          <tr>
            <td>${data.fecha}</td>
            <td>${data.horaIngreso || '-'}</td>
            <td>${data.horaEgreso || '-'}</td>
            <td class="${atraso !== '-' ? 'text-red' : ''}">${atraso}</td>
            <td class="${extra !== '-' ? 'text-green' : ''}">${extra}</td>
            <td><strong>${horasNum} hs</strong></td>
            <td>${cumplio}</td>
          </tr>
        `;
      }
    });

    tbody.innerHTML = html || "<tr><td colspan='7' class='text-center'>No hay registros en el rango.</td></tr>";
    document.getElementById('totalHorasPeriodo').innerText = sumaHoras.toFixed(2);
  } catch (error) {
    tbody.innerHTML = "<tr><td colspan='7' class='text-center'>Error al cargar reporte.</td></tr>";
  }
};

window.descargarPDF = function() {
  const elemento = document.getElementById('areaImpresion');
  const opt = {
    margin:       0.4,
    filename:     `Reporte_${personaSeleccionadaDni}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(elemento).save();
};
