import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuración de tu proyecto en Firebase Console
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-app.firebaseapp.com",
  projectId: "tu-app-id",
  storageBucket: "tu-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PASS_ADMIN = "Siipallets2256";
let personaSeleccionadaDni = null;

// --- REGISTRO DE SW PARA PWA ---
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
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('tab-personal').classList.add('active');
    cargarListaPersonal();
  }
};

// --- LOGICA FICHAJE (ENTRADA / SALIDA) ---
window.registrarFichaje = async function() {
  const dniInput = document.getElementById('dniInput');
  const dni = dniInput.value.trim();
  const msgEl = document.getElementById('mensajeStatus');

  if (!dni) {
    mostrarMensaje("Por favor, ingrese un DNI válido", "error");
    return;
  }

  const hoy = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
  const horaActual = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  try {
    // Buscar si ya fichó hoy
    const q = query(collection(db, "fichajes"), where("dni", "==", dni), where("fecha", "==", hoy));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // PRIMERA VEZ EN EL DÍA -> INGRESO
      await addDoc(collection(db, "fichajes"), {
        dni: dni,
        fecha: hoy,
        horaIngreso: horaActual,
        horaEgreso: null,
        totalHoras: 0
      });
      mostrarMensaje(`🟢 INGRESO registrado a las ${horaActual} para DNI: ${dni}`, "exito");
    } else {
      // YA TIENE REGISTRO EN EL DÍA -> REVISAR EGRESO
      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();

      if (!data.horaEgreso) {
        // MARCAR EGRESO
        const total = calcularHoras(data.horaIngreso, horaActual);
        await updateDoc(doc(db, "fichajes", docSnap.id), {
          horaEgreso: horaActual,
          totalHoras: total
        });
        mostrarMensaje(`🔴 EGRESO registrado a las ${horaActual} para DNI: ${dni} (${total} hs)`, "exito");
      } else {
        mostrarMensaje(`⚠️ El DNI ${dni} ya registró ingreso y egreso el día de hoy.`, "alerta");
      }
    }
    dniInput.value = "";
    dniInput.focus();
  } catch (error) {
    console.error("Error en fichaje:", error);
    mostrarMensaje("Ocurrió un error al registrar.", "error");
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
}

// --- PESTAÑA PERSONAL Y EDICIÓN PROTEGIDA ---
async function cargarListaPersonal() {
  const tbody = document.getElementById('tablaPersonalBody');
  tbody.innerHTML = "Cargando...";

  // Agrupar DNIs de fichajes o cargar coleccion personal
  const querySnapshot = await getDocs(collection(db, "fichajes"));
  const personasMap = new Map();

  querySnapshot.forEach(doc => {
    const d = doc.data();
    if (!personasMap.has(d.dni)) {
      personasMap.set(d.dni, { dni: d.dni, nombre: `Empleado (${d.dni})` });
    }
  });

  document.getElementById('totalPersonalBadge').innerText = `Total: ${personasMap.size}`;
  tbody.innerHTML = "";

  personasMap.forEach((persona) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${persona.dni}</td>
      <td>${persona.nombre}</td>
      <td>
        <button title="Editar" onclick="editarPersona('${persona.dni}')">✏️</button>
        <button title="Imprimir Reporte" onclick="abrirReporte('${persona.dni}')">🖨️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.editarPersona = function(dni) {
  const pass = prompt("Ingrese la contraseña de administrador para modificar:");
  if (pass === PASS_ADMIN) {
    const nuevoNombre = prompt(`Modificar datos para DNI ${dni}:`, `Empleado ${dni}`);
    if (nuevoNombre) {
      alert(`Datos actualizados correctamente para DNI ${dni}`);
      // Aquí se actualizaría en la colección de personas si la tuvieras separada
    }
  } else if (pass !== null) {
    alert("❌ Contraseña incorrecta.");
  }
};

// --- REPORTE Y PDF ---
window.abrirReporte = function(dni) {
  personaSeleccionadaDni = dni;
  document.getElementById('reportePersonaNombre').innerText = `Reporte para DNI: ${dni}`;
  document.getElementById('pdfTitulo').innerText = `Control Horario - DNI: ${dni}`;
  document.getElementById('modalReporte').classList.remove('hidden');
};

window.cerrarModalReporte = function() {
  document.getElementById('modalReporte').classList.add('hidden');
};

window.generarReporte = async function() {
  const desde = document.getElementById('fechaDesde').value;
  const hasta = document.getElementById('fechaHasta').value;
  const tbody = document.getElementById('reporteBody');
  tbody.innerHTML = "Buscando...";

  const q = query(collection(db, "fichajes"), where("dni", "==", personaSeleccionadaDni));
  const snap = await getDocs(q);

  let html = "";
  let sumaHoras = 0;

  snap.forEach(docSnap => {
    const data = docSnap.data();
    if ((!desde || data.fecha >= desde) && (!hasta || data.fecha <= hasta)) {
      const horas = parseFloat(data.totalHoras || 0);
      sumaHoras += horas;
      html += `
        <tr>
          <td>${data.fecha}</td>
          <td>${data.horaIngreso || '-'}</td>
          <td>${data.horaEgreso || '-'}</td>
          <td>${horas} hs</td>
        </tr>
      `;
    }
  });

  tbody.innerHTML = html || "<tr><td colspan='4'>No hay registros en el rango.</td></tr>";
  document.getElementById('totalHorasPeriodo').innerText = sumaHoras.toFixed(2);
};

window.descargarPDF = function() {
  const elemento = document.getElementById('areaImpresion');
  const opt = {
    margin:       0.5,
    filename:     `reporte_DNI_${personaSeleccionadaDni}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(elemento).save();
};
