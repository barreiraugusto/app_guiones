// Reloj en tiempo real
function actualizarReloj() {
    const relojElemento = document.getElementById('reloj');
    if (relojElemento) {
        const ahora = new Date();
        const horas = ahora.getHours().toString().padStart(2, '0');
        const minutos = ahora.getMinutes().toString().padStart(2, '0');
        const segundos = ahora.getSeconds().toString().padStart(2, '0');
        relojElemento.textContent = `${horas}:${minutos}:${segundos}`;
    }
}

setInterval(actualizarReloj, 1000);
actualizarReloj();

// Verificar si estamos en reloj.html o control.html
const cronometroElemento = document.getElementById('cronometro');
const inicioBoton = document.getElementById('inicio');
const detenerBoton = document.getElementById('detener');
const restablecerBoton = document.getElementById('restablecer');

// Lógica del cronómetro (solo en reloj.html)
if (cronometroElemento) {
    let cronometroInterval;
    let tiempo = 0;

    function actualizarCronometro() {
        const horas = Math.floor(tiempo / 3600).toString().padStart(2, '0');
        const minutos = Math.floor((tiempo % 3600) / 60).toString().padStart(2, '0');
        const segundos = (tiempo % 60).toString().padStart(2, '0');
        cronometroElemento.textContent = `${horas}:${minutos}:${segundos}`;
        console.log(`Cronómetro actualizado: ${horas}:${minutos}:${segundos}`); // Depuración
    }

    // Lógica de los botones (solo en control.html)
    if (inicioBoton && detenerBoton && restablecerBoton) {
        inicioBoton.addEventListener('click', () => {
            if (cronometroInterval) {
                clearInterval(cronometroInterval);
                tiempo = 0;
                actualizarCronometro();
                inicioBoton.textContent = 'Inicio';
                restablecerBoton.style.display = 'none';
                console.log('Cronómetro restablecido'); // Depuración
            } else {
                cronometroInterval = setInterval(() => {
                    tiempo++;
                    console.log(`Tiempo incrementado: ${tiempo}`); // Depuración
                    actualizarCronometro();
                }, 1000);
                inicioBoton.textContent = 'Rest.';
                restablecerBoton.style.display = 'inline';
                console.log('Cronómetro iniciado'); // Depuración
            }
        });

        detenerBoton.addEventListener('click', () => {
            clearInterval(cronometroInterval);
            cronometroInterval = null;
            inicioBoton.textContent = 'Rest.';
            restablecerBoton.style.display = 'inline';
            console.log('Cronómetro detenido'); // Depuración
        });

        restablecerBoton.addEventListener('click', () => {
            tiempo = 0;
            actualizarCronometro();
            inicioBoton.textContent = 'Inicio';
            restablecerBoton.style.display = 'none';
            console.log('Cronómetro restablecido'); // Depuración
        });
    }
} else {
    console.log('No se encontró el elemento cronometro'); // Depuración
}