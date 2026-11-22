import { useState, type FormEvent } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Copy,
  Dumbbell,
  ListFilter,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Dialog, Empty, Form, Notice, Status, useResource } from './components';
import { Api, dateLabel, text, type Detail, type SavedSet, type Session } from './model';
import { readSession, readSet, SessionFields, SetFields, WorkoutForm } from './workout-form';

type Edit =
  | { kind: 'session'; value: Session }
  | { kind: 'copy'; detail: Detail }
  | { kind: 'addExercise'; id: number }
  | { kind: 'set'; exerciseId: number; value?: SavedSet }
  | { kind: 'delete'; path: string; name: string }
  | { kind: 'create' };

export function Workouts({ api, clientId }: { api: Api; clientId: number }) {
  const [rev, setRev] = useState(0),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState(false);
  const [open, setOpen] = useState<number | null>(null),
    [edit, setEdit] = useState<Edit | null>(null);
  const [filterError, setFilterError] = useState('');
  const rows = useResource<Session[]>(api, '/clients/' + clientId + '/workouts' + query, rev);
  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget),
      from = text(d, 'from'),
      to = text(d, 'to'),
      exercise = text(d, 'exercise');
    if (from && to && from > to) {
      setFilterError('Дата начала должна быть раньше даты окончания.');
      return;
    }
    setFilterError('');
    const p = new URLSearchParams();
    if (from) p.set('from', new Date(from + 'T00:00:00').toISOString());
    if (to) {
      const end = new Date(to + 'T00:00:00');
      end.setDate(end.getDate() + 1);
      p.set('to', end.toISOString());
    }
    if (exercise) p.set('exercise', exercise);
    setQuery(p.size ? '?' + p.toString() : '');
  }
  function saved(id?: number, reset = false) {
    setEdit(null);
    if (reset) {
      setQuery('');
      setFilter(false);
    }
    if (id !== undefined) setOpen(id);
    setRev((v) => v + 1);
  }
  const title =
    edit?.kind === 'delete'
      ? 'Подтвердить удаление'
      : edit?.kind === 'session'
        ? 'Параметры тренировки'
        : edit?.kind === 'addExercise'
          ? 'Добавить упражнение'
          : edit?.kind === 'set'
            ? edit.value
              ? 'Исправить подход'
              : 'Добавить подход'
            : edit?.kind === 'copy'
              ? 'Повторить тренировку'
              : 'Новая тренировка';
  return (
    <section className="section">
      <div className="sectionhead">
        <h2>История тренировок</h2>
        <button className="primary" onClick={() => setEdit({ kind: 'create' })}>
          <Plus size={17} /> Записать тренировку
        </button>
      </div>
      <div className="filters">
        <button className="soft" aria-expanded={filter} onClick={() => setFilter(!filter)}>
          <ListFilter size={16} /> Фильтры{query ? ' · применены' : ''}
        </button>
        <form hidden={!filter} onSubmit={apply}>
          <div className="fields filtersgrid">
            <label>
              С даты
              <input type="date" name="from" />
            </label>
            <label>
              По дату
              <input type="date" name="to" />
            </label>
            <label>
              Упражнение
              <input name="exercise" placeholder="Часть названия" />
            </label>
          </div>
          <div className="actions">
            <button className="soft">Применить</button>
            <button
              type="reset"
              className="plain"
              onClick={() => {
                setQuery('');
                setFilterError('');
              }}
            >
              Сбросить
            </button>
          </div>
          {filterError && <Notice>{filterError}</Notice>}
        </form>
      </div>
      {!rows.data ? (
        <Status error={rows.error} retry={() => setRev((v) => v + 1)} />
      ) : rows.data.length === 0 ? (
        <Empty title={query ? 'Нет тренировок по этим фильтрам' : 'Тренировок пока нет'}>
          <p>
            {query
              ? 'Измените период или название упражнения.'
              : 'Запишите занятие, чтобы увидеть упражнения и результаты подходов.'}
          </p>
        </Empty>
      ) : (
        <div className="records">
          {rows.data.map((s) => (
            <article className="record" key={s.id}>
              <button
                className="recordtoggle"
                aria-expanded={open === s.id}
                onClick={() => setOpen(open === s.id ? null : s.id)}
              >
                <span className="recordicon">
                  <Dumbbell size={20} />
                </span>
                <span className="recordtitle">
                  <strong>{dateLabel(s.performedAt)}</strong>
                  <small>
                    <CalendarDays size={13} />
                    {new Date(s.performedAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {s.durationMin != null && (
                      <>
                        <Clock3 size={13} />
                        {s.durationMin} мин
                      </>
                    )}
                  </small>
                </span>
                <ChevronDown size={18} className={open === s.id ? 'up' : ''} />
              </button>
              {open === s.id && <WorkoutDetail api={api} id={s.id} revision={rev} edit={setEdit} />}
            </article>
          ))}
        </div>
      )}
      {edit && (
        <Dialog title={title} close={() => setEdit(null)}>
          {(edit.kind === 'create' || edit.kind === 'copy' || edit.kind === 'addExercise') && (
            <WorkoutForm
              api={api}
              clientId={clientId}
              workoutId={edit.kind === 'addExercise' ? edit.id : undefined}
              copy={edit.kind === 'copy' ? edit.detail : undefined}
              done={(id) => saved(id, edit.kind !== 'addExercise')}
            />
          )}
          {edit.kind === 'session' && (
            <Form
              submit={async (d) => {
                await api.request('/workouts/' + edit.value.id, 'PUT', readSession(d));
                saved();
              }}
            >
              <SessionFields initial={edit.value} />
            </Form>
          )}
          {edit.kind === 'set' && (
            <Form
              label="Сохранить подход"
              submit={async (d) => {
                await api.request(
                  edit.value ? '/sets/' + edit.value.id : '/exercises/' + edit.exerciseId + '/sets',
                  edit.value ? 'PUT' : 'POST',
                  readSet(d, 'set'),
                );
                saved();
              }}
            >
              <SetFields prefix="set" initial={edit.value} />
            </Form>
          )}
          {edit.kind === 'delete' && (
            <Form
              danger
              label="Удалить"
              submit={async () => {
                await api.request(edit.path, 'DELETE');
                saved();
              }}
            >
              <p>Удалить {edit.name}?</p>
            </Form>
          )}
        </Dialog>
      )}
    </section>
  );
}
function WorkoutDetail({
  api,
  id,
  revision,
  edit,
}: {
  api: Api;
  id: number;
  revision: number;
  edit: (e: Edit) => void;
}) {
  const [retry, setRetry] = useState(0);
  const r = useResource<Detail>(api, '/workouts/' + id, revision + retry);
  if (!r.data) return <Status error={r.error} retry={() => setRetry((n) => n + 1)} />;
  const detail = r.data;
  return (
    <div className="recordbody">
      {detail.session.note && <p>{detail.session.note}</p>}
      <div className="actions">
        <button className="soft" onClick={() => edit({ kind: 'copy', detail })}>
          <Copy size={14} /> Повторить
        </button>
        <button className="soft" onClick={() => edit({ kind: 'session', value: detail.session })}>
          <Pencil size={14} /> Дата и заметка
        </button>
      </div>
      {detail.exercises.map(({ exercise, sets }) => (
        <section key={exercise.id} className="savedexercise">
          <header className="row-between">
            <h3>{exercise.exerciseName}</h3>
            <button
              className="iconbtn"
              aria-label={'Удалить упражнение ' + exercise.exerciseName}
              onClick={() =>
                edit({
                  kind: 'delete',
                  path: '/exercises/' + exercise.id,
                  name: 'упражнение «' + exercise.exerciseName + '» вместе с подходами',
                })
              }
            >
              <Trash2 size={15} />
            </button>
          </header>
          {exercise.note && <p className="muted">{exercise.note}</p>}
          {sets.map((s) => (
            <div className="resultrow" key={s.id}>
              <span className="setno">{s.setNumber}</span>
              <div>
                <strong>
                  {s.reps != null ? s.reps + ' повт.' : s.durationSec + ' с'}
                  {s.weightKg != null ? ' · ' + s.weightKg + ' кг' : ''}
                </strong>
                <small>
                  {[s.restSec != null ? 'Отдых ' + s.restSec + ' с' : '', s.rpe != null ? 'RPE ' + s.rpe : '']
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </div>
              <button
                className="iconbtn"
                aria-label={'Изменить подход ' + s.setNumber}
                onClick={() => edit({ kind: 'set', exerciseId: exercise.id, value: s })}
              >
                <Pencil size={15} />
              </button>
              <button
                className="iconbtn"
                aria-label={'Удалить подход ' + s.setNumber}
                onClick={() => edit({ kind: 'delete', path: '/sets/' + s.id, name: 'подход ' + s.setNumber })}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button className="plain" onClick={() => edit({ kind: 'set', exerciseId: exercise.id })}>
            <Plus size={14} /> Добавить подход
          </button>
        </section>
      ))}
      <div className="actions">
        <button className="soft" onClick={() => edit({ kind: 'addExercise', id })}>
          <Plus size={15} /> Добавить упражнение
        </button>
        <button
          className="textdanger"
          onClick={() =>
            edit({ kind: 'delete', path: '/workouts/' + id, name: 'тренировку вместе с упражнениями' })
          }
        >
          Удалить тренировку
        </button>
      </div>
    </div>
  );
}
