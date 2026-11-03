// What the owner shares with visitors (spec 15): the link to the form page, and the HTML snippet
// for the owner's own website.

// The form page sits beside index.html, wherever this copy runs (ADR-010: relative paths).
export function leadFormLink(formId: string, page: { origin: string; pathname: string }): string {
  return `${page.origin}${page.pathname.replace(/[^/]*$/, '')}lead.html#form=${formId}`;
}

// A plain form that posts to Formcarry. It needs no script and no CORS. `_gotcha` is Formcarry's
// honeypot: a bot fills it, a person never sees it.
export function leadFormSnippet(formId: string): string {
  return `<form action="https://formcarry.com/s/${formId}" method="post" accept-charset="UTF-8">
  <label>Name <input type="text" name="name" required></label>
  <label>Email <input type="email" name="email" required></label>
  <label>Phone <input type="tel" name="phone"></label>
  <label>Message <textarea name="message"></textarea></label>
  <input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit">Send</button>
</form>`;
}
