// Variable global para saber si estamos editando o creando
let editandoId = null; 

// --- 1. LOGICA FICHAJE (ENTRADA / SALIDA) MODIFICADA ---
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
      return; // Corta la ejecución, no lo deja registrar
    }

    // Obtenemos el nombre del empleado para el mensaje
    const empleadoNombre = snapPersonal.docs[0].data().nombre;

    // 2️⃣ SEGUIMOS CON LA LÓGICA DE REGISTRO
    const hoy = new Date().toISOString().split('T')[0];
    const horaActual = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    const qFichaje = query(collection(db, "fichajes"), where("dni", "==", dni), where("fecha", "==", hoy));
    const querySnapshot = await getDocs(qFichaje);

    if (querySnapshot.empty) {
      // INGRESO
      await addDoc(collection(db, "fichajes"), {
        dni: dni,
        nombre: empleadoNombre, // Guardamos el nombre para historial
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
    console.error("Error:", error);
    mostrarMensaje("Ocurrió un error en el sistema.", "error");
  }
};

// --- 2. GESTIÓN DE PERSONAL ---

async function cargarListaPersonal() {
  const tbody = document.getElementById('tablaPersonalBody');
  tbody.innerHTML = "Cargando...";

  // Ahora leemos de la colección real 'personal'
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
        <button title="Editar" onclick="editarPersona('${p.dni}', '${p.nombre}', '${id}')">✏️</button>
        <button title="Imprimir Reporte" onclick="abrirReporte('${p.dni}')">🖨️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Botón: ➕ Nuevo Empleado
window.agregarPersona = function() {
  const pass = prompt("🔑 Ingrese contraseña de administrador:");
  if (pass === PASS_ADMIN) {
    editandoId = null; // Modo Crear
    document.getElementById('personaDni').value = "";
    document.getElementById('personaDni').disabled = false;
    document.getElementById('personaNombre').value = "";
    document.getElementById('modalPersonaTitulo').innerText = "Alta de Nuevo Empleado";
    document.getElementById('modalPersona').classList.remove('hidden');
  } else if (pass !== null) {
    alert("❌ Contraseña incorrecta.");
  }
};

// Botón: ✏️ Editar
window.editarPersona = function(dni, nombre, docId) {
  const pass = prompt("🔑 Ingrese contraseña de administrador para modificar:");
  if (pass === PASS_ADMIN) {
    editandoId = docId; // Modo Editar (guardamos el ID de Firebase)
    document.getElementById('personaDni').value = dni;
    document.getElementById('personaDni').disabled = true; // No dejamos cambiar el DNI, solo el nombre
    document.getElementById('personaNombre').value = nombre;
    document.getElementById('modalPersonaTitulo').innerText = "Editar Empleado";
    document.getElementById('modalPersona').classList.remove('hidden');
  } else if (pass !== null) {
    alert("❌ Contraseña incorrecta.");
  }
};

window.cerrarModalPersona = function() {
  document.getElementById('modalPersona').classList.add('hidden');
};

// Guardar en Firestore (Crear o Actualizar)
window.guardarPersona = async function() {
  const dni = document.getElementById('personaDni').value.trim();
  const nombre = document.getElementById('personaNombre').value.trim();

  if (!dni || !nombre) {
    alert("Debe completar DNI y Nombre.");
    return;
  }

  try {
    if (editandoId) {
      // MODO EDICIÓN
      await updateDoc(doc(db, "personal", editandoId), { nombre: nombre });
      alert("✅ Empleado actualizado correctamente.");
    } else {
      // MODO CREACIÓN - Verificar que el DNI no exista antes
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
    cargarListaPersonal(); // Recargamos la tabla
  } catch (error) {
    console.error(error);
    alert("Hubo un error al guardar.");
  }
};
