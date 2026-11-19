// Shows a small OpenSource Radar panel on GitHub issue pages: how
// beginner-friendly the project is, whether the issue is still free, and a
// button to Radar's step-by-step help for it. It lives in a shadow root, so
// GitHub's styles and Radar's never mix.
(() => {
  const { parseIssuePath, helpUrl, friendlinessSummary, stillFree } = globalThis.RadarExtension;
  const HOST_ID = "opensource-radar-panel";
  const CLOSED_KEY = "opensource-radar-closed";
  let shownFor = "";

  const STYLE = `
    :host { all: initial; }
    .panel {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
      width: 300px; max-width: calc(100vw - 32px); box-sizing: border-box;
      padding: 14px 14px 12px; border: 1px solid #d1d9e0; border-radius: 12px;
      background: #ffffff; color: #1f2328; box-shadow: 0 8px 24px rgba(31, 35, 40, 0.18);
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      .panel { border-color: #3d444d; background: #151b23; color: #f0f6fc; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5); }
      .muted { color: #9198a1 !important; }
      .close:hover { background: #262c36 !important; }
    }
    .head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .head img { width: 18px; height: 18px; }
    .title { flex: 1; font-weight: 600; font-size: 13px; }
    .close {
      display: inline-flex; padding: 4px; border: 0; border-radius: 6px;
      background: none; color: inherit; cursor: pointer; font-size: 16px; line-height: 1;
    }
    .close:hover { background: #eff2f5; }
    .row { margin: 0 0 8px; }
    .label { font-weight: 600; }
    .dot { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; vertical-align: 1px; background: #9198a1; }
    .high { background: #1a7f37; } .medium { background: #9a6700; } .low { background: #cf222e; }
    .free { background: #1a7f37; } .taken { background: #9a6700; } .closed { background: #9198a1; }
    ul { margin: 4px 0 0; padding-left: 16px; }
    li { margin: 0; }
    .muted { color: #59636e; }
    .help {
      display: block; margin-top: 10px; padding: 7px 12px; border-radius: 6px;
      background: #1f883d; color: #ffffff; font-weight: 600; text-align: center; text-decoration: none;
    }
    .help:hover { background: #1c8139; }
  `;

  function closedIssues() {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(CLOSED_KEY)) || []);
    } catch {
      return new Set();
    }
  }

  function rememberClosed(key) {
    const closed = closedIssues();
    closed.add(key);
    try {
      sessionStorage.setItem(CLOSED_KEY, JSON.stringify([...closed]));
    } catch {
      // Closing still works for this page.
    }
  }

  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (name === "text") node.textContent = value;
      else node.setAttribute(name, value);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  };

  function removePanel() {
    document.getElementById(HOST_ID)?.remove();
  }

  function render(target, body) {
    removePanel();
    const host = el("div", { id: HOST_ID });
    const root = host.attachShadow({ mode: "closed" });
    const close = el("button", { class: "close", type: "button", "aria-label": "Close OpenSource Radar", text: "×" });
    close.addEventListener("click", () => {
      rememberClosed(`${target.repo}#${target.number}`);
      removePanel();
    });
    const panel = el("section", { class: "panel", "aria-label": "OpenSource Radar" }, [
      el("div", { class: "head" }, [
        el("img", { src: chrome.runtime.getURL("icons/icon-32.png"), alt: "" }),
        el("span", { class: "title", text: "OpenSource Radar" }),
        close,
      ]),
      ...body,
      el("a", { class: "help", href: helpUrl(target.repo, target.number), target: "_blank", rel: "noopener noreferrer", text: "Get help with this issue" }),
    ]);
    root.append(el("style", { text: STYLE }), panel);
    document.body.append(host);
  }

  function resultRows(result) {
    const rows = [];
    const friendly = friendlinessSummary(result.friendliness);
    if (friendly) {
      rows.push(
        el("div", { class: "row" }, [
          el("span", { class: `dot ${friendly.level ?? ""}` }),
          el("span", { class: "label", text: friendly.label }),
          el("ul", {}, friendly.facts.map((fact) => el("li", { text: fact }))),
        ]),
      );
    } else {
      rows.push(el("p", { class: "row muted", text: "Couldn't check how beginner-friendly this project is right now." }));
    }
    if (result.issue) {
      const free = stillFree({ ...result.issue, openPullRequests: result.openPullRequests ?? 0 });
      rows.push(
        el("p", { class: "row" }, [el("span", { class: `dot ${free.status}` }), el("span", { text: free.text })]),
      );
      if (result.openPullRequests === null && free.status === "free") {
        rows.push(el("p", { class: "row muted", text: "Linked pull requests couldn't be checked; look at the issue's timeline too." }));
      }
    }
    return rows;
  }

  function show() {
    const target = parseIssuePath(location.pathname);
    const key = target ? `${target.repo}#${target.number}` : "";
    if (key === shownFor) return;
    shownFor = key;
    if (!target || closedIssues().has(key)) {
      removePanel();
      return;
    }
    render(target, [el("p", { class: "row muted", text: "Checking this issue…" })]);
    chrome.runtime.sendMessage({ type: "radar-lookup", repo: target.repo, number: target.number }, (result) => {
      if (shownFor !== key) return; // moved to another page meanwhile
      if (chrome.runtime.lastError || !result?.ok) {
        render(target, [el("p", { class: "row muted", text: "Couldn't reach OpenSource Radar just now." })]);
        return;
      }
      render(target, resultRows(result));
    });
  }

  // GitHub changes pages without reloading, so watch for address changes.
  show();
  let lastPath = location.pathname;
  const check = () => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    show();
  };
  document.addEventListener("turbo:load", check);
  window.addEventListener("popstate", check);
  setInterval(check, 1000);
})();
