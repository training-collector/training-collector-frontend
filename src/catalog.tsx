import { useState } from 'react';
import { Dumbbell, Pencil, Plus, Search } from 'lucide-react';
import { Dialog, Empty, Form, Status, useResource } from './components';
import { Api, text, type CatalogItem } from './model';

export function CatalogExerciseForm({ api, item, onSaved }: { api: Api; item?: CatalogItem; onSaved: () => void }) {
  return (
    <Form label={item ? 'Сохранить изменения' : 'Добавить в мой список'} submit={async (d) => {
      const name = text(d, 'name');
      if (!name) throw new Error('Введите название упражнения.');
      await api.request(item ? '/catalog/exercises/' + item.id : '/catalog/exercises', item ? 'PUT' : 'POST', {
        name, description: text(d, 'description') || null,
      });
      onSaved();
    }}>
      <label>
        Название упражнения
        <input name="name" required maxLength={255} defaultValue={item?.name} />
      </label>
      <label>
        Описание <small>необязательно</small>
        <textarea name="description" rows={3} defaultValue={item?.description ?? ''} />
      </label>
      {item && <p className="muted">Новое название появится и в записанных тренировках.</p>}
    </Form>
  );
}

function searchText(value: string) {
  return value.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
}

export function Catalog({ api }: { api: Api }) {
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const items = useResource<CatalogItem[]>(api, '/catalog/exercises', revision);
  const reload = () => setRevision((v) => v + 1);
  const term = searchText(query);
  const visible = items.data?.filter((item) => searchText(item.name).includes(term) || searchText(item.description ?? '').includes(term));
  const addButton = <button className="primary" onClick={() => setEditing('new')}>
    <Plus size={17} /> Добавить упражнение
  </button>;
  return (
    <main className="catalogpage">
      <div className="sectionhead workspaceheading">
        <h1>Мои упражнения</h1>
        {!!items.data?.length && addButton}
      </div>
      {!items.data ? (
        <Status error={items.error} retry={reload} />
      ) : items.data.length === 0 ? (
        <Empty title="Упражнений пока нет">
          <p>Добавьте своё упражнение, чтобы выбирать его в тренировках любого подопечного.</p>
          {addButton}
        </Empty>
      ) : (
        <>
        <div className="directory-filters">
          <label className="search">
            <Search size={17} aria-hidden="true" />
            <input type="search" aria-label="Поиск упражнений" placeholder="Поиск по названию или описанию"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
        {visible?.length ? <ul className="cataloglist">{visible.map((item) => (
          <li key={item.id}>
            <Dumbbell size={17} aria-hidden="true" />
            <div className="exercise-details">
              <strong>{item.name}</strong>
              {item.description && <p>{item.description}</p>}
            </div>
            <button className="soft" onClick={() => setEditing(item)} aria-label={'Изменить упражнение «' + item.name + '»'}>
              <Pencil size={15} aria-hidden="true" /> Изменить
            </button>
          </li>
        ))}</ul> : <Empty title="Упражнения не найдены"><button className="soft" onClick={() => setQuery('')}>Сбросить поиск</button></Empty>}
        </>
      )}
      {editing && (
        <Dialog title={editing === 'new' ? 'Новое упражнение' : 'Изменить упражнение'} close={() => setEditing(null)}>
          <CatalogExerciseForm api={api} item={editing === 'new' ? undefined : editing} onSaved={() => { setEditing(null); setQuery(''); reload(); }} />
        </Dialog>
      )}
    </main>
  );
}
