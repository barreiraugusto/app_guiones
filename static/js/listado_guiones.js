async function borrarGuion(id) {
    if (confirm("¿Estás seguro de que quieres borrar este guion?")) {
        await fetch(`/guiones/borrar/${id}`, {
            method: 'DELETE'
        });
        window.location.reload(); // Recargar la página para actualizar la lista de guiones
    }
}