export function createGridTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Fill background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, size, size);

    // Draw grid lines
    ctx.strokeStyle = '#0fbef2';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    // Draw vertical lines
    const cellSize = size / 8;
    for (let x = 0; x <= size; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y <= size; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
    }

    // Draw brighter intersection points
    ctx.globalAlpha = 0.5;
    const pointSize = 2;
    for (let x = 0; x <= size; x += cellSize) {
        for (let y = 0; y <= size; y += cellSize) {
            ctx.fillStyle = '#0fbef2';
            ctx.fillRect(x - pointSize/2, y - pointSize/2, pointSize, pointSize);
        }
    }

    return canvas.toDataURL();
} 