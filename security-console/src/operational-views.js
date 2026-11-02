export const operationalViews = {
  response: `
    <section class="operational-main" aria-labelledby="page-title">
      <header class="operational-heading">
        <p class="operational-kicker">响应准备 / 流程要求</p>
        <h1 id="page-title">应急响应</h1>
        <p class="operational-lede">事件来源尚未接入，暂无可核验响应对象。进入响应流程前，需核验来源、证据与授权审批。</p>
      </header>
      <section class="workflow-list" aria-label="应急响应流程要求">
        <details class="workflow-step">
          <summary><span class="step-index">流程要求</span><span class="step-title">线索接入</span><span class="state-label">未接入</span></summary>
          <div class="step-content"><p>事件来源未接入，尚无可核验的线索或响应对象。进入研判前需明确授权数据来源、接入范围、采集方式及可追溯依据。</p><dl class="requirement-list"><div><dt>来源状态</dt><dd>未接入</dd></div><div><dt>所需信息</dt><dd>来源说明、授权范围、采集边界</dd></div></dl></div>
        </details>
        <details class="workflow-step">
          <summary><span class="step-index">流程要求</span><span class="step-title">研判与证据</span><span class="state-label">待核验</span></summary>
          <div class="step-content"><p>只有在获得可追溯来源后，才可核对上下文、影响范围与证据链。推断不得标记为已确认事实。</p><dl class="requirement-list"><div><dt>核验内容</dt><dd>来源、采集边界、证据完整性与关联依据</dd></div><div><dt>当前状态</dt><dd>待核验</dd></div></dl></div>
        </details>
        <details class="workflow-step">
          <summary><span class="step-index">流程要求</span><span class="step-title">授权审批</span><span class="state-label">待建立</span></summary>
          <div class="step-content"><p>任何高影响处置前均须确认对象、目标范围、业务影响、授权人、执行时间窗、回退方案与审计要求，并完成适用审批。</p><dl class="requirement-list"><div><dt>审批链</dt><dd>待建立</dd></div><div><dt>授权依据</dt><dd>需由管理方提供并核验</dd></div></dl><button class="text-action" type="button" data-go="system">查看审批配置要求</button></div>
        </details>
        <details class="workflow-step">
          <summary><span class="step-index">流程要求</span><span class="step-title">处置与回退</span><span class="state-label">未启用</span></summary>
          <div class="step-content"><p>处置执行尚未启用。启用前需核对目标、业务影响、授权人、时间窗、回退条件及审计留痕要求。</p><dl class="requirement-list"><div><dt>执行能力</dt><dd>未启用</dd></div><div><dt>回退与审计</dt><dd>方案与记录要求待建立</dd></div></dl></div>
        </details>
        <details class="workflow-step">
          <summary><span class="step-index">流程要求</span><span class="step-title">恢复验证</span><span class="state-label">待建立</span></summary>
          <div class="step-content"><p>恢复验证要求尚未建立。需明确验证依据、验证范围、复核责任及留痕要求，结果应有可追溯依据。</p><dl class="requirement-list"><div><dt>验证依据</dt><dd>待建立</dd></div><div><dt>结果记录</dt><dd>需可追溯并经复核</dd></div></dl></div>
        </details>
      </section>
    </section>
    <aside class="operational-rail" aria-labelledby="response-boundary-title">
      <p class="operational-kicker">授权边界</p>
      <h2 id="response-boundary-title">响应对象与执行状态</h2>
      <p class="rail-intro">响应对象未确认，处置保持未启用。高影响操作需完成授权与审批。</p>
      <dl class="status-list"><div><dt>对象</dt><dd>未确认</dd></div><div><dt>范围</dt><dd>待核验</dd></div><div><dt>审批链</dt><dd>未配置</dd></div><div><dt>执行</dt><dd>未启用</dd></div></dl>
      <div class="rail-note"><strong>处置前必须核对</strong><p>目标、业务影响、授权人、时间窗、回退与审计要求尚待核验。执行未开放。</p></div>
      <button class="text-action rail-link" type="button" data-go="system">查看审批配置要求<span aria-hidden="true">→</span></button>
    </aside>`,
  system: `
    <section class="operational-main" aria-labelledby="page-title">
      <header class="operational-heading">
        <p class="operational-kicker">管理准备 / 接入与治理</p>
        <h1 id="page-title">系统管理</h1>
        <p class="operational-lede">管理服务尚未接入，配置暂不可提交。请核对各项接入依赖与授权要求。</p>
      </header>
      <section class="workflow-list" aria-label="系统管理配置准备">
        <details class="workflow-step">
          <summary><span class="step-index">配置准备</span><span class="step-title">数据源连接</span><span class="state-label">未接入</span></summary>
          <div class="step-content"><p>当前没有已接入的数据源或连接记录，无法读取安全数据。需由管理方确认数据来源、授权范围、连接方式、负责人及数据边界。</p><dl class="requirement-list"><div><dt>阻塞原因</dt><dd>数据源服务未接入</dd></div><div><dt>所需信息</dt><dd>来源、范围、连接方式与责任方</dd></div></dl><div class="disabled-action"><button type="button" disabled>连接数据源</button><span>管理服务未接入，配置不可提交</span></div></div>
        </details>
        <details class="workflow-step">
          <summary><span class="step-index">配置准备</span><span class="step-title">知识与问答</span><span class="state-label">未接入</span></summary>
          <div class="step-content"><p>知识源与问答服务均未接入，因此无法检索或生成答案。需明确知识来源、授权与更新责任、可见范围及问答服务接口约定。</p><dl class="requirement-list"><div><dt>阻塞原因</dt><dd>知识与问答服务未接入</dd></div><div><dt>所需信息</dt><dd>来源授权、范围、更新责任与服务约定</dd></div></dl><div class="disabled-action"><button type="button" disabled>保存配置</button><span>管理服务未接入，配置不可提交</span></div></div>
        </details>
        <details class="workflow-step">
          <summary><span class="step-index">配置准备</span><span class="step-title">身份与权限</span><span class="state-label">待配置</span></summary>
          <div class="step-content"><p>未提供身份目录或权限策略，当前没有可核验的用户、角色或授权记录。需由管理方提供身份来源、角色定义、最小权限边界及授权复核机制。</p><dl class="requirement-list"><div><dt>阻塞原因</dt><dd>身份与权限服务未接入</dd></div><div><dt>所需信息</dt><dd>身份来源、角色、权限边界与复核方式</dd></div></dl><div class="disabled-action"><button type="button" disabled>保存权限配置</button><span>管理服务未接入，配置不可提交</span></div></div>
        </details>
        <details class="workflow-step">
          <summary><span class="step-index">配置准备</span><span class="step-title">审批策略</span><span class="state-label">待配置</span></summary>
          <div class="step-content"><p>审批策略尚未配置。需明确适用动作、审批角色、授权边界、时间窗、业务影响评估、回退要求与审批留痕规则。</p><dl class="requirement-list"><div><dt>阻塞原因</dt><dd>审批策略服务未接入</dd></div><div><dt>所需信息</dt><dd>策略范围、审批链、授权与回退要求</dd></div></dl><div class="disabled-action"><button type="button" disabled>保存审批策略</button><span>管理服务未接入，配置不可提交</span></div></div>
        </details>
        <details class="workflow-step">
          <summary><span class="step-index">配置准备</span><span class="step-title">审计留痕</span><span class="state-label">未接入</span></summary>
          <div class="step-content"><p>审计服务未接入，暂无可核验记录。需明确记录范围、保留规则、访问控制、完整性保护及审阅责任。</p><dl class="requirement-list"><div><dt>阻塞原因</dt><dd>审计服务未接入</dd></div><div><dt>所需信息</dt><dd>留痕范围、保留规则、访问与复核要求</dd></div></dl><div class="disabled-action"><button type="button" disabled>保存审计配置</button><span>管理服务未接入，配置不可提交</span></div></div>
        </details>
      </section>
    </section>
    <aside class="operational-rail" aria-labelledby="dependency-title">
      <p class="operational-kicker">接入依赖</p>
      <h2 id="dependency-title">建立可分析范围</h2>
      <p class="rail-intro">态势分析依赖以下顺序准备。当前数据与分析范围均不可用。</p>
      <ol class="dependency-list"><li><span>数据源</span><strong>未接入</strong><p>先确认来源、授权边界与连接责任。</p></li><li><span>统计口径</span><strong>待配置</strong><p>数据来源核验后，明确纳入范围与统计定义。</p></li><li><span>观察窗口</span><strong>待建立</strong><p>口径确定后，再定义可核验的观察区间。</p></li></ol>
      <div class="rail-note"><strong>当前阻塞点</strong><p>数据源未接入，统计口径与观察窗口尚无法建立。</p></div>
      <button class="text-action rail-link" type="button" data-go="situation">返回态势分析<span aria-hidden="true">→</span></button>
    </aside>`
};
