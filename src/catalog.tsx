import { useState } from 'react';
import { Dumbbell, Search } from 'lucide-react';
import { Empty, Status, useResource } from './components';
import { Api, type CatalogItem } from './model';

function searchText(value: string) {
  return value.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
}

export function Catalog({ api }: { api: Api }) {
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const items = useResource<CatalogItem[]>(api, '/catalog/exercises', revision);
  const reload = () => setRevision((v) => v + 1);
  const term = searchText(query);
  const visible = items.data?.filter((item) => searchText(item.name).includes(term) || searchText(item.description ?? '').includes(term));
  return (
    <main className="catalogpage">
      <div className="sectionhead workspaceheading">
        <h1>Упражнения</h1>
      </div>
      {!items.data ? (
        <Status error={items.error} retry={reload} />
      ) : items.data.length === 0 ? (
        <Empty title="Упражнений пока нет">
          <p>Здесь появятся упражнения, опубликованные администратором.</p>
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
          </li>
        ))}</ul> : <Empty title="Упражнения не найдены"><button className="soft" onClick={() => setQuery('')}>Сбросить поиск</button></Empty>}
        </>
      )}
    </main>
  );
}
