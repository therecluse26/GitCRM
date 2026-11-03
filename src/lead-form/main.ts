// The public lead form page (spec 15). A visitor sends the form to Formcarry. The page carries no
// GitCRM code, and it never touches storage or cookies. It sets text only with textContent, because
// the page's policy requires Trusted Types.
import { ENDPOINT, formIdFromHash, validate } from './lead-form.ts';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function start() {
  const formId = formIdFromHash(location.hash);
  if (formId === null) {
    byId('invalid').hidden = false;
    return;
  }
  const form = byId<HTMLFormElement>('form');
  const name = byId<HTMLInputElement>('name');
  const email = byId<HTMLInputElement>('email');
  const send = byId<HTMLButtonElement>('send');
  const result = byId('result');

  form.hidden = false;
  byId('form-id').textContent = formId;
  byId('sent-through').hidden = false;
  window.addEventListener('hashchange', () => location.reload());

  const showError = (input: HTMLInputElement, message: string | undefined) => {
    byId(`${input.id}-error`).textContent = message ?? '';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  };
  const say = (text: string, failed: boolean) => {
    result.textContent = text;
    result.classList.toggle('error', failed);
    result.focus();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errors = validate({ name: name.value, email: email.value });
    showError(name, errors.name);
    showError(email, errors.email);
    if (errors.name || errors.email) {
      (errors.name ? name : email).focus();
      return;
    }
    send.disabled = true;
    send.textContent = 'Sending…';
    result.textContent = '';
    try {
      const response = await fetch(`${ENDPOINT}${formId}`, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      form.reset();
      say('Thank you. We received your message.', false);
    } catch {
      say('Your message could not be sent. Check your connection and try again.', true);
    } finally {
      send.disabled = false;
      send.textContent = 'Send';
    }
  });
}

// Refuse to run inside a frame (clickjacking), as the app does.
if (window.top !== window.self) {
  document.body.textContent = 'This form does not run inside a frame. Open it in its own tab.';
} else {
  start();
}
