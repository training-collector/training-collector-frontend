import { useState } from 'react';
import { MeasurementFields } from './measurement-fields';
import { Pencil, Plus, Ruler, Trash2 } from 'lucide-react';
import { Dialog, Empty, Form, Status, useResource } from './components';
import {
  Api,
  dateLabel,
  localDateTime,
  metricKeys,
  metrics,
  number,
  text,
  type Current,
  type Measurement,
} from './model';

type Action = { kind: 'create' } | { kind: 'edit' | 'delete'; value: Measurement };

/** The latest value of every metric. The history comes newest first. */
function latest(history: Measurement[]): Current {
  const result: Current = {};
  for (const row of history)
    for (const key of metricKeys) {
      const value = row[key];
      if (value != null && !result[key]) result[key] = { value, measuredOn: row.measuredOn };
    }
  return result;
}

export function Measurements({ api, clientId }: { api: Api; clientId: number }) {
  const [version, setVersion] = useState(0),
    [action, setAction] = useState<Action | null>(null);
  const path = '/clients/' + clientId + '/measurements';
  const history = useResource<Measurement[]>(api, path, version);
  const current = history.data && latest(history.data);
  const refresh = () => setVersion((v) => v + 1);
  const done = () => {
    setAction(null);
    refresh();
  };
  return (
    <section className="section">
      <div className="sectionhead">
        <h2>Актуальные замеры</h2>
        <button className="primary" onClick={() => setAction({ kind: 'create' })}>
          <Plus size={17} /> Добавить замер
        </button>
      </div>
      {!current ? (
        <Status error={history.error} retry={refresh} />
      ) : Object.keys(current).length === 0 ? (
        <Empty title="Показателей пока нет">
          <p>Добавьте рост, вес или любой из обхватов подопечного.</p>
        </Empty>
      ) : (
        <div className="metricgrid">
          {metricKeys.map((k) => {
            const m = current[k];
            return (
              m && (
                <div className="metric" key={k}>
                  <span>{metrics[k][0]}</span>
                  <strong>
                    {m.value.toLocaleString('ru-RU')} <small>{metrics[k][1]}</small>
                  </strong>
                  <time dateTime={m.measuredOn}>{dateLabel(m.measuredOn)}</time>
                </div>
              )
            );
          })}
        </div>
      )}
      <div className="sectionhead subhead">
        <h2>История замеров</h2>
      </div>
      {!history.data ? (
        <Status error={history.error} retry={refresh} />
      ) : history.data.length === 0 ? (
        <p className="muted">Записей пока нет.</p>
      ) : (
        <div className="records">
          {history.data.map((row) => (
            <article key={row.id} className="record measure">
              <header className="row-between">
                <h3>
                  <Ruler size={17} /> {dateLabel(row.measuredOn)}
                </h3>
                <div className="actions">
                  <button
                    className="iconbtn"
                    aria-label="Изменить замер"
                    onClick={() => setAction({ kind: 'edit', value: row })}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="iconbtn"
                    aria-label="Удалить замер"
                    onClick={() => setAction({ kind: 'delete', value: row })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </header>
              <dl className="measurevalues">
                {metricKeys
                  .filter((k) => row[k] != null)
                  .map((k) => (
                    <div key={k}>
                      <dt>{metrics[k][0]}</dt>
                      <dd>
                        {row[k]?.toLocaleString('ru-RU')} {metrics[k][1]}
                      </dd>
                    </div>
                  ))}
              </dl>
              {row.note && <p>{row.note}</p>}
            </article>
          ))}
        </div>
      )}
      {action && (
        <Dialog
          title={
            action.kind === 'delete'
              ? 'Удалить замер?'
              : action.kind === 'edit'
                ? 'Изменить замер'
                : 'Новый замер'
          }
          close={() => setAction(null)}
        >
          {action.kind === 'delete' ? (
            <Form
              danger
              label="Удалить"
              submit={async () => {
                await api.request('/measurements/' + action.value.id, 'DELETE');
                done();
              }}
            >
              <p>Удалить запись за {dateLabel(action.value.measuredOn)}?</p>
            </Form>
          ) : (
            <Form
              label="Сохранить замер"
              submit={async (d) => {
                const values = Object.fromEntries(metricKeys.map((k) => [k, number(d, k)]));
                if (!Object.values(values).some((v) => v !== null) && !text(d, 'note'))
                  throw new Error('Укажите хотя бы один показатель или заметку.');
                await api.request(
                  action.kind === 'edit' ? '/measurements/' + action.value.id : path,
                  action.kind === 'edit' ? 'PUT' : 'POST',
                  { measuredOn: text(d, 'date'), note: text(d, 'note') || null, ...values },
                );
                done();
              }}
            >
              <label>
                Дата замера
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={
                    action.kind === 'edit' ? action.value.measuredOn : localDateTime().slice(0, 10)
                  }
                />
              </label>
              <MeasurementFields initial={action.kind === 'edit' ? action.value : undefined} />
              <label>
                Заметка
                <textarea
                  name="note"
                  rows={2}
                  defaultValue={action.kind === 'edit' ? action.value.note || '' : ''}
                />
              </label>
            </Form>
          )}
        </Dialog>
      )}
    </section>
  );
}
