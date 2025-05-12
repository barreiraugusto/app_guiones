async function actualizarTiempoTotal(Id) {
    try {
        // Hacer la petición a tu endpoint Flask
        const response = await fetch(`/tiempos/${Id}`);
        const data = await response.json();

        if (response.ok) {
            // Mostrar la duración total en el elemento th
            document.getElementById('tiempo_total').textContent = data.duracion_total;
        } else {
            console.error('Error:', data.mensaje);
            document.getElementById('tiempo_total').textContent = '00:00';
        }
    } catch (error) {
        console.error('Error al obtener los tiempos:', error);
        document.getElementById('tiempo_total').textContent = '00:00';
    }
}