export interface CursorPayload {
  sort: string;
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify([payload.sort, payload.id]), 'utf8').toString('base64url');
}

export function decodeCursor(cursor?: string | null): CursorPayload | null {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(decoded) || decoded.length !== 2) return null;
    const [sort, id] = decoded;
    if (typeof sort !== 'string' || typeof id !== 'string') return null;
    return { sort, id };
  } catch {
    return null;
  }
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export function paginate<T>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => CursorPayload,
): Paginated<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(toCursor(last)) : null,
  };
}
