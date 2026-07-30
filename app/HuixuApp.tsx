"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./huixu.module.css";

type Screen = "welcome" | "routes" | "app";
type Tab = "today" | "progress" | "records" | "me";
type RouteKey = "7" | "21" | "50";

type Checkin = {
  id: string;
  name: string;
  detail: string;
  icon: string;
  tone: "blue" | "purple" | "blend" | "mist";
  done: boolean;
};

const routeInfo: Record<
  RouteKey,
  { days: number; name: string; label: string; description: string; structure: string }
> = {
  "7": {
    days: 7,
    name: "7日清场",
    label: "先清理眼前的混乱",
    description: "用七天减少生活里的阻力，重新获得一点空间、能量和掌控感。",
    structure: "每天一个主挑战 · 两个小锚点",
  },
  "21": {
    days: 21,
    name: "21日稳定",
    label: "建立可重复的节奏",
    description: "用三个固定锚点和七组三日挑战，慢慢建立能够重复的生活秩序。",
    structure: "三个固定锚点 · 七组三日挑战",
  },
  "50": {
    days: 50,
    name: "50日挑战",
    label: "长期实践完整规则",
    description: "当基础节奏已经出现，用五十天把稳定生活变成可以持续的状态。",
    structure: "六项基础挑战 · 两项可选成长",
  },
};

const starterCheckins: Checkin[] = [
  { id: "wake", name: "起居", detail: "08:20", icon: "☼", tone: "blue", done: true },
  { id: "body", name: "身体", detail: "25分钟", icon: "⌁", tone: "blend", done: true },
  { id: "focus", name: "注意力", detail: "今晚完成", icon: "☾", tone: "purple", done: false },
  { id: "quiet", name: "安静时间", detail: "20分钟", icon: "◎", tone: "mist", done: false },
];

const storageKey = "huixu-v1-state";

function BrandOrbit({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.orbit} ${compact ? styles.orbitCompact : ""}`} aria-hidden="true">
      <i className={styles.orbitBlue} />
      <i className={styles.orbitPurple} />
      <span className={styles.orbitDotBlue} />
      <span className={styles.orbitDotPurple} />
      <b>回</b>
    </div>
  );
}

export default function HuixuApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [tab, setTab] = useState<Tab>("today");
  const [route, setRoute] = useState<RouteKey>("21");
  const [day, setDay] = useState(8);
  const [checkins, setCheckins] = useState<Checkin[]>(starterCheckins);
  const [note, setNote] = useState("");
  const [settled, setSettled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        setScreen(saved.screen ?? "welcome");
        setRoute(saved.route ?? "21");
        setDay(saved.day ?? 8);
        setCheckins(saved.checkins ?? starterCheckins);
        setNote(saved.note ?? "");
        setSettled(saved.settled ?? false);
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ screen, route, day, checkins, note, settled })
    );
  }, [screen, route, day, checkins, note, settled, hydrated]);

  const completed = useMemo(() => checkins.filter((item) => item.done).length, [checkins]);
  const currentRoute = routeInfo[route];

  function startRoute(key: RouteKey) {
    setRoute(key);
    setDay(1);
    setCheckins(starterCheckins.map((item) => ({ ...item, done: false })));
    setNote("");
    setSettled(false);
    setTab("today");
    setScreen("app");
  }

  function toggleCheckin(id: string) {
    if (settled) return;
    setCheckins((items) =>
      items.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  }

  function resetDemo() {
    localStorage.removeItem(storageKey);
    setScreen("welcome");
    setTab("today");
    setRoute("21");
    setDay(8);
    setCheckins(starterCheckins);
    setNote("");
    setSettled(false);
  }

  if (!hydrated) {
    return <main className={styles.loading} aria-label="正在打开回序"><BrandOrbit compact /></main>;
  }

  if (screen === "welcome") {
    return (
      <main className={styles.centerStage}>
        <section className={styles.welcome}>
          <div className={styles.brandTop}>
            <span>回序</span>
            <small>HUÍ XÙ</small>
          </div>
          <BrandOrbit />
          <div className={styles.welcomeCopy}>
            <p className={styles.eyebrow}>生活重启挑战系统</p>
            <h1>从混乱，<br />回到自己的节奏。</h1>
            <p className={styles.lead}>不需要一次改变所有事情。<br />从今天能承受的一件小事开始。</p>
          </div>
          <div className={styles.welcomeActions}>
            <button className={styles.primaryButton} onClick={() => setScreen("routes")}>
              开始探索
            </button>
            <button className={styles.textButton} onClick={() => setScreen("routes")}>
              直接选择路线
            </button>
          </div>
          <p className={styles.localNote}><span>◉</span> 你的记录默认只保存在这台设备上</p>
        </section>
      </main>
    );
  }

  if (screen === "routes") {
    return (
      <main className={styles.centerStage}>
        <section className={`${styles.phoneShell} ${styles.routeShell}`}>
          <header className={styles.pageHeader}>
            <button className={styles.iconButton} onClick={() => setScreen("welcome")} aria-label="返回">‹</button>
            <div>
              <p className={styles.eyebrow}>选择你的起点</p>
              <h1>现在，哪条路<br />更适合你？</h1>
            </div>
          </header>
          <div className={styles.routeList}>
            {(Object.keys(routeInfo) as RouteKey[]).map((key, index) => {
              const item = routeInfo[key];
              return (
                <article className={`${styles.routeCard} ${styles[`route${key}`]}`} key={key}>
                  <div className={styles.routeNumber}>0{index + 1}</div>
                  <div className={styles.routeMeta}>
                    <span>{item.days} DAYS</span>
                    <h2>{item.name}</h2>
                    <h3>{item.label}</h3>
                    <p>{item.description}</p>
                    <small>{item.structure}</small>
                  </div>
                  <button onClick={() => startRoute(key)} aria-label={`开始${item.name}`}>开始</button>
                </article>
              );
            })}
          </div>
          <button className={styles.recommendButton}>
            <span>还不确定？</span>
            完成2分钟状态自测
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.appStage}>
      <section className={styles.phoneShell}>
        {tab === "today" && (
          <div className={styles.screenContent}>
            <header className={styles.appHeader}>
              <div>
                <p>{currentRoute.name} · DAY {String(day).padStart(2, "0")}</p>
                <h1>{settled ? "今天已记录" : "今天"}</h1>
              </div>
              <button className={styles.sunButton} aria-label="页面设置">☼</button>
            </header>

            {settled ? (
              <section className={styles.settlement}>
                <div className={styles.settlementMark}>
                  <BrandOrbit compact />
                </div>
                <span className={styles.statusPill}>{completed >= 2 ? "稳定日" : "记录日"}</span>
                <h2>生活，回来了一点。</h2>
                <p>完成 {completed} 个今日行动 · {4 - completed} 项未完成</p>
                <div className={styles.miniSummary}>
                  {checkins.map((item) => (
                    <div key={item.id}>
                      <span>{item.icon}</span>
                      <b>{item.name}</b>
                      <i className={item.done ? styles.miniDone : ""}>{item.done ? "✓" : "○"}</i>
                    </div>
                  ))}
                </div>
                {note && <blockquote>“{note}”</blockquote>}
                <button className={styles.primaryButton} onClick={() => setTab("progress")}>查看当前进度</button>
                <button className={styles.textButton} onClick={() => setSettled(false)}>10分钟内撤销结算</button>
              </section>
            ) : (
              <>
                <WeekStrip />
                <div className={styles.sectionTitle}>
                  <div>
                    <span>今日打卡</span>
                    <small>{completed} / 4 已完成</small>
                  </div>
                  <p>完成两个锚点，就是一个稳定日</p>
                </div>
                <div className={styles.checkinStack}>
                  {checkins.map((item) => (
                    <button
                      key={item.id}
                      className={`${styles.checkinPanel} ${styles[item.tone]} ${item.done ? styles.checked : ""}`}
                      onClick={() => toggleCheckin(item.id)}
                      aria-pressed={item.done}
                    >
                      <span className={styles.checkinIcon}>{item.icon}</span>
                      <span className={styles.checkinText}>
                        <b>{item.name}</b>
                        <small>{item.detail}</small>
                      </span>
                      <span className={styles.checkCircle}>{item.done ? "✓" : ""}</span>
                    </button>
                  ))}
                </div>
                <label className={styles.noteField}>
                  <span>⌁</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="今天想留下什么？"
                    rows={1}
                  />
                </label>
                <button className={styles.primaryButton} onClick={() => setSettled(true)}>
                  完成今日记录
                </button>
              </>
            )}
          </div>
        )}

        {tab === "progress" && (
          <div className={styles.screenContent}>
            <header className={styles.appHeader}>
              <div>
                <p>{currentRoute.name}</p>
                <h1>进度</h1>
              </div>
              <button className={styles.sunButton} aria-label="查看日历">▦</button>
            </header>
            <section className={styles.progressHero}>
              <p>已经走过</p>
              <strong>{day}<span> / {currentRoute.days}</span></strong>
              <small>中断不会归零，从下一天继续就好</small>
            </section>
            <div className={styles.dayGrid}>
              {Array.from({ length: currentRoute.days }, (_, index) => {
                const n = index + 1;
                const state = n < day ? "done" : n === day ? "current" : "future";
                return <span key={n} className={styles[state]}>{n}</span>;
              })}
            </div>
            <div className={styles.statGrid}>
              <article><span>☼</span><p>稳定日</p><strong>{Math.max(1, day - 2)} <small>/ 15</small></strong></article>
              <article><span>◌</span><p>轮换挑战</p><strong>{Math.max(1, Math.ceil(day / 3))} <small>/ 5组</small></strong></article>
            </div>
            <article className={styles.insightCard}>
              <div className={styles.insightOrb} />
              <div><small>最近的观察</small><p>晚饭后的活动，最容易自然发生。</p></div>
            </article>
          </div>
        )}

        {tab === "records" && (
          <div className={styles.screenContent}>
            <header className={styles.appHeader}>
              <div><p>{currentRoute.name}</p><h1>记录</h1></div>
              <button className={styles.sunButton} aria-label="搜索记录">⌕</button>
            </header>
            <div className={styles.recordMonth}><span>‹</span><b>2026年7月</b><span>›</span></div>
            <div className={styles.recordTimeline}>
              {[8, 7, 6, 5].map((n, index) => (
                <article key={n}>
                  <div className={`${styles.timelineDot} ${index === 2 ? styles.partial : ""}`} />
                  <time>7月{20 + n}日</time>
                  <div>
                    <span>DAY {String(n).padStart(2, "0")} · {index === 2 ? "记录日" : "稳定日"}</span>
                    <h3>{["生活，回来了一点。", "留出20分钟安静时间", "今天只完成了一件事", "晚饭后散步25分钟"][index]}</h3>
                    <p>{index === 2 ? "完成1个锚点，其他内容按当时状态保存。" : "完成2个锚点，三日挑战已记录。"}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "me" && (
          <div className={styles.screenContent}>
            <header className={styles.appHeader}><div><p>本地优先</p><h1>我的</h1></div></header>
            <section className={styles.profileCard}>
              <BrandOrbit compact />
              <div><small>当前挑战</small><h2>{currentRoute.name}</h2><p>DAY {day} · 记录保存在这台设备</p></div>
            </section>
            <div className={styles.settingsGroup}>
              <button><span>◴</span><div><b>提醒与时间设置</b><small>起床范围、晚间收尾</small></div></button>
              <button><span>⇩</span><div><b>备份与恢复</b><small>尚未生成完整备份</small></div></button>
              <button onClick={() => setScreen("routes")}><span>⌁</span><div><b>查看全部路线</b><small>当前挑战会继续保留</small></div></button>
              <button onClick={resetDemo}><span>↺</span><div><b>重置产品演示</b><small>清除这台设备上的演示数据</small></div></button>
            </div>
          </div>
        )}

        <nav className={styles.tabBar} aria-label="主要导航">
          {([
            ["today", "◎", "今天"],
            ["progress", "◌", "进度"],
            ["records", "◇", "记录"],
            ["me", "○", "我的"],
          ] as [Tab, string, string][]).map(([key, icon, label]) => (
            <button key={key} className={tab === key ? styles.activeTab : ""} onClick={() => setTab(key)}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}

function WeekStrip() {
  const days = [
    ["一", "19"], ["二", "20"], ["三", "21"], ["四", "22"], ["五", "23"], ["六", "24"], ["日", "25"],
  ];
  return (
    <div className={styles.weekStrip}>
      {days.map(([week, date], index) => (
        <span key={date} className={index === 2 ? styles.todayDate : ""}><small>{week}</small><b>{date}</b></span>
      ))}
    </div>
  );
}
