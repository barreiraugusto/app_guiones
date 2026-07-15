function ajustarTamanoTexto(el, tamanoMaximo) {
    el.style.whiteSpace = 'nowrap';
    let tamano = tamanoMaximo;
    el.style.fontSize = `${tamano}px`;
    while (el.scrollWidth > el.clientWidth && tamano > 1) {
        tamano -= 1;
        el.style.fontSize = `${tamano}px`;
    }
}
