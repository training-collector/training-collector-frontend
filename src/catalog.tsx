import { useState } from 'react';
import { ChevronRight, Dumbbell, Search } from 'lucide-react';
import { Empty, Status, useResource } from './components';
import { Api, type CatalogItem, type MuscleGroup } from './model';

function searchText(value: string) {
  return value.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
}

function Exercises({ items }: { items: CatalogItem[] }) {
  return <ul className="cataloglist">{items.map(item => <li key={item.id}>
    <Dumbbell size={17} aria-hidden="true" />
    <div className="exercise-details"><strong>{item.name}</strong>{item.description && <p>{item.description}</p>}</div>
  </li>)}</ul>;
}

export function Catalog({ api, groupId }: { api: Api; groupId: number | null }) {
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const groups = useResource<MuscleGroup[]>(api, '/catalog/muscle-groups', revision);
  const items = useResource<CatalogItem[]>(api, groupId === null ? '/catalog/exercises' : '/catalog/muscle-groups/' + groupId + '/exercises', revision);
  const group = groups.data?.find(g => g.id === groupId);
  const term = searchText(query);
  const matches = items.data?.filter(item => searchText(item.name).includes(term) || searchText(item.description ?? '').includes(term)) ?? [];
  const matchesByGroup = new Map<number, CatalogItem[]>();
  for (const item of matches) {
    const list = matchesByGroup.get(item.muscleGroupId);
    if (list) list.push(item);
    else matchesByGroup.set(item.muscleGroupId, [item]);
  }
  const visibleGroups = groups.data?.filter(g => searchText(g.name).includes(term) || matchesByGroup.has(g.id)) ?? [];
  const retry = () => setRevision(n => n + 1);
  const noResults = <Empty title="Ничего не найдено"><button className="soft" onClick={() => setQuery('')}>Сбросить поиск</button></Empty>;
  return <main className="catalogpage">
    {groupId !== null && <nav className="crumb" aria-label="Путь по каталогу"><a href="#exercises">Упражнения</a>
      {group && <><span aria-hidden="true">/</span><span aria-current="page">{group.name}</span></>}
    </nav>}
    <div className="sectionhead workspaceheading"><h1>{group?.name ?? 'Упражнения'}</h1></div>
    {!groups.data || !items.data ? <Status error={groups.error || items.error} retry={retry} />
      : groupId !== null && !group ? <Empty title="Категория не найдена"><a href="#exercises">К категориям</a></Empty>
      : groups.data.length === 0 ? <Empty title="Категорий упражнений пока нет" />
      : <>
        <div className="directory-filters">
          <label className="search"><Search size={17} aria-hidden="true" />
            <input type="search" aria-label="Поиск упражнений" placeholder={group ? 'Поиск по названию или описанию' : 'Поиск по категориям и упражнениям'}
              value={query} onChange={e => setQuery(e.target.value)} />
          </label>
        </div>
        {group ? (matches.length ? <Exercises items={matches} /> : term ? noResults : <Empty title="В категории пока нет упражнений" />)
          : !visibleGroups.length ? noResults : term ? visibleGroups.map(g => <section key={g.id} className="catalog-group">
              <h2><a href={'#exercises/' + g.id}>{g.name}</a></h2>
              {matchesByGroup.has(g.id) && <Exercises items={matchesByGroup.get(g.id)!} />}
            </section>) : <nav className="directory-list" aria-label="Группы мышц">
              {visibleGroups.map(g => <a key={g.id} href={'#exercises/' + g.id}>{g.name}<ChevronRight size={18} aria-hidden="true" /></a>)}
            </nav>}
      </>}
  </main>;
}
