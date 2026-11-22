import { useEffect, useRef, useState, type ReactNode } from 'react';
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
          <img src="/gym.jpg" alt="" />
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

export function Auth({ enter, sessionExpired }: { enter: (token: string) => void; sessionExpired: boolean }) {
  const [signup, setSignup] = useState(false);
  const [loginName, setLoginName] = useState('');
  if (loginName) return <CodeLogin username={loginName} enter={enter} back={() => setLoginName('')} />;
  return (
    <AuthLayout>
      <h2>{signup ? 'Создать аккаунт' : 'Войти в кабинет'}</h2>
      {sessionExpired && !signup && <p className="muted">Сессия завершена. Войдите снова.</p>}
      <Form key={String(signup)} label={signup ? 'Зарегистрироваться' : 'Получить код'}
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
        <label>Username<input name="username" required maxLength={signup ? 64 : 254} autoComplete="username"
          autoCapitalize="none" spellCheck={false} /></label>
        {signup && <div className="signupnames">
          <label>Имя<input name="firstName" required maxLength={253} autoComplete="given-name" /></label>
          <label>Фамилия<input name="lastName" required maxLength={253} autoComplete="family-name" /></label>
        </div>}
      </Form>
    </AuthLayout>
  );
}

interface Challenge { challenge: string; botUrl: string; expiresAt: string }
const openedChallengeKey = 'training-collector.opened-login';

function CodeDigits() {
  const [digits, setDigits] = useState<string[]>(() => Array(6).fill(''));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  function focus(index: number) {
    const field = inputs.current[index];
    field?.focus();
    field?.select();
  }
  function write(index: number, value: string) {
    const numbers = value.replace(/\s/g, '');
    if (!/^[0-9]{0,6}$/.test(numbers)) return;
    const start = numbers.length === 6 ? 0 : index;
    setDigits(previous => {
      const next = [...previous];
      const replacement = numbers ? [...numbers] : [''];
      next.splice(start, replacement.length, ...replacement);
      return next.slice(0, 6);
    });
    if (numbers) focus(Math.min(start + numbers.length, 5));
  }
  return <div className="code-digits" role="group" aria-label="Одноразовый код из шести цифр">
    {digits.map((digit, i) => <input key={i} ref={el => { inputs.current[i] = el; }}
      aria-label={`Цифра ${i + 1} из 6`} name="digit" type="text" inputMode="numeric"
      autoComplete={i === 0 ? 'one-time-code' : 'off'} required pattern="[0-9]" value={digit}
      autoFocus={i === 0} onFocus={e => e.currentTarget.select()} onClick={e => e.currentTarget.select()}
      onChange={e => write(i, e.currentTarget.value)}
      onPaste={e => { e.preventDefault(); write(i, e.clipboardData.getData('text')); }}
      onKeyDown={e => {
        if (e.key === 'Backspace' && !digit && i > 0) {
          e.preventDefault(); write(i - 1, ''); focus(i - 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault(); focus(i + (e.key === 'ArrowLeft' ? -1 : 1));
        }
      }} />)}
  </div>;
}

export function CodeLogin({ username, signup, enter, back }: {
  username: string; enter: (token: string) => void; back: () => void;
  signup?: { api: Api; profile: Trainer; onProfile: (profile: Trainer) => void };
}) {
  const [challenge, setChallenge] = useState<Challenge>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [opened, setOpened] = useState(() => sessionStorage.getItem(openedChallengeKey));
  const signupApi = signup?.api;
  const inUse = signup?.profile.signupTelegramInUse === true;
  const enteringCode = !signup || !!signup.profile.telegramLinkedAt || (!!challenge && opened === challenge.challenge);
  useEffect(() => {
    if (inUse) return;
    const controller = new AbortController();
    let expiry: number | undefined;
    let retryTimer: number | undefined;
    let retriesLeft = 5;
    setError(''); setChallenge(undefined);
    async function loadChallenge() {
      try {
        const result = signupApi
          ? await signupApi.request<Link & { challenge: string }>('/trainers/me/telegram-link', 'POST', undefined, controller.signal)
              .then(({ url, challenge, expiresAt }) => ({ botUrl: url, challenge, expiresAt }))
          : await new Api().request<Challenge>('/auth/login', 'POST', { username }, controller.signal);
        if (controller.signal.aborted) return;
        if (!result.challenge || !result.botUrl) throw new Error('Не удалось запросить код. Попробуйте ещё раз.');
        setChallenge(result);
        expiry = window.setTimeout(() => {
          setChallenge(undefined); setError('Время действия кода истекло.');
        }, Math.max(0, Date.parse(result.expiresAt) - Date.now()));
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 503 && retriesLeft > 0) {
          retriesLeft--;
          retryTimer = window.setTimeout(loadChallenge, 2000);
        } else {
          setError(errorText(e));
        }
      }
    }
    void loadChallenge();
    return () => { controller.abort(); window.clearTimeout(retryTimer); window.clearTimeout(expiry); };
  }, [username, signupApi, revision, inUse]);
  const statusError = useTelegramProfile(signupApi, !!opened && !inUse && !signup?.profile.telegramLinkedAt,
    signup?.onProfile);
  function retry() {
    sessionStorage.removeItem(openedChallengeKey);
    setOpened(null);
    setRevision(n => n + 1);
  }
  if (signup && inUse) return <AuthLayout>
    <h2>Этот аккаунт Telegram уже зарегистрирован</h2>
    <p className="muted">Войдите с Username существующего аккаунта.</p>
    <div className="formstack">
      <button className="primary" onClick={back}>Перейти ко входу</button>
    </div>
  </AuthLayout>;
  return <AuthLayout>
    <h2>{enteringCode ? 'Введите код' : 'Подключите Telegram'}</h2>
    <p className="muted">{enteringCode
      ? (signup && !signup.profile.telegramLinkedAt ? 'Нажмите «Старт» в Telegram и вставьте сюда код из сообщения.'
        : `Введите или вставьте шестизначный код из Telegram для ${username}.`)
      : 'Откройте бота авторизации и нажмите «Старт». Бот пришлёт код для регистрации.'}</p>
    <div className="formstack">
      {enteringCode ?
        <Form key={revision} label="Войти" submitDisabled={!challenge} submit={async (data) => {
          if (!challenge) return;
          const result = await new Api().request<{ token: string }>('/auth/login/verify', 'POST', {
            challenge: challenge.challenge, code: data.getAll('digit').join(''),
          });
          sessionStorage.removeItem(openedChallengeKey);
          enter(result.token);
        }}>
          <CodeDigits />
        </Form> :
        challenge ? <a className="primary" href={challenge.botUrl} target="_blank" rel="noopener noreferrer" onClick={() => {
          sessionStorage.setItem(openedChallengeKey, challenge.challenge);
          setOpened(challenge.challenge);
        }}><Send size={16} /> Открыть бота авторизации</a> :
        !error && <button className="primary" disabled><Send size={16} /> Открыть бота авторизации</button>
      }
      {(error || statusError) && <Notice>{error || statusError}</Notice>}
      {!challenge && !error && <p role="status">{enteringCode ? 'Запрашиваем код…' : 'Готовим ссылку…'}</p>}
      {!signup && challenge && <a className="code-chat-link" href={challenge.botUrl} target="_blank" rel="noopener noreferrer">Открыть чат с ботом</a>}
      {((enteringCode && challenge) || error) && <button className={enteringCode ? 'plain' : 'primary'} onClick={retry}>
        {enteringCode ? 'Запросить код повторно' : 'Обновить ссылку'}
      </button>}
      <button className="plain" onClick={back}>{signup ? 'Выйти из регистрации' : 'Вернуться ко входу'}</button>
    </div>
  </AuthLayout>;
}

interface Link { url: string; expiresAt: string }

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
    const checkVisible = () => { if (!document.hidden) void check(); };
    void check();
    const timer = window.setInterval(checkVisible, 4000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', checkVisible);
    return () => {
      controller.abort(); window.clearInterval(timer);
      window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', checkVisible);
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
