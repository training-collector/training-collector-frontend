import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Form, Status, useResource } from './components';
import {
  Api,
  localDateTime,
  number,
  text,
  type CatalogItem,
  type MuscleGroup,
  type Detail,
  type Exercise,
  type Result,
  type Session,
} from './model';

let nextKey = 0;
const newKey = () => String(++nextKey);
export function SetFields({ prefix, initial }: { prefix: string; initial?: Result }) {
  const [type, setType] = useState(initial?.durationSec != null ? 'durationSec' : 'reps');
  const read = (key: keyof Result) => initial?.[key] ?? '';
  return (
    <div className="setfields">
      <label>
        Метрика
        <select name={prefix + 'metric'} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="reps">Повторы</option>
          <option value="durationSec">Время</option>
        </select>
      </label>
      <label>
        {type === 'reps' ? 'Повторения' : 'Время, с'}
        <input
          key={type}
          name={prefix + 'value'}
          type="number"
          min="1"
          max="2147483647"
          required
          defaultValue={read(type === 'reps' ? 'reps' : 'durationSec')}
        />
      </label>
      <label>
        Вес, кг
        <input
          name={prefix + 'weightKg'}
          type="number"
          step=".01"
          min="0"
          max="9999.99"
          defaultValue={read('weightKg')}
        />
      </label>
      <label>
        Отдых, с
        <input
          name={prefix + 'restSec'}
          type="number"
          min="0"
          max="2147483647"
          defaultValue={read('restSec')}
        />
      </label>
      <label>
        RPE
        <input name={prefix + 'rpe'} type="number" step=".1" min="0" max="10" defaultValue={read('rpe')} />
      </label>
    </div>
  );
}
export function readSet(d: FormData, prefix: string): Result {
  const reps = text(d, prefix + 'metric') === 'reps';
  return {
    reps: reps ? number(d, prefix + 'value') : null,
    durationSec: reps ? null : number(d, prefix + 'value'),
    weightKg: number(d, prefix + 'weightKg'),
    restSec: number(d, prefix + 'restSec'),
    rpe: number(d, prefix + 'rpe'),
  };
}
function ExerciseFields({
  catalog,
  groups,
  prefix,
  index,
  initial,
  remove,
}: {
  catalog: CatalogItem[];
  groups: MuscleGroup[];
  prefix: string;
  index: number;
  initial?: Exercise;
  remove?: () => void;
}) {
  const savedInitial = catalog.find((item) => item.id === initial?.exerciseCatalogId)
    ?? catalog.find((item) => item.name.toLowerCase() === initial?.exerciseName.toLowerCase());
  const [sets, setSets] = useState(() =>
    (initial?.sets.length ? initial.sets : [undefined]).map((value) => ({ id: newKey(), value })),
  );
  return (
    <section className="exercisebox">
      <header className="row-between">
        <h3>Упражнение {index + 1}</h3>
        {remove && (
          <button
            className="iconbtn"
            aria-label={'Убрать упражнение ' + (index + 1)}
            type="button"
            onClick={remove}
          >
            <X size={16} />
          </button>
        )}
      </header>
      <input type="hidden" name="exerciseKeys" value={prefix} />
      <label>
        Из справочника
        <select name={prefix + 'choice'} defaultValue={savedInitial?.id ?? ''} required>
          <option value="" disabled>Выберите упражнение</option>
          {groups.map(group => {
            const choices = catalog.filter(item => item.muscleGroupId === group.id);
            return choices.length > 0 && <optgroup key={group.id} label={group.name}>
              {choices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </optgroup>;
          })}
        </select>
      </label>
      <label>
        Заметка к упражнению
        <input name={prefix + 'note'} defaultValue={initial?.note || ''} />
      </label>
      {sets.map((set, i) => (
        <div className="setbox" key={set.id}>
          <div className="row-between">
            <strong>Подход {i + 1}</strong>
            {sets.length > 1 && (
              <button
                className="iconbtn"
                aria-label={'Убрать подход ' + (i + 1)}
                type="button"
                onClick={() => setSets((items) => items.filter((x) => x.id !== set.id))}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <input type="hidden" name={prefix + 'setKeys'} value={set.id} />
          <SetFields prefix={prefix + '.' + set.id} initial={set.value} />
        </div>
      ))}
      <button
        className="soft"
        type="button"
        onClick={() => setSets((items) => [...items, { id: newKey(), value: undefined }])}
      >
        <Plus size={15} /> Подход
      </button>
    </section>
  );
}
function readExercises(d: FormData) {
  return d.getAll('exerciseKeys').map((key) => {
    const p = String(key);
    return {
      exerciseCatalogId: Number(text(d, p + 'choice')),
      note: text(d, p + 'note') || null,
      sets: d.getAll(p + 'setKeys').map((s) => readSet(d, p + '.' + s)),
    };
  });
}
export function SessionFields({ initial }: { initial?: Session }) {
  return (
    <>
      <div className="fields two">
        <label>
          Дата и время
          <input
            type="datetime-local"
            name="performedAt"
            defaultValue={localDateTime(initial ? new Date(initial.performedAt) : new Date())}
            required
          />
        </label>
        <label>
          Длительность, мин
          <input
            name="durationMin"
            type="number"
            min="1"
            max="2147483647"
            defaultValue={initial?.durationMin ?? ''}
          />
        </label>
      </div>
      <label>
        Заметка к тренировке
        <textarea name="note" rows={2} defaultValue={initial?.note || ''} />
      </label>
    </>
  );
}
export function readSession(d: FormData) {
  return {
    performedAt: new Date(text(d, 'performedAt')).toISOString(),
    durationMin: number(d, 'durationMin'),
    note: text(d, 'note') || null,
  };
}
export function WorkoutForm({
  api,
  clientId,
  copy,
  workoutId,
  done,
}: {
  api: Api;
  clientId: number;
  copy?: Detail;
  workoutId?: number;
  done: (id: number) => void;
}) {
  const [rev, setRev] = useState(0);
  const catalog = useResource<CatalogItem[]>(api, '/catalog/exercises', rev);
  const groups = useResource<MuscleGroup[]>(api, '/catalog/muscle-groups', rev);
  const [exercises, setExercises] = useState(() =>
    (copy?.exercises.length ? copy.exercises.map((x) => ({ ...x.exercise, sets: x.sets })) : [undefined]).map(
      (value) => ({ key: newKey(), value }),
    ),
  );
  const reload = () => setRev((n) => n + 1);
  if (!catalog.data || !groups.data) return <Status error={catalog.error || groups.error} retry={reload} />;
  if (!catalog.data.length) return <p>Администратор ещё не опубликовал упражнения для тренировок.</p>;
  const addOnly = workoutId !== undefined;
  return (
    <Form
      label={addOnly ? 'Сохранить упражнение' : 'Сохранить тренировку'}
      submit={async (d) => {
        const items = readExercises(d);
        if (workoutId !== undefined) {
          await api.request('/workouts/' + workoutId + '/exercises', 'POST', items[0]);
          done(workoutId);
        } else {
          const saved = await api.request<Detail>('/clients/' + clientId + '/workouts', 'POST', {
            ...readSession(d),
            exercises: items,
          });
          done(saved.session.id);
        }
      }}
    >
      {!addOnly && <SessionFields />}
      {exercises.map((ex, i) => (
        <ExerciseFields
          key={ex.key}
          catalog={catalog.data!}
          groups={groups.data!}
          index={i}
          prefix={'e' + ex.key}
          initial={ex.value}
          remove={
            exercises.length > 1
              ? () => setExercises((list) => list.filter((x) => x.key !== ex.key))
              : undefined
          }
        />
      ))}
      {!addOnly && (
        <button
          className="soft"
          type="button"
          onClick={() => setExercises((items) => [...items, { key: newKey(), value: undefined }])}
        >
          <Plus size={16} /> Ещё упражнение
        </button>
      )}
    </Form>
  );
}
