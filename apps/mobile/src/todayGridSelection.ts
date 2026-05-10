export type WeekGridSlotBounds = {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
};

export type WeekGridSlotPoint = {
  pageX: number;
  pageY: number;
};

type WeekGridSlotIndexOptions = {
  blockCount: number;
  blocksPerRow: number;
  bounds: WeekGridSlotBounds;
  columnGap: number;
  point: WeekGridSlotPoint;
  rowGap: number;
};

export function getWeekGridSlotIndexFromPoint({
  blockCount,
  blocksPerRow,
  bounds,
  columnGap,
  point,
  rowGap,
}: WeekGridSlotIndexOptions): number | null {
  if (
    blockCount <= 0 ||
    blocksPerRow <= 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    !isFiniteNumber(point.pageX) ||
    !isFiniteNumber(point.pageY)
  ) {
    return null;
  }

  const rowCount = Math.ceil(blockCount / blocksPerRow);
  const blockWidth = getItemSize(bounds.width, blocksPerRow, columnGap);
  const blockHeight = getItemSize(bounds.height, rowCount, rowGap);

  if (blockWidth <= 0 || blockHeight <= 0) {
    return null;
  }

  const localX = clamp(point.pageX - bounds.pageX, 0, bounds.width - 1);
  const localY = clamp(point.pageY - bounds.pageY, 0, bounds.height - 1);
  const columnIndex = getNearestAxisIndex(localX, blocksPerRow, blockWidth, columnGap);
  const rowIndex = getNearestAxisIndex(localY, rowCount, blockHeight, rowGap);

  return Math.min(rowIndex * blocksPerRow + columnIndex, blockCount - 1);
}

function getItemSize(totalSize: number, itemCount: number, gap: number): number {
  return (totalSize - gap * Math.max(itemCount - 1, 0)) / itemCount;
}

function getNearestAxisIndex(
  position: number,
  itemCount: number,
  itemSize: number,
  gap: number,
): number {
  if (gap <= 0) {
    return clamp(Math.floor(position / itemSize), 0, itemCount - 1);
  }

  const unitSize = itemSize + gap;
  const baseIndex = clamp(Math.floor(position / unitSize), 0, itemCount - 1);
  const offset = position - baseIndex * unitSize;

  if (offset <= itemSize || baseIndex === itemCount - 1) {
    return baseIndex;
  }

  const nextIndex = offset - itemSize > gap / 2 ? baseIndex + 1 : baseIndex;

  return clamp(nextIndex, 0, itemCount - 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}
