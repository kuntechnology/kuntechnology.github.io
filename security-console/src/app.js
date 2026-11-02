import { operationalViews } from './operational-views.js';

const workspace = document.getElementById('workspace');
const liveStatus = document.getElementById('live-status');
const currentLabel = document.getElementById('current-module-label');
const situationMarkup = workspace.innerHTML;
const assistantMarkup = workspace.querySelector('.dialogue-panel').outerHTML;
const titles = { qa: '安全问答', situation: '态势分析', response: '应急响应', system: '系统管理' };
const statusMessages = {
  qa: '安全问答：服务未接入，暂不可提问，问题不会被发送。',
  situation: '态势分析：安全数据源未接入，当前无法提供风险统计与趋势。',
  response: '应急响应：事件来源未接入，授权与审批链待核验，处置执行未启用。',
  system: '系统管理：管理服务未接入，配置不可提交。',
};

const qaMarkup = `${assistantMarkup}
<section class="qa-guidance" aria-labelledby="page-title">
  <header class="qa-header"><p class="eyebrow">SECURITY ASSISTANT</p><h1 id="page-title">安全问答</h1><p>知识来源与服务连接就绪后，方可开放提问。</p></header>
  <div class="qa-service-state"><span class="qa-state-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v12H9l-4 4zM9 8h6M9 12h4"/></svg></span><div><h2>问答服务未接入</h2><p>当前暂不可提问，问题不会被发送。</p></div><span class="quiet-tag">等待接入</span></div>
  <section class="qa-requirements" aria-labelledby="qa-requirements-title"><div class="qa-section-heading"><h2 id="qa-requirements-title">接入前置条件</h2><span>来源 · 服务 · 访问边界</span></div>
    <details open><summary><span><i aria-hidden="true">01</i>授权知识源</span><strong>未连接</strong></summary><div class="qa-detail"><p>需确认知识来源的使用授权、适用范围与有效版本。</p><dl><div><dt>知识来源</dt><dd>尚未配置</dd></div><div><dt>依据追溯</dt><dd>等待知识源接入</dd></div></dl></div></details>
    <details><summary><span><i aria-hidden="true">02</i>问答服务</span><strong>未接入</strong></summary><div class="qa-detail"><p>需配置经授权的问答服务，并核验数据处理与保留要求。</p><dl><div><dt>服务连接</dt><dd>未配置</dd></div><div><dt>问题提交</dt><dd>未开放</dd></div></dl></div></details>
    <details><summary><span><i aria-hidden="true">03</i>检索与访问边界</span><strong>待核验</strong></summary><div class="qa-detail"><p>开放提问前，需明确知识访问权限、敏感信息边界与审计要求。</p><dl><div><dt>访问范围</dt><dd>待核验</dd></div><div><dt>审计来源</dt><dd>未接入</dd></div></dl></div></details>
  </section>
  <div class="qa-next-step"><p><strong>当前阻塞</strong>知识源与问答服务尚未连接</p><button type="button" data-go="system">查看系统接入要求<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button></div>
</section>`;

let readinessTimer;
let currentModule;

function validModule(value) {
  return Object.prototype.hasOwnProperty.call(titles, value) ? value : 'situation';
}

function renderModule(value, moveFocus = true) {
  const module = validModule(value);
  window.clearTimeout(readinessTimer);
  currentModule = module;
  workspace.className = module === 'situation' ? 'mission-grid' : module === 'qa' ? 'mission-grid qa-workspace' : 'mission-grid detail-workspace';
  workspace.innerHTML = module === 'situation' ? situationMarkup : module === 'qa' ? qaMarkup : operationalViews[module];
  workspace.scrollTop = 0;
  document.title = `${titles[module]} · 衡域安全运营中枢`;
  currentLabel.textContent = titles[module];
  document.querySelectorAll('.module-link').forEach(button => {
    const selected = button.dataset.module === module;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const unavailable = workspace.querySelectorAll('.unavailable-state');
  const loading = module === 'situation' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  workspace.setAttribute('aria-busy', String(loading));
  unavailable.forEach(element => element.setAttribute('aria-hidden', String(loading)));
  liveStatus.textContent = loading ? '正在准备态势视图。' : statusMessages[module];
  if (loading) {
    readinessTimer = window.setTimeout(() => {
      if (currentModule !== module) return;
      workspace.setAttribute('aria-busy', 'false');
      unavailable.forEach(element => element.removeAttribute('aria-hidden'));
      liveStatus.textContent = statusMessages[module];
    }, 2150);
  }
  if (moveFocus) workspace.focus({ preventScroll: true });
}

function navigate(module) {
  const next = validModule(module);
  if (window.location.hash === `#${next}`) renderModule(next);
  else window.location.hash = next;
}

document.addEventListener('click', event => {
  if (event.target.closest('.skip-link')) {
    event.preventDefault();
    workspace.focus({ preventScroll: true });
    return;
  }
  const navButton = event.target.closest('button[data-module]');
  const destination = event.target.closest('button[data-go]');
  if (navButton) navigate(navButton.dataset.module);
  else if (destination) navigate(destination.dataset.go);
});

document.addEventListener('submit', event => {
  if (!event.target.matches('.question-composer')) return;
  event.preventDefault();
  const note = event.target.querySelector('.composer-note');
  note.textContent = '问答服务未接入，问题未发送';
  liveStatus.textContent = '问答服务未接入，问题未发送。';
});

window.addEventListener('hashchange', () => {
  const next = validModule(window.location.hash.slice(1));
  if (window.location.hash !== `#${next}`) window.history.replaceState(null, '', `#${next}`);
  renderModule(next);
});

const initial = validModule(window.location.hash.slice(1));
if (window.location.hash !== `#${initial}`) window.history.replaceState(null, '', `#${initial}`);
renderModule(initial, false);
