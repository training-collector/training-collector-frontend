import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive,
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
import { Api, errorText, initials, text, type Client, type Trainer } from './model';
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
  const [loginHint, setLoginHint] = useState('');
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
  async function signOut(username = '') {
    try {
      if (token.startsWith('session.') || token.startsWith('signup.')) await api.request('/auth/logout', 'POST');
      window.location.replace('#clients');
      setLoginHint(username);
      logout();
    } catch (error) { setLogoutError(errorText(error)); }
  }
  return token ? (
    <>
      {logoutError && <Notice>{logoutError}</Notice>}
      <Account key={token} api={api} logout={signOut} enter={enter} />
    </>
  ) : (
    <Auth sessionExpired={sessionExpired} enter={enter} initialUsername={loginHint} />
  );
}

interface AccountProps { api: Api; logout: (username?: string) => void; enter: (token: string) => void }

function Account(props: AccountProps) {
  const [rev, setRev] = useState(0);
  const [verified, setVerified] = useState<Trainer>();
  const me = useResource<Trainer>(props.api, '/trainers/me', rev);
  const profile = verified || me.data;
  if (!profile) return <Status error={me.error} retry={() => setRev((n) => n + 1)} />;
  if (props.api.token.startsWith('signup.') || !profile.telegramLinkedAt) {
    return <CodeLogin username={profile.username || profile.fullName}
      signup={{ api: props.api, profile, onProfile: setVerified }}
      enter={props.enter} back={() => props.logout(profile.telegramLinkedAt ? profile.username ?? '' : '')} />;
  }
  if (!profile.approvedAt) return <div className="authinner"><p>Регистрация ожидает одобрения.</p>
    <button className="plain" onClick={() => props.logout()}>Выйти</button></div>;
  return <Workspace {...props} profile={profile} onProfile={setVerified} />;
}

function subscribeToRoute(change: () => void) {
  window.addEventListener('hashchange', change);
  return () => window.removeEventListener('hashchange', change);
}

function Workspace({ api, logout, profile, onProfile }: AccountProps & { profile: Trainer; onProfile: (me: Trainer) => void }) {
  const hash = useSyncExternalStore(subscribeToRoute, () => window.location.hash);
  const categoryMatch = /^#exercises\/([1-9]\d*)$/.exec(hash);
  const exercises = hash === '#exercises' || !!categoryMatch;
  const match = /^#clients\/([1-9]\d*)$/.exec(hash);
  const clientId = match && Number.isSafeInteger(Number(match[1])) ? Number(match[1]) : null;
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState(''),
    [archived, setArchived] = useState(false);
  const [modal, setModal] = useState<'client' | 'account' | null>(null);
  const [unavailableClient, setUnavailableClient] = useState(false);
  useEffect(() => {
    if (hash !== '#clients') setUnavailableClient(false);
  }, [hash]);
  const returnFromUnavailableClient = useCallback((id: number) => {
    if (window.location.hash === '#clients/' + id) {
      setUnavailableClient(true);
      window.location.replace('#clients');
    }
  }, []);
  const refresh = () => setVersion((n) => n + 1);
  const close = () => setModal(null);
  return (
    <>
      <header className="top">
        <Brand />
        <nav className="mainnav" aria-label="Кабинет тренера">
          <a href="#clients" aria-current={exercises ? undefined : clientId ? 'location' : 'page'}>
            <UsersRound size={16} /> Подопечные
          </a>
          <a href="#exercises" aria-current={exercises ? 'page' : undefined}>
            <Dumbbell size={16} /> Упражнения
          </a>
        </nav>
        <button className="account" aria-label={`Профиль тренера, ${profile.fullName}`} onClick={() => setModal('account')}>
          <span className="avatar small">
            {initials(profile.fullName)}
          </span>
          {profile.fullName}
        </button>
      </header>
      {exercises ? <Catalog key={hash} api={api} groupId={categoryMatch ? Number(categoryMatch[1]) : null} /> : clientId === null ? (
        <ClientDirectory api={api} version={version} refresh={refresh} query={query} setQuery={setQuery}
          archived={archived} setArchived={setArchived} add={() => setModal('client')} unavailableClient={unavailableClient} />
      ) : (
        <main className="catalogpage">
          <ClientWorkspace key={clientId} api={api} id={clientId} version={version} onChange={refresh}
            onUnavailable={returnFromUnavailableClient}
            onDeleted={() => { window.location.replace('#clients'); refresh(); }} />
        </main>
      )}
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
            <TrainerIdentity api={api} profile={profile} onProfile={onProfile} />
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

function TrainerIdentity({ api, profile, onProfile }: { api: Api; profile: Trainer; onProfile: (profile: Trainer) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    const [first, ...rest] = profile.fullName.trim().split(/\s+/);
    return <Form label="Сохранить" secondaryAction={<button type="button" className="plain" onClick={() => setEditing(false)}>Отмена</button>}
      submit={async data => {
        const saved = await api.request<Trainer>('/trainers/me', 'PUT', {
          firstName: text(data, 'firstName'), lastName: text(data, 'lastName'),
        });
        onProfile(saved);
        setEditing(false);
      }}>
      <div className="fields two">
        <label>Имя<input name="firstName" autoFocus required maxLength={253} autoComplete="given-name" defaultValue={profile.firstName ?? first} /></label>
        <label>Фамилия<input name="lastName" required maxLength={253} autoComplete="family-name"
          defaultValue={profile.lastName ?? (profile.firstName ? '' : rest.join(' '))} /></label>
      </div>
    </Form>;
  }
  return <div className="identity trainer-identity">
    <span className="avatar">{initials(profile.fullName)}</span>
    <div className="trainer-names">
      <strong>{profile.fullName}</strong>
      <small>{profile.username}</small>
      {profile.phone && <small>{profile.phone}</small>}
    </div>
    <button className="soft" aria-label="Изменить имя и фамилию" onClick={() => setEditing(true)}><Pencil size={15} /> Изменить</button>
  </div>;
}

function ClientDirectory({ api, version, refresh, query, setQuery, archived, setArchived, add, unavailableClient }: {
  api: Api; version: number; refresh: () => void; query: string; setQuery: (value: string) => void;
  archived: boolean; setArchived: (value: boolean) => void; add: () => void; unavailableClient: boolean;
}) {
  const list = useResource<Client[]>(api, '/clients?includeArchived=' + archived, version);
  const shown = list.data?.filter((c) =>
    c.fullName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const filters = <>
    <label className="search">
      <Search size={17} />
      <input type="search" aria-label="Поиск подопечного" placeholder="Поиск по имени или фамилии"
        value={query} onChange={(e) => setQuery(e.target.value)} />
    </label>
    <label className="check">
      <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
      Включая архив
    </label>
  </>;
  const clients = !shown ? <Status error={list.error} retry={refresh} />
    : shown.length ? (
      <nav className="directory-list" aria-label="Список подопечных">
        {shown.map((c) => (
          <a key={c.id} href={'#clients/' + c.id}>
            <span className={'avatar tone' + (c.id % 3)} aria-hidden="true">{initials(c.fullName)}</span>
            <span className="client-name">{c.fullName}
              {c.goal && <small>{c.goal}</small>}
              {c.status === 'ARCHIVED' && <small>В архиве</small>}
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </a>
        ))}
      </nav>
    )
    : <Empty title={query.trim() ? 'Подопечные не найдены' : 'Подопечных пока нет'}>
        {query.trim() && <button className="soft" onClick={() => setQuery('')}>Сбросить поиск</button>}
      </Empty>;
  return <main className="catalogpage">
    <div className="sectionhead workspaceheading">
      <div>
        <h1>Подопечные</h1>
        {unavailableClient && <p className="subtitle" role="status">Карточка по этой ссылке недоступна.</p>}
      </div>
      <button className="primary" onClick={add}><Plus size={17} /> Добавить подопечного</button>
    </div>
    <div className="directory-filters">{filters}</div>
    {clients}
  </main>;
}

function ClientForm({ api, client, done }: { api: Api; client?: Client; done: (c: Client) => void }) {
  const [revision, setRevision] = useState(0);
  const goals = useResource<{ id: number; name: string }[]>(api, '/catalog/goals', revision);
  if (!goals.data) return <Status error={goals.error} retry={() => setRevision(n => n + 1)} />;
  return (
    <Form
      label={client ? 'Сохранить карточку' : 'Добавить подопечного'}
      submit={async (d) => {
        done(
          await api.request<Client>(client ? '/clients/' + client.id : '/clients', client ? 'PUT' : 'POST', {
            firstName: text(d, 'firstName'),
            lastName: text(d, 'lastName') || null,
            goal: text(d, 'goal') || null,
            notes: text(d, 'notes') || null,
          }),
        );
      }}
    >
      <div className="fields two">
        <label>Имя<input name="firstName" required maxLength={255} defaultValue={client?.firstName} /></label>
        <label>Фамилия<input name="lastName" required={!client || !!client.lastName} maxLength={255} defaultValue={client?.lastName ?? ''} /></label>
      </div>
      <label>
        Цель
        <select name="goal" defaultValue={client?.goal ?? ''}>
          <option value="">Не указана</option>
          {client?.goal && !goals.data.some(g => g.name === client.goal) && <option>{client.goal}</option>}
          {goals.data.map(g => <option key={g.id}>{g.name}</option>)}
        </select>
      </label>
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
  onUnavailable,
}: {
  api: Api;
  id: number;
  version: number;
  onChange: () => void;
  onDeleted: () => void;
  onUnavailable: (id: number) => void;
}) {
  const [tab, setTab] = useState<'workouts' | 'metrics' | 'profile'>('workouts');
  const [action, setAction] = useState<'edit' | 'status' | 'delete' | null>(null);
  const resource = useResource<Client>(api, '/clients/' + id, version);
  const c = resource.data;
  const unavailable = resource.errorStatus === 404 || resource.errorStatus === 403;
  useEffect(() => {
    if (unavailable) onUnavailable(id);
  }, [unavailable, id, onUnavailable]);
  if (unavailable) return null;
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
        <nav className="crumb" aria-label="Путь по кабинету">
          <a href="#clients">Подопечные</a><span aria-hidden="true">/</span><span aria-current="page">{c.fullName}</span>
        </nav>
        <div className="row-between">
          <div>
            <h1>{c.fullName}</h1>
            <p className="subtitle">
              {c.goal ? c.goal : 'Подопечный'}
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
              ['Цель', c.goal ? c.goal : null],
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
