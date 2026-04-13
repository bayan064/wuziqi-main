/**
 * 技能五子棋 - 棋盘绘制与坐标模块 (A 模块 - 动画增强版)
 */

/**
 * 绘制正式棋盘和棋子（支持动画 + 红框）
 */
const drawBoard = (ctx, board, canvasSize, lastAIMove, animatingMove) => {
  if (!ctx || !board) return;

  const cellSize = canvasSize / 15;
  const margin = cellSize / 2;

  // ===== 1. 背景 =====
  ctx.fillStyle = '#E3C16F';
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // ===== 2. 网格 =====
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1;
  for (let i = 0; i < 15; i++) {
    ctx.beginPath();
    ctx.moveTo(margin, margin + i * cellSize);
    ctx.lineTo(canvasSize - margin, margin + i * cellSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(margin + i * cellSize, margin);
    ctx.lineTo(margin + i * cellSize, canvasSize - margin);
    ctx.stroke();
  }

  // ===== 3. 星位 =====
  const stars = [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]];
  ctx.fillStyle = '#333333';
  stars.forEach(([r, c]) => {
    ctx.beginPath();
    ctx.arc(margin + c * cellSize, margin + r * cellSize, 3, 0, 2 * Math.PI);
    ctx.fill();
  });

  // ===== 4. 普通棋子 =====
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (board[r][c] !== 0) {
        drawPiece(ctx, r, c, board[r][c], cellSize, margin, 1);
      }
    }
  }

  // ===== 5. 动画棋子（覆盖绘制）=====
  if (animatingMove) {
    const { row, col, progress } = animatingMove;

    drawPiece(ctx, row, col, 2, cellSize, margin, progress);
  }

  // ===== 6. 红框标记 AI 最后一步 =====
  if (lastAIMove) {
    const { row, col } = lastAIMove;

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    ctx.strokeRect(
      margin + col * cellSize - cellSize * 0.4,
      margin + row * cellSize - cellSize * 0.4,
      cellSize * 0.8,
      cellSize * 0.8
    );
  }
};

/**
 * 绘制单个棋子（支持缩放动画）
 */
function drawPiece(ctx, row, col, player, cellSize, margin, scale = 1) {
  scale = Math.min(Math.max(scale, 0.01), 1.1);
  const x = margin + col * cellSize;
  const y = margin + row * cellSize;

  ctx.beginPath();
  ctx.arc(x, y, cellSize * 0.42 * scale, 0, 2 * Math.PI);

  if (player === 1) {
    ctx.fillStyle = '#000000';
    ctx.fill();
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * 将像素坐标转换为棋盘坐标
 */
const getBoardPosition = (x, y, canvasSize) => {
  const cellSize = canvasSize / 15;
  const margin = cellSize / 2;

  const col = Math.round((x - margin) / cellSize);
  const row = Math.round((y - margin) / cellSize);

  if (row >= 0 && row < 15 && col >= 0 && col < 15) {
    return { row, col };
  }
  return null;
};

export {
  drawBoard,
  getBoardPosition
};