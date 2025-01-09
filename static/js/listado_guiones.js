async function borrarGuion(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Estás seguro?',
        text: "¿Quieres borrar este guion?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        await fetch(`/guiones/borrar/${id}`, {
            method: 'DELETE'
        });
        Swal.fire({
            title: 'Borrado!',
            text: 'El guion ha sido borrado.',
            icon: 'success',
            timer: 1000, // Duración en milisegundos (2 segundos)
            timerProgressBar: true, // Muestra una barra de progreso
            showConfirmButton: false // Oculta el botón de confirmación
        }).then(() => {
            window.location.reload(); // Recargar la página para actualizar la lista de guiones
        });
    }
}