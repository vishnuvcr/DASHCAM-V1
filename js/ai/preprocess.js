export function letterboxCanvas(source, targetWidth = 640, targetHeight = 640) {
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(targetWidth, targetHeight)
    : document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  const sourceWidth = source.videoWidth || source.width;
  const sourceHeight = source.videoHeight || source.height;
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) throw new Error("Source frame has no dimensions.");

  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);
  const dx = Math.floor((targetWidth - width) / 2);
  const dy = Math.floor((targetHeight - height) / 2);
  ctx.drawImage(source, dx, dy, width, height);
  return { canvas, scale, dx, dy, sourceWidth, sourceHeight };
}

export function canvasToNchw(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const planeSize = canvas.width * canvas.height;
  const tensor = new Float32Array(planeSize * 3);
  for (let i = 0; i < planeSize; i += 1) {
    tensor[i] = data[i * 4] / 255;
    tensor[planeSize + i] = data[i * 4 + 1] / 255;
    tensor[planeSize * 2 + i] = data[i * 4 + 2] / 255;
  }
  return tensor;
}

export function undoLetterbox(box, meta) {
  return {
    x1: (box.x1 - meta.dx) / meta.scale,
    y1: (box.y1 - meta.dy) / meta.scale,
    x2: (box.x2 - meta.dx) / meta.scale,
    y2: (box.y2 - meta.dy) / meta.scale
  };
}
