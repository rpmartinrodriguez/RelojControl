import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuración de tu proyecto en Firebase Console (REEMPLAZAR CON TUS DATOS)
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
let editandoId = null; // Variable para saber si editamos o creamos personal

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
    document.getElementById('dniInput').focus();
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('tab-personal').classList.add('active');
    cargarListaPersonal();
  }
};

// --- LÓGICA FICHAJE (ENTRADA / SALIDA) ---
window.registrarFichaje = async function() {
  const dniInput = document.getElementById('dniInput');
  const dni = dniInput.value.trim();
  
  if (!dni) {
    mostrarMensaje("Por favor, ingrese un DNI válido", "error");
    return;
  }

  try {
    // 1️⃣ PRIMERO VALIDAMOS SI EL EMPLEADO EXISTE EN LA BASE DE DATOS
    const qPersonal = query(collection(db, "personal"), where("dni", "==", dni));
    const snapPersonal = await getDocs(qPersonal);

    if (snapPersonal.empty) {
      mostrarMensaje(`❌ DNI ${dni} no registrado. Solicite el alta al administrador.`, "error");
      dniInput.value = "";
      dniInput.focus();
      return; 
    }

    const empleadoNombre = snapPersonal.docs[0].data().nombre;

    // 2️⃣ SEGUIMOS CON LA LÓGICA DE REGISTRO DE HORARIOS
    const hoy = new Date().toISOString().split('T')[0];
    const horaActual = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    const qFichaje = query(collection(db, "fichajes"), where("dni", "==", dni), where("fecha", "==", hoy));
    const querySnapshot = await getDocs(qFichaje);

    if (querySnapshot.empty) {
      // INGRESO
      await addDoc(collection(db, "fichajes"), {
        dni: dni,
        nombre: empleadoNombre, 
        fecha: hoy,
        horaIngreso: horaActual,
        horaEgreso: null,
        totalHoras: 0
      });
      mostrarMensaje(`🟢 INGRESO EXITOSO: ${empleadoNombre} a las ${horaActual}`, "exito");
    } else {
      // EGRESO
      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();

      if (!data.horaEgreso) {
        const total = calcularHoras(data.horaIngreso, horaActual);
        await updateDoc(doc(db, "fichajes", docSnap.id), {
          horaEgreso: horaActual,
          totalHoras: total
        });
        mostrarMensaje(`🔴 EGRESO EXITOSO: ${empleadoNombre} a las ${horaActual} (${total} hs)`, "exito");
      } else {
        mostrarMensaje(`⚠️ ${empleadoNombre} ya completó su jornada hoy.`, "alerta");
      }
    }
    dniInput.value = "";
    dniInput.focus();
  } catch (error) {
    console.error("Error en fichaje:", error);
    mostrarMensaje("Ocurrió un error en el sistema al registrar.", "error");
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

// --- GESTIÓN DE PERSONAL (ABM) ---
async function cargarListaPersonal() {
  const tbody = document.getElementById('tablaPersonalBody');
  tbody.innerHTML = "<tr><td colspan='3'>Cargando...</td></tr>";

  try {
    const querySnapshot = await getDocs(collection(db, "personal"));
    document.getElementById('totalPersonalBadge').innerText = `Total: ${querySnapshot.size}`;
    tbody.innerHTML = "";

    if(querySnapshot.empty) {
      tbody.innerHTML = "<tr><td colspan='3'>No hay personal registrado</td></tr>";
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const p = docSnap.data();
      const id = docSnap.id;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.dni}</td>
        <td>${p.nombre}</td>
        <td>
          <button style="cursor:pointer;" title="Editar" onclick="editarPersona('${p.dni}', '${p.nombre}', '${id}')">✏️</button>
          <button style="cursor:pointer;" title="Imprimir Reporte" onclick="abrirReporte('${p.dni}', '${p.nombre}')">🖨️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error al cargar personal:", error);
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
    document.getElementById('modalPersonaTitulo').innerText = "Alta de Nuevo Empleado";
    document.getElementById('modalPersona').classList.remove('hidden');
    setTimeout(() => document.getElementById('personaDni').focus(), 100);
  } else if (pass !== null) {
    alert("❌ Contraseña incorrecta.");
  }
};

window.editarPersona = function(dni, nombre, docId) {
  const pass = prompt("🔑 Ingrese contraseña de administrador para modificar:");
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

  if (!dni || !nombre) {
    alert("Debe completar DNI y Nombre.");
    return;
  }

  try {
    if (editandoId) {
      await updateDoc(doc(db, "personal", editandoId), { nombre: nombre });
      alert("✅ Empleado actualizado correctamente.");
    } else {
      const q = query(collection(db, "personal"), where("dni", "==", dni));
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert("❌ Este DNI ya está registrado.");
        return;
      }
      await addDoc(collection(db, "personal"), { dni: dni, nombre: nombre });
      alert("✅ Empleado agregado correctamente.");
    }
    cerrarModalPersona();
    cargarListaPersonal(); 
  } catch (error) {
    console.error("Error al guardar empleado:", error);
    alert("Hubo un error al guardar.");
  }
};

// --- REPORTE Y PDF ---
window.abrirReporte = function(dni, nombre) {
  personaSeleccionadaDni = dni;
  document.getElementById('reportePersonaNombre').innerText = `Empleado: ${nombre}`;
  document.getElementById('pdfTitulo').innerText = `Reporte Control Horario - DNI: ${dni} (${nombre})`;
  document.getElementById('fechaDesde').value = "";
  document.getElementById('fechaHasta').value = "";
  document.getElementById('reporteBody').innerHTML = "<tr><td colspan='4'>Seleccione fechas y presione Filtrar.</td></tr>";
  document.getElementById('totalHorasPeriodo').innerText = "0";
  document.getElementById('modalReporte').classList.remove('hidden');
};

window.cerrarModalReporte = function() {
  document.getElementById('modalReporte').classList.add('hidden');
};

window.generarReporte = async function() {
  const desde = document.getElementById('fechaDesde').value;
  const hasta = document.getElementById('fechaHasta').value;
  const tbody = document.getElementById('reporteBody');
  tbody.innerHTML = "<tr><td colspan='4'>Buscando registros...</td></tr>";

  try {
    const q = query(collection(db, "fichajes"), where("dni", "==", personaSeleccionadaDni));
    const snap = await getDocs(q);

    let html = "";
    let sumaHoras = 0;
    
    // Convertimos a array para ordenar por fecha
    let registros = [];
    snap.forEach(docSnap => registros.push(docSnap.data()));
    registros.sort((a, b) => a.fecha.localeCompare(b.fecha));

    registros.forEach(data => {
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

    tbody.innerHTML = html || "<tr><td colspan='4' style='text-align:center;'>No hay registros en el rango seleccionado.</td></tr>";
    document.getElementById('totalHorasPeriodo').innerText = sumaHoras.toFixed(2);
  } catch (error) {
    console.error("Error al generar reporte:", error);
    tbody.innerHTML = "<tr><td colspan='4'>Error al cargar reporte.</td></tr>";
  }
};

window.descargarPDF = function() {
  const elemento = document.getElementById('areaImpresion');
  const opt = {
    margin:       0.5,
    filename:     `Reporte_Horas_DNI_${personaSeleccionadaDni}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(elemento).save();
};
