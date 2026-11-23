import { useEffect, useState, type ReactNode } from 'react';
import { Send } from 'lucide-react';
import { Brand, Form, Notice, Status, useResource } from './components';
import { Api, ApiError, errorText, text, type Trainer } from './model';

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="authpage">
      <header className="top">
        <Brand />
      </header>
      <main className="authgrid">
        <section className="cover">
          <img src="/gym.jpg" alt="" width={1400} height={933} />
          <div className="covertext">
            <span className="coverline" />
            <h1>
              Журнал <br />
              тренера<span>.</span>
            </h1>
            <p>Тренировки, результаты и замеры ваших подопечных в одном месте.</p>
          </div>
        </section>
        <section className="authpanel">
          <div className="authinner">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

export function Auth({ enter, sessionExpired, initialUsername }: { enter: (token: string) => void; sessionExpired: boolean; initialUsername: string }) {
  const [signup, setSignup] = useState(false);
  const [loginName, setLoginName] = useState('');
  if (loginName) return <LoginConfirm username={loginName} enter={enter} back={() => setLoginName('')} backLabel="Вернуться ко входу" />;
  return (
    <AuthLayout>
      <h2>{signup ? 'Создать аккаунт' : 'Войти в кабинет'}</h2>
      {sessionExpired && !signup && <p className="muted">Сессия завершена. Войдите снова.</p>}
      <Form key={String(signup)} label={signup ? 'Зарегистрироваться' : 'Вход'}
        secondaryAction={<button type="button" className={signup ? 'plain' : 'soft'} onClick={() => setSignup(!signup)}>
          {signup ? 'Вернуться ко входу' : 'Зарегистрироваться'}
        </button>} submit={async (data) => {
        const username = text(data, 'username');
        if (!username) throw new Error('Введите Username.');
        if (!signup) { setLoginName(username); return; }
        const result = await new Api().request<{ token: string }>('/trainers', 'POST', {
          username, firstName: text(data, 'firstName'), lastName: text(data, 'lastName'),
        });
        enter(result.token);
      }}>
        <label>Username<input name="username" required maxLength={signup ? 64 : 254} autoComplete="username" defaultValue={signup ? '' : initialUsername}
          autoCapitalize="none" spellCheck={false} /></label>
        {signup && <div className="signupnames">
          <label>Имя<input name="firstName" required maxLength={253} autoComplete="given-name" /></label>
          <label>Фамилия<input name="lastName" required maxLength={253} autoComplete="family-name" /></label>
        </div>}
      </Form>
    </AuthLayout>
  );
}

interface Link { url: string; expiresAt: string }

/** Runs a request when the screen opens. A bot that is still starting (503) is retried a few times. */
function useRequest<T>(send: (signal: AbortSignal) => Promise<T>, deps: unknown[], onLoaded?: (result: T) => (() => void) | void) {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    const controller = new AbortController();
    let retryTimer: number | undefined;
    let retriesLeft = 5;
    let cleanup: (() => void) | void;
    setState({});
    async function load() {
      try {
        const data = await send(controller.signal);
        if (controller.signal.aborted) return;
        setState({ data });
        cleanup = onLoaded?.(data);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 503 && retriesLeft > 0) {
          retriesLeft--;
          retryTimer = window.setTimeout(load, 2000);
        } else {
          setState({ error: errorText(e) });
        }
      }
    }
    void load();
    return () => { controller.abort(); window.clearTimeout(retryTimer); cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [state, setState] as const;
}

/** Registration after the form: link Telegram, wait for the administrator, then confirm the first sign-in. */
export function Signup({ api, profile, onProfile, enter, back }: {
  api: Api; profile: Trainer; onProfile: (profile: Trainer) => void; enter: (token: string) => void; back: () => void;
}) {
  if (profile.signupTelegramInUse) return <AuthLayout>
    <h2>Этот аккаунт Telegram уже зарегистрирован</h2>
    <p className="muted">Войдите с Username существующего аккаунта.</p>
    <div className="formstack">
      <button className="primary" onClick={back}>Перейти ко входу</button>
    </div>
  </AuthLayout>;
  if (profile.approvedAt) return <LoginConfirm username={profile.username || profile.fullName} enter={enter} back={back} backLabel="Выйти из регистрации" />;
  return <TelegramLink api={api} linked={!!profile.telegramLinkedAt} onProfile={onProfile} back={back} />;
}

/** Issues the personal bot link and follows the application until the administrator approves it. */
function TelegramLink({ api, linked, onProfile, back }: {
  api: Api; linked: boolean; onProfile: (profile: Trainer) => void; back: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const [opened, setOpened] = useState('');
  const [request, setRequest] = useRequest<Link | null>(
    (signal) => linked ? Promise.resolve(null) : api.request<Link>('/trainers/me/telegram-link', 'POST', undefined, signal),
    [api, linked, revision],
    (link) => {
      if (!link) return;
      const expiry = window.setTimeout(() => setRequest({ error: 'Срок действия ссылки истёк.' }), Math.max(0, Date.parse(link.expiresAt) - Date.now()));
      return () => window.clearTimeout(expiry);
    });
  const link = request.data;
  const statusError = useTelegramProfile(api, true, onProfile);
  const retry = () => { setOpened(''); setRevision((n) => n + 1); };
  if (linked || (link && opened === link.url)) return <AuthLayout>
    <h2>{linked ? 'Заявка на рассмотрении' : 'Откройте Telegram'}</h2>
    <p className="muted">{linked ? 'Telegram привязан. После подтверждения администратором вход откроется на этой странице.'
      : 'Нажмите «Старт» в боте авторизации, чтобы передать заявку администратору.'}</p>
    {!linked && link && <a className="primary" href={link.url} target="_blank" rel="noopener noreferrer">Открыть бота</a>}
    {!linked && <button className="plain" onClick={retry}>Получить новую ссылку</button>}
    {statusError && <Notice>{statusError}</Notice>}
    <button className="plain" onClick={back}>Вернуться ко входу</button>
  </AuthLayout>;
  const error = request.error || statusError;
  return <AuthLayout>
    <h2>Подключите Telegram</h2>
    <p className="muted">Откройте бота авторизации и нажмите «Старт». После этого администратор увидит вашу заявку.</p>
    <div className="formstack">
      {link ? <a className="primary" href={link.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(link.url)}>
          <Send size={16} /> Открыть бота авторизации</a>
        : !request.error && <button className="primary" disabled><Send size={16} /> Открыть бота авторизации</button>}
      {error && <Notice>{error}</Notice>}
      {!link && !request.error && <p role="status">Готовим ссылку…</p>}
      {request.error && <button className="primary" onClick={retry}>Обновить ссылку</button>}
      <button className="plain" onClick={back}>Выйти из регистрации</button>
    </div>
  </AuthLayout>;
}

type LoginState = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
interface LoginStart { secret: string; number: number; botUrl: string; expiresAt: string }

/**
 * Sends a sign-in request to the auth bot and waits for the trainer to allow it there.
 * Only this page knows the request's secret, so only it receives the session.
 */
function LoginConfirm({ username, enter, back, backLabel }: {
  username: string; enter: (token: string) => void; back: () => void; backLabel: string;
}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<LoginState>('PENDING');
  const [statusError, setStatusError] = useState('');
  const [request] = useRequest<LoginStart>(async (signal) => {
    setState('PENDING');
    setStatusError('');
    const result = await new Api().request<LoginStart>('/auth/login', 'POST', { username }, signal);
    if (!result.secret || !result.botUrl) throw new Error('Не удалось отправить запрос. Попробуйте ещё раз.');
    return result;
  }, [username, revision]);
  const login = request.data;
  useEffect(() => {
    if (!login || state !== 'PENDING') return;
    const controller = new AbortController();
    let busy = false;
    const check = async () => {
      if (busy || document.hidden) return;
      if (Date.now() >= Date.parse(login.expiresAt)) { setState('EXPIRED'); return; }
      busy = true;
      try {
        const result = await new Api().request<{ status: LoginState; token?: string }>(
          '/auth/login/status', 'POST', { secret: login.secret }, controller.signal);
        if (controller.signal.aborted) return;
        setStatusError('');
        if (result.status === 'APPROVED' && result.token) enter(result.token);
        else if (result.status !== 'PENDING') setState(result.status);
      } catch (e) {
        if (!controller.signal.aborted) setStatusError(errorText(e));
      } finally { busy = false; }
    };
    const timer = window.setInterval(check, 2000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      controller.abort(); window.clearInterval(timer);
      window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check);
    };
  }, [login, state, enter]);
  const again = () => setRevision((n) => n + 1);
  return <AuthLayout>
    <h2>Подтвердите вход</h2>
    {!login && !request.error && <p role="status">Отправляем запрос в Telegram…</p>}
    {login && state === 'PENDING' && <>
      <p className="muted">Бот авторизации прислал запрос для {username}. Нажмите в нём «Разрешить вход», если там то же число:</p>
      <p className="login-number" aria-label={'Число для сверки ' + login.number}>{login.number}</p>
      <p className="muted" role="status">Ждём подтверждения в Telegram. Если сообщения нет, проверьте Username и нажмите «Старт» в боте.</p>
    </>}
    <div className="formstack">
      {request.error && <Notice>{request.error}</Notice>}
      {state === 'DENIED' && <Notice>Вход отклонён в Telegram.</Notice>}
      {state === 'EXPIRED' && <Notice>Запрос устарел. Отправьте новый.</Notice>}
      {statusError && state === 'PENDING' && <Notice>{statusError}</Notice>}
      {login && <a className="code-chat-link" href={login.botUrl} target="_blank" rel="noopener noreferrer">Открыть чат с ботом</a>}
      {(login || request.error) && <button className={state === 'PENDING' && !request.error ? 'plain' : 'primary'} onClick={again}>
        Отправить запрос ещё раз
      </button>}
      <button className="plain" onClick={back}>{backLabel}</button>
    </div>
  </AuthLayout>;
}

/**
 * Follows the trainer's profile while a change is expected from Telegram or the administrator:
 * every few seconds at first, then once a minute, and again whenever the trainer returns to the page.
 */
function useTelegramProfile(api: Api | undefined, watching: boolean,
  onProfile: ((profile: Trainer) => void) | undefined) {
  const [error, setError] = useState('');
  useEffect(() => {
    if (!api || !watching || !onProfile) return;
    const controller = new AbortController();
    let busy = false;
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const me = await api.request<Trainer>('/trainers/me', 'GET', undefined, controller.signal);
        if (!controller.signal.aborted) { setError(''); onProfile(me); }
      } catch (e) { if (!controller.signal.aborted) setError(errorText(e)); }
      finally { busy = false; }
    };
    let timer: number | undefined;
    let started = 0;
    let active = false;
    const schedule = () => {
      window.clearTimeout(timer);
      const elapsed = Date.now() - started;
      active = !document.hidden && elapsed < 30 * 60_000;
      if (!active) return;
      timer = window.setTimeout(async () => { await check(); schedule(); }, elapsed < 5 * 60_000 ? 8000 : 60_000);
    };
    const watch = () => {
      started = Date.now();
      if (!document.hidden) void check();
      schedule();
    };
    // A page left open stops asking after half an hour. Any activity on it starts a new round.
    const resume = () => { if (!active) watch(); };
    watch();
    window.addEventListener('focus', watch);
    document.addEventListener('visibilitychange', watch);
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    return () => {
      controller.abort(); window.clearTimeout(timer);
      window.removeEventListener('focus', watch); document.removeEventListener('visibilitychange', watch);
      window.removeEventListener('pointerdown', resume); window.removeEventListener('keydown', resume);
    };
  }, [api, watching, onProfile]);
  return watching ? error : '';
}

export function ProfileBotLinks({ api, linked, onConnected }: {
  api: Api; linked: boolean; onConnected: (profile: Trainer) => void;
}) {
  const [revision, setRevision] = useState(0);
  const links = useResource<{ authUrl: string | null; trainingUrl: string | null }>(api, '/trainers/me/bot-links', revision);
  const retry = () => setRevision((n) => n + 1);
  return <div className="formstack">
    {!links.data ? <Status error={links.error} retry={retry} /> : <>
      {links.data.authUrl && <a className="soft" href={links.data.authUrl} target="_blank" rel="noopener noreferrer">
        <Send size={16} /> Открыть бота авторизации
      </a>}
      {linked && links.data.trainingUrl && <a className="soft" href={links.data.trainingUrl} target="_blank" rel="noopener noreferrer">
        <Send size={16} /> Открыть бота для тренировок
      </a>}
      {(!links.data.authUrl || (linked && !links.data.trainingUrl)) && <>
        <p className="muted">{!links.data.authUrl ? 'Ссылка на бота авторизации пока недоступна.' : 'Ссылка на бота для тренировок пока недоступна.'}</p>
        <button className="plain" onClick={retry}>Обновить ссылки</button>
      </>}
    </>}
    {!linked && <TrainingBotConnection api={api} onConnected={onConnected} />}
  </div>;
}

function TrainingBotConnection({ api, onConnected }: {
  api: Api; onConnected: (profile: Trainer) => void;
}) {
  const [link, setLink] = useState<Link>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let expiry: number | undefined;
    setLink(undefined); setError('');
    api.request<Link>('/trainers/me/training-bot-link', 'POST', undefined, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setLink(result);
        expiry = window.setTimeout(() => {
          setLink(undefined); setError('Срок действия ссылки истёк.');
        }, Math.max(0, Date.parse(result.expiresAt) - Date.now()));
      })
      .catch(async (e) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 409) {
          try {
            const me = await api.request<Trainer>('/trainers/me', 'GET', undefined, controller.signal);
            if (me.trainingBotLinkedAt && !controller.signal.aborted) { onConnected(me); return; }
          } catch (refreshError) { e = refreshError; }
        }
        if (!controller.signal.aborted) setError(errorText(e));
      });
    return () => { controller.abort(); window.clearTimeout(expiry); };
  }, [api, onConnected, revision]);
  const statusError = useTelegramProfile(api, opened, onConnected);
  return <div className="formstack">
    {link && <a className="soft" href={link.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>
      <Send size={16} /> Подключить бота для тренировок
    </a>}
    {opened && <p className="muted">Нажмите «Старт» в Telegram с того же аккаунта, который использовали для входа.</p>}
    {error && <><Notice>{error}</Notice><button className="plain" onClick={() => setRevision(n => n + 1)}>Обновить ссылку</button></>}
    {!error && statusError && <Notice>{statusError}</Notice>}
    {!error && !link && <p role="status">Готовим ссылку на бота для тренировок…</p>}
  </div>;
}
