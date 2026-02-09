export function h(tag: string, attrs: { [key: string]: any }, ...children: (string | number | Node)[]): HTMLElement {
  const el = document.createElement(tag);

  for (const key in attrs) {
    if (key === 'dangerouslySetInnerHTML') {
      const val = attrs[key];
      if (val && typeof val === 'object' && typeof val.__html === 'string') {
        el.innerHTML = val.__html;
      } else {
        console.warn(`[hyperscript] Invalid dangerouslySetInnerHTML passed to <${tag}>. Expected { __html: string }.`);
      }
    } else if (key.startsWith('on') && typeof attrs[key] === 'function') {
      el.addEventListener(key.substring(2).toLowerCase(), attrs[key]);
    } else if (key === 'className') {
      el.setAttribute('class', attrs[key]);
    } else {
      el.setAttribute(key, attrs[key]);
    }
  }

  for (const child of children) {
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else if (child) {
      el.appendChild(child as Node);
    }
  }

  return el;
}
