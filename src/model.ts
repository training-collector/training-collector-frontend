interface Person {
  id: number;
  fullName: string;
}
export interface Trainer extends Person {
  phone: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  telegramLinkedAt: string | null;
  approvedAt: string | null;
  trainingBotLinkedAt: string | null;
  signupTelegramInUse: boolean;
}
export interface Client extends Person {
  firstName: string;
  lastName: string | null;
  goal: string | null;
  notes: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
}
export interface MuscleGroup {
  id: number;
  name: string;
}
export interface CatalogItem extends MuscleGroup {
  muscleGroupId: number;
  description: string | null;
}
export interface Result {
  reps: number | null;
  durationSec: number | null;
  weightKg: number | null;
  restSec: number | null;
  rpe: number | null;
}
export interface SavedSet extends Result {
  id: number;
  setNumber: number;
}
export interface Exercise {
  exerciseCatalogId: number | null;
  exerciseName: string;
  note: string | null;
  sets: Result[];
}
export interface Session {
  id: number;
  performedAt: string;
  durationMin: number | null;
  note: string | null;
}
export interface Detail {
  session: Session;
  exercises: { exercise: Omit<Exercise, 'sets'> & { id: number }; sets: SavedSet[] }[];
}
export const metrics = {
  heightCm: ['Рост', 'см'],
  weightKg: ['Вес', 'кг'],
  bodyFatPct: ['Доля жира', '%'],
  backWidthCm: ['Ширина спины', 'см'],
  rightBicepsCm: ['Обхват правой руки', 'см'],
  leftBicepsCm: ['Обхват левой руки', 'см'],
  rightForearmCm: ['Обхват правого предплечья', 'см'],
  leftForearmCm: ['Обхват левого предплечья', 'см'],
  rightThighCm: ['Обхват правого бедра', 'см'],
  leftThighCm: ['Обхват левого бедра', 'см'],
  rightCalfCm: ['Обхват правой голени', 'см'],
  leftCalfCm: ['Обхват левой голени', 'см'],
  bicepsCm: ['Обхват руки без указания стороны', 'см'],
  waistCm: ['Обхват талии', 'см'],
  chestCm: ['Обхват груди', 'см'],
  hipsCm: ['Обхват ягодиц', 'см'],
  thighCm: ['Обхват бедра без указания стороны', 'см'],
  calfCm: ['Обхват голени без указания стороны', 'см'],
} as const;
export type Metric = keyof typeof metrics;
export const metricKeys = Object.keys(metrics) as Metric[];
export type Measurement = { id: number; measuredOn: string; note: string | null } & Record<
  Metric,
  number | null
>;
export type Current = Partial<Record<Metric, { value: number; measuredOn: string }>>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class Api {
  constructor(
    readonly token = '',
    private unauthorized?: () => void,
  ) {}
  async request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    const headers = new Headers();
    if (this.token) headers.set('Authorization', 'Bearer ' + this.token);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    const res = await fetch('/api/v1' + path, {
      method,
      headers,
      body: JSON.stringify(body),
      signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 401) this.unauthorized?.();
      const message = (await res.json().catch(() => null))?.error;
      throw new ApiError(
        res.status,
        message ||
          (res.status === 401
            ? 'Сессия завершена. Войдите снова по коду из Telegram.'
            : 'Не удалось выполнить запрос (' + res.status + ').'),
      );
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }
}

export const errorText = (error: unknown) =>
  error instanceof TypeError
    ? 'Не удалось связаться с сервером. Проверьте подключение.'
    : error instanceof Error
      ? error.message
      : 'Ошибка запроса.';
export const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
export const number = (data: FormData, key: string) => (text(data, key) ? Number(text(data, key)) : null);
export function localDateTime(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export const dateLabel = (
  s: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
) => new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('ru-RU', options);
export const initials = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
