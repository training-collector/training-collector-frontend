import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, AlertCircle, X } from 'lucide-react';
import { Api, errorText } from './model';

export function Brand() {
  return (
    <div className="brand">
      <img className="brandmark" src="/training-collector.png" width="34" height="34" alt="" />
      Training Collector
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="notice">
      <AlertCircle size={17} />
      {children}
    </p>
  );
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Activity size={23} />
      </span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={id} onCancel={close}>
      <header className="dialoghead">
        <h2 id={id}>{title}</h2>
        <button type="button" className="iconbtn" onClick={close} aria-label="Закрыть">
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Form({
  children,
  submit,
  label = 'Сохранить',
  danger = false,
  submitDisabled = false,
  secondaryAction,
}: {
  children: ReactNode;
  submit: (data: FormData) => Promise<void>;
  label?: string;
  danger?: boolean;
  submitDisabled?: boolean;
  secondaryAction?: ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const inFlight = useRef(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || submitDisabled) return;
    const data = new FormData(event.currentTarget);
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await submit(data);
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <fieldset disabled={busy} className="formstack">
        {children}
        {error && <Notice>{error}</Notice>}
        <button className={danger ? 'danger' : 'primary'} type="submit" disabled={submitDisabled}>
          {busy ? 'Отправка…' : label}
        </button>
        {secondaryAction}
      </fieldset>
    </form>
  );
}
export function useResource<T>(api: Api, path: string, version = 0): { data?: T; error?: string } {
  const [state, setState] = useState<{ api: Api; path: string; data?: T; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    api
      .request<T>(path, 'GET', undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ api, path, data });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setState({ api, path, error: errorText(e) });
      });
    return () => controller.abort();
  }, [api, path, version]);
  return state?.api === api && state.path === path ? state : {};
}
export function Status({ error, retry }: { error?: string; retry?: () => void }) {
  return error ? (
    <div>
      <Notice>{error}</Notice>
      {retry && (
        <button className="soft" onClick={retry}>
          Повторить
        </button>
      )}
    </div>
  ) : (
    <p role="status" className="muted">
      Загрузка…
    </p>
  );
}
