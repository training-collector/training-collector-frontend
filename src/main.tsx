import { useMemo, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive,
  BookOpen,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  LogOut,
  Pencil,
  Plus,
  Ruler,
  Search,
  UsersRound,
} from 'lucide-react';
import { Auth, CodeLogin, ProfileBotLinks } from './auth';
import { Catalog } from './catalog';
import { Api, errorText, goals, initials, text, type Client, type Trainer } from './model';
import { Brand, Dialog, Empty, Form, Notice, Status, useResource } from './components';
import { Workouts } from './workouts';
import { Measurements } from './measurements';
import './style.css';

const tokenKey = 'training-collector.token';
function App() {
  const [sessionExpired, setSessionExpired] = useState(false);
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem(tokenKey) || '';
    if (stored.startsWith('session.') || stored.startsWith('signup.')) return stored;
    if (stored) localStorage.removeItem(tokenKey);
    return '';
  });
  const [logoutError, setLogoutError] = useState('');
  function logout(expired = false) {
    if (localStorage.getItem(tokenKey) === token) localStorage.removeItem(tokenKey);
    setToken('');
    setSessionExpired(expired);
    setLogoutError('');
  }
  const api = useMemo(() => new Api(token, () => logout(true)), [token]);
  function enter(value: string) {
    localStorage.setItem(tokenKey, value);
    setToken(value);
  }
  async function signOut() {
    try {
      if (token.startsWith('session.') || token.startsWith('signup.')) await api.request('/auth/logout', 'POST');
      logout();
    } catch (error) { setLogoutError(errorText(error)); }
  }
  return token ? (
    <>
      {logoutError && <Notice>{logoutError}</Notice>}
      <Account key={token} api={api} logout={signOut} enter={enter} />
    </>
  ) : (
    <Auth sessionExpired={sessionExpired} enter={enter} />
  );
}

interface AccountProps { api: Api; logout: () => void; enter: (token: string) => void }

function Account(props: AccountProps) {
  const [rev, setRev] = useState(0);
  const [verified, setVerified] = useState<Trainer>();
  const me = useResource<Trainer>(props.api, '/trainers/me', rev);
  const profile = verified || me.data;
  if (!profile) return <Status error={me.error} retry={() => setRev((n) => n + 1)} />;
  if (props.api.token.startsWith('signup.') || !profile.telegramLinkedAt) {
    return <CodeLogin username={profile.username || profile.fullName}
      signup={{ api: props.api, profile, onProfile: setVerified }}
      enter={props.enter} back={props.logout} />;
  }
  if (!profile.approvedAt) return <div className="authinner"><p>Регистрация ожидает одобрения.</p>
    <button className="plain" onClick={() => props.logout()}>Выйти</button></div>;
  return <Workspace {...props} profile={profile} onProfile={setVerified} />;
}

function subscribeToRoute(change: () => void) {
  window.addEventListener('hashchange', change);
  return () => window.removeEventListener('hashchange', change);
}

function ClientBreadcrumbs({ name }: { name?: string }) {
  return <nav className="crumb" aria-label="Путь по кабинету">
    <a href="#clients"><BookOpen size={16} aria-hidden="true" /> Журнал тренера</a>
    <span aria-hidden="true">/</span>
    {name ? <>
      <a href="#clients">Подопечные</a>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{name}</span>
    </> : <span aria-current="page">Подопечные</span>}
  </nav>;
}

function Workspace({ api, logout, profile, onProfile }: AccountProps & { profile: Trainer; onProfile: (me: Trainer) => void }) {
  const hash = useSyncExternalStore(subscribeToRoute, () => window.location.hash);
  const exercises = hash === '#exercises';
  const match = /^#clients\/([1-9]\d*)$/.exec(hash);
  const clientId = match && Number.isSafeInteger(Number(match[1])) ? Number(match[1]) : null;
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState(''),
    [archived, setArchived] = useState(false);
  const [modal, setModal] = useState<'client' | 'account' | null>(null);
  const list = useResource<Client[]>(api, '/clients?includeArchived=' + archived, version);
  const shown = list.data?.filter((c) =>
    c.fullName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const refresh = () => setVersion((n) => n + 1);
  const close = () => setModal(null);
  const filters = <>
    <label className="search">
      <Search size={17} />
      <input type="search" aria-label="Поиск подопечного" placeholder="Поиск по имени"
        value={query} onChange={(e) => setQuery(e.target.value)} />
    </label>
    <label className="check">
      <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
      Включая архив
    </label>
  </>;
  const clients = !shown ? <Status error={list.error} retry={refresh} />
    : shown.length ? (
      <nav className={clientId ? 'clientlist' : 'directory-list'} aria-label="Список подопечных">
        {shown.map((c) => (
          <a key={c.id} href={'#clients/' + c.id} aria-current={c.id === clientId ? 'page' : undefined}>
            <span className={'avatar tone' + (c.id % 3)} aria-hidden="true">{initials(c.fullName)}</span>
            <span className="client-name">{c.fullName}
              {!clientId && c.goal && <small>{goals[c.goal]}</small>}
              {c.status === 'ARCHIVED' && <small>В архиве</small>}
            </span>
            {!clientId && <ChevronRight size={18} aria-hidden="true" />}
          </a>
        ))}
      </nav>
    ) : clientId ? <p className="muted">{query.trim() ? 'Совпадений нет' : 'Список пуст'}</p>
    : <Empty title={query.trim() ? 'Подопечные не найдены' : 'Подопечных пока нет'}>
        {query.trim() && <button className="soft" onClick={() => setQuery('')}>Сбросить поиск</button>}
      </Empty>;
  return (
    <>
      <header className="top">
        <Brand />
        <nav className="mainnav" aria-label="Кабинет тренера">
          <a href="#clients" aria-current={exercises ? undefined : clientId ? 'location' : 'page'}>
            <UsersRound size={16} /> Подопечные
          </a>
          <a href="#exercises" aria-current={exercises ? 'page' : undefined}>
            <Dumbbell size={16} /> Мои упражнения
          </a>
        </nav>
        <button className="account" aria-label={`Профиль тренера, ${profile.fullName}`} onClick={() => setModal('account')}>
          <span className="avatar small">
            {initials(profile.fullName)}
          </span>
          {profile.fullName}
        </button>
      </header>
      {exercises ? <Catalog api={api} /> : clientId === null ? (
        <main className="catalogpage clients-directory">
          <ClientBreadcrumbs />
          <div className="sectionhead workspaceheading">
            <h1>Подопечные</h1>
            <button className="primary" onClick={() => setModal('client')}>
              <Plus size={17} /> Добавить подопечного
            </button>
          </div>
          <div className="directory-filters">{filters}</div>
          {clients}
        </main>
      ) : <div className="layout">
        <aside className="sidebar">
          <div className="sidehead">
            <h2>
              <UsersRound size={20} /> Подопечные
            </h2>
            <button
              className="iconbtn add"
              aria-label="Добавить подопечного"
              onClick={() => setModal('client')}
            >
              <Plus size={18} />
            </button>
          </div>
          {filters}
          {clients}
        </aside>
        <main className="workarea">
          <ClientWorkspace key={clientId} api={api} id={clientId} version={version} onChange={refresh}
            onDeleted={() => { window.location.hash = 'clients'; refresh(); }} />
        </main>
      </div>}
      {modal === 'client' && (
        <Dialog title="Новый подопечный" close={close}>
          <ClientForm
            api={api}
            done={(c) => {
              window.location.hash = 'clients/' + c.id;
              setQuery('');
              refresh();
              close();
            }}
          />
        </Dialog>
      )}
      {modal === 'account' && (
        <Dialog title="Профиль тренера" close={close}>
          <div className="formstack">
            <div className="identity">
              <span className="avatar">{initials(profile.fullName)}</span>
              <div>
                <strong>{profile.fullName}</strong>
                <small>{profile.username}</small>
                {profile.phone && <small>{profile.phone}</small>}
              </div>
            </div>
            <ProfileBotLinks key={profile.trainingBotLinkedAt ?? 'unlinked'} api={api}
              linked={!!profile.trainingBotLinkedAt} onConnected={onProfile} />
            <button className="soft" onClick={() => logout()}>
              <LogOut size={16} /> Выйти
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function ClientForm({ api, client, done }: { api: Api; client?: Client; done: (c: Client) => void }) {
  return (
    <Form
      label={client ? 'Сохранить карточку' : 'Добавить подопечного'}
      submit={async (d) => {
        done(
          await api.request<Client>(client ? '/clients/' + client.id : '/clients', client ? 'PUT' : 'POST', {
            fullName: text(d, 'name'),
            phone: text(d, 'phone') || null,
            goal: text(d, 'goal') === 'keep' ? client?.goal : text(d, 'goal') || null,
            notes: text(d, 'notes') || null,
          }),
        );
      }}
    >
      <label>
        Имя подопечного
        <input name="name" required maxLength={255} defaultValue={client?.fullName} autoComplete="off" />
      </label>
      <div className="fields two">
        <label>
          Телефон
          <input type="tel" name="phone" maxLength={64} defaultValue={client?.phone ?? ''} />
        </label>
        <label>
          Цель
          <select name="goal" defaultValue={client?.goal === 'REHAB' ? 'keep' : client?.goal ?? ''}>
            <option value="">Не указана</option>
            {client?.goal === 'REHAB' && <option value="keep">Оставить текущую цель</option>}
            {Object.entries(goals).filter(([k]) => k !== 'REHAB').map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Заметки
        <textarea name="notes" rows={3} defaultValue={client?.notes ?? ''} />
      </label>
    </Form>
  );
}

function ClientWorkspace({
  api,
  id,
  version,
  onChange,
  onDeleted,
}: {
  api: Api;
  id: number;
  version: number;
  onChange: () => void;
  onDeleted: () => void;
}) {
  const [tab, setTab] = useState<'workouts' | 'metrics' | 'profile'>('workouts');
  const [action, setAction] = useState<'edit' | 'status' | 'delete' | null>(null);
  const resource = useResource<Client>(api, '/clients/' + id, version);
  const c = resource.data;
  if (!c) return <>
    <nav className="crumb" aria-label="Путь по кабинету"><a href="#clients">К списку подопечных</a></nav>
    <Status error={resource.error} retry={onChange} />
  </>;
  const close = () => setAction(null);
  const done = () => {
    close();
    onChange();
  };
  const isArchived = c.status === 'ARCHIVED';
  return (
    <>
      <div className="workspaceheading">
        <ClientBreadcrumbs name={c.fullName} />
        <div className="row-between">
          <div>
            <h1>{c.fullName}</h1>
            <p className="subtitle">
              {c.goal ? goals[c.goal] : 'Подопечный'}
              {isArchived && ' · В архиве'}
            </p>
          </div>
          <span className="big-avatar">{initials(c.fullName)}</span>
        </div>
      </div>
      <nav className="tabs" aria-label="Разделы подопечного">
        {(
          [
            ['workouts', 'Тренировки', Dumbbell],
            ['metrics', 'Замеры', Ruler],
            ['profile', 'Карточка', ClipboardList],
          ] as const
        ).map(([key, label, Icon]) => (
          <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      {tab === 'workouts' && <Workouts api={api} clientId={id} />}
      {tab === 'metrics' && <Measurements api={api} clientId={id} />}
      {tab === 'profile' && (
        <section className="section">
          <div className="sectionhead">
            <h2>Карточка подопечного</h2>
            <button className="soft" onClick={() => setAction('edit')}>
              <Pencil size={15} /> Изменить
            </button>
          </div>
          <dl className="profiledata">
            {[
              ['Телефон', c.phone],
              ['Цель', c.goal ? goals[c.goal] : null],
              ['Статус', isArchived ? 'В архиве' : 'Активный'],
              ['Заметки', c.notes],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v || '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="actions">
            <button className="soft" onClick={() => setAction('status')}>
              <Archive size={16} />
              {isArchived ? 'Вернуть из архива' : 'В архив'}
            </button>
            <button className="textdanger" onClick={() => setAction('delete')}>
              Удалить подопечного
            </button>
          </div>
        </section>
      )}
      {action && (
        <Dialog
          title={
            action === 'edit'
              ? 'Изменить карточку'
              : action === 'status'
                ? isArchived
                  ? 'Вернуть из архива?'
                  : 'Перенести в архив?'
                : 'Удалить подопечного?'
          }
          close={close}
        >
          {action === 'edit' ? (
            <ClientForm api={api} client={c} done={done} />
          ) : (
            <Form
              danger={action === 'delete'}
              label={action === 'delete' ? 'Удалить с историей' : isArchived ? 'Восстановить' : 'В архив'}
              submit={async () => {
                if (action === 'delete') {
                  await api.request('/clients/' + id, 'DELETE');
                  onDeleted();
                  return;
                }
                await api.request('/clients/' + id + (isArchived ? '/restore' : '/archive'), 'POST');
                done();
              }}
            >
              {action === 'delete' ? (
                <Notice>Карточка «{c.fullName}», тренировки и замеры будут удалены.</Notice>
              ) : (
                <p>{c.fullName}</p>
              )}
            </Form>
          )}
        </Dialog>
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
