"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./huixu.module.css";
import {
  getDayStatus,
  getStageLabel,
  getTasks,
  routeInfo,
  type RouteKey,
  type TaskDefinition,
} from "./challengeData";

type Screen = "welcome" | "routes" | "assessment" | "app";
type Tab = "today" | "progress" | "records" | "me";

type Checkin = TaskDefinition & { done: boolean };
type Lifecycle = "active" | "paused" | "finished";
type DailyRecord = {
  day: number;
  date: string;
  status: string;
  statusKey: string;
  counted: boolean;
  doneIds: string[];
  note: string;
  stage: string;
};

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
  const [checkins, setCheckins] = useState<Checkin[]>(() =>
    getTasks("21", 8).map((task, index) => ({ ...task, done: index < 2 }))
  );
  const [note, setNote] = useState("");
  const [settled, setSettled] = useState(false);
  const [lifecycle, setLifecycle] = useState<Lifecycle>("active");
  const [history, setHistory] = useState<DailyRecord[]>([]);
  const [startedAt, setStartedAt] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [detailTask, setDetailTask] = useState<Checkin | null>(null);
  const [detailRecord, setDetailRecord] = useState<DailyRecord | null>(null);
  const [assessmentStep, setAssessmentStep] = useState(0);
  const [assessmentScore, setAssessmentScore] = useState<number[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recordQuery, setRecordQuery] = useState("");
  const [searchingRecords, setSearchingRecords] = useState(false);
  const [reminder, setReminder] = useState({ morning: "08:00", evening: "22:30", enabled: false });
  const [toast, setToast] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        setScreen(saved.screen ?? "welcome");
        setRoute(saved.route ?? "21");
        setDay(saved.day ?? 8);
        setCheckins(saved.checkins ?? getTasks("21", 8).map((task, index) => ({ ...task, done: index < 2 })));
        setNote(saved.note ?? "");
        setSettled(saved.settled ?? false);
        setLifecycle(saved.lifecycle ?? "active");
        setHistory(saved.history ?? []);
        setStartedAt(saved.startedAt ?? "");
        setReminder(saved.reminder ?? { morning: "08:00", evening: "22:30", enabled: false });
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ screen, route, day, checkins, note, settled, lifecycle, history, startedAt, reminder })
    );
  }, [screen, route, day, checkins, note, settled, lifecycle, history, startedAt, reminder, hydrated]);

  const completed = useMemo(() => checkins.filter((item) => item.done).length, [checkins]);
  const currentRoute = routeInfo[route];
  const dayStatus = useMemo(
    () => getDayStatus(route, checkins.filter((item) => item.done).map((item) => item.id), day),
    [route, checkins, day]
  );
  const countedDays = history.filter((record) => record.counted).length;
  const completionRate = history.length ? Math.round((countedDays / history.length) * 100) : 0;
  const longestStreak = useMemo(() => {
    let longest = 0;
    let current = 0;
    history.forEach((record) => {
      current = record.counted ? current + 1 : 0;
      longest = Math.max(longest, current);
    });
    return longest;
  }, [history]);
  const filteredHistory = history.filter((record) =>
    `${record.stage}${record.status}${record.note}`.toLowerCase().includes(recordQuery.trim().toLowerCase())
  );

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function answerAssessment(value: number) {
    const next = [...assessmentScore, value];
    setAssessmentScore(next);
    if (assessmentStep < assessmentQuestions.length - 1) setAssessmentStep((step) => step + 1);
  }

  function assessmentRoute(): RouteKey {
    const total = assessmentScore.reduce((sum, value) => sum + value, 0);
    return total <= 4 ? "50" : total <= 8 ? "21" : "7";
  }

  function exportBackup() {
    const data = localStorage.getItem(storageKey);
    if (!data) return showToast("还没有可备份的数据");
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `回序备份-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("备份文件已生成");
  }

  function restoreBackup(file?: File) {
    if (!file) return;
    file.text().then((text) => {
      try {
        const saved = JSON.parse(text);
        if (!saved.route || !saved.checkins || !Array.isArray(saved.history)) throw new Error();
        localStorage.setItem(storageKey, JSON.stringify(saved));
        window.location.reload();
      } catch {
        showToast("这不是有效的回序备份");
      }
    });
  }

  function startRoute(key: RouteKey) {
    setRoute(key);
    setDay(1);
    setCheckins(getTasks(key, 1).map((item) => ({ ...item, done: false })));
    setNote("");
    setSettled(false);
    setLifecycle("active");
    setHistory([]);
    setStartedAt(new Date().toISOString());
    setTab("today");
    setScreen("app");
  }

  function toggleCheckin(id: string) {
    if (settled || lifecycle !== "active") return;
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
    setCheckins(getTasks("21", 8).map((task, index) => ({ ...task, done: index < 2 })));
    setNote("");
    setSettled(false);
    setLifecycle("active");
    setHistory([]);
    setStartedAt("");
  }

  function settleToday() {
    const result = getDayStatus(route, checkins.filter((item) => item.done).map((item) => item.id), day);
    const record: DailyRecord = {
      day,
      date: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date()),
      status: result.label,
      statusKey: result.key,
      counted: result.counted,
      doneIds: checkins.filter((item) => item.done).map((item) => item.id),
      note,
      stage: getStageLabel(route, day),
    };
    setHistory((records) => [...records.filter((item) => item.day !== day), record].sort((a, b) => a.day - b.day));
    setSettled(true);
  }

  function advanceDay() {
    if (day >= currentRoute.days) {
      setLifecycle("finished");
      setTab("progress");
      return;
    }
    const next = day + 1;
    setDay(next);
    setCheckins(getTasks(route, next).map((item) => ({ ...item, done: false })));
    setNote("");
    setSettled(false);
    setTab("today");
  }

  function undoSettlement() {
    setHistory((records) => records.filter((item) => item.day !== day));
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
          <button className={styles.recommendButton} onClick={() => {
            setAssessmentStep(0);
            setAssessmentScore([]);
            setScreen("assessment");
          }}>
            <span>还不确定？</span>
            完成2分钟状态自测
          </button>
        </section>
      </main>
    );
  }

  if (screen === "assessment") {
    const finishedAssessment = assessmentScore.length === assessmentQuestions.length;
    const recommended = assessmentRoute();
    return (
      <main className={styles.centerStage}>
        <section className={`${styles.phoneShell} ${styles.assessmentShell}`}>
          <header className={styles.assessmentHeader}>
            <button className={styles.iconButton} onClick={() => setScreen("routes")} aria-label="返回">‹</button>
            <span>{finishedAssessment ? "完成" : `${assessmentStep + 1} / ${assessmentQuestions.length}`}</span>
          </header>
          {!finishedAssessment ? (
            <>
              <div className={styles.assessmentProgress}><i style={{ width: `${((assessmentStep + 1) / assessmentQuestions.length) * 100}%` }} /></div>
              <div className={styles.assessmentCopy}>
                <small>状态自测</small>
                <h1>{assessmentQuestions[assessmentStep].title}</h1>
                <p>{assessmentQuestions[assessmentStep].hint}</p>
              </div>
              <div className={styles.answerList}>
                {assessmentQuestions[assessmentStep].answers.map((answer, index) => (
                  <button key={answer} onClick={() => answerAssessment(index)}>
                    <span>{String.fromCharCode(65 + index)}</span>{answer}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <section className={styles.assessmentResult}>
              <BrandOrbit compact />
              <small>更适合你现在的起点</small>
              <h1>{routeInfo[recommended].name}</h1>
              <h2>{routeInfo[recommended].label}</h2>
              <p>{routeInfo[recommended].description} 这不是能力判断，只是帮你选择此刻更容易开始的坡度。</p>
              <button className={styles.primaryButton} onClick={() => startRoute(recommended)}>从这里开始</button>
              <button className={styles.textButton} onClick={() => { setAssessmentStep(0); setAssessmentScore([]); }}>重新测试</button>
            </section>
          )}
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
                <p>{currentRoute.name} · DAY {String(day).padStart(2, "0")} {lifecycle === "paused" ? "· 已暂停" : ""}</p>
                <h1>{lifecycle === "paused" ? "先停一会儿" : settled ? "今天已记录" : "今天"}</h1>
              </div>
              <button className={styles.sunButton} aria-label="提醒设置" onClick={() => setSettingsOpen(true)}>☼</button>
            </header>

            {lifecycle === "finished" ? (
              <section className={styles.finishPanel}>
                <div className={styles.finishHalo}><BrandOrbit compact /></div>
                <span className={styles.statusPill}>本轮挑战已完成</span>
                <h2>你把生活，带回了自己的手里。</h2>
                <p>{currentRoute.days} 天不是终点，而是一套可以再次回来的秩序。</p>
                <div className={styles.finishStats}>
                  <div><strong>{countedDays}</strong><small>达标日</small></div>
                  <div><strong>{completionRate}%</strong><small>稳定率</small></div>
                  <div><strong>{longestStreak}</strong><small>最长连续</small></div>
                </div>
                <button className={styles.primaryButton} onClick={() => setTab("records")}>回看这段旅程</button>
                <button className={styles.textButton} onClick={() => setScreen("routes")}>选择新的路线</button>
              </section>
            ) : lifecycle === "paused" ? (
              <section className={styles.pausePanel}>
                <BrandOrbit compact />
                <span>挑战已暂停</span>
                <h2>已经走到 DAY {String(day).padStart(2, "0")}</h2>
                <p>暂停期间不会生成新的挑战日。准备好以后，会从这里继续。</p>
                <button className={styles.primaryButton} onClick={() => setLifecycle("active")}>恢复这轮挑战</button>
                <button className={styles.textButton} onClick={() => setTab("records")}>查看已有记录</button>
              </section>
            ) : settled ? (
              <section className={styles.settlement}>
                <div className={styles.settlementMark}>
                  <BrandOrbit compact />
                </div>
                <span className={styles.statusPill}>{dayStatus.label}</span>
                <h2>生活，回来了一点。</h2>
                <p>完成 {completed} 个今日行动 · {checkins.length - completed} 项未完成</p>
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
                <button className={styles.primaryButton} onClick={advanceDay}>
                  {day >= currentRoute.days ? "完成这轮挑战" : `进入 DAY ${String(day + 1).padStart(2, "0")}`}
                </button>
                <button className={styles.textButton} onClick={undoSettlement}>10分钟内撤销结算</button>
              </section>
            ) : (
              <>
                <WeekStrip />
                <div className={styles.sectionTitle}>
                  <div>
                  <span>今日打卡</span>
                    <small>{completed} / {checkins.length} 已完成</small>
                  </div>
                  <p>{route === "7" ? "主挑战决定今天是否完成" : route === "21" ? "完成两个锚点，就是稳定日" : "六项中完成五项即可达标"}</p>
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
                      <span
                        className={styles.infoButton}
                        role="button"
                        tabIndex={0}
                        aria-label={`查看${item.name}说明`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDetailTask(item);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            setDetailTask(item);
                          }
                        }}
                      >···</span>
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
                <button className={styles.primaryButton} onClick={settleToday}>
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
              <button className={styles.sunButton} aria-label="回到今天" onClick={() => setTab("today")}>▦</button>
            </header>
            <section className={styles.progressHero}>
              <p>已经走过</p>
              <strong>{day}<span> / {currentRoute.days}</span></strong>
              <small>{currentRoute.target}</small>
            </section>
            <div className={styles.dayGrid}>
              {Array.from({ length: currentRoute.days }, (_, index) => {
                const n = index + 1;
                const record = history.find((item) => item.day === n);
                const state = record?.counted ? "done" : record ? "partial" : n === day ? "current" : "future";
                return <span key={n} className={styles[state]}>{n}</span>;
              })}
            </div>
            <div className={styles.statGrid}>
              <article><span>☼</span><p>{route === "7" ? "完成日" : route === "21" ? "稳定日" : "累计达标"}</p><strong>{countedDays} <small>/ {route === "7" ? 5 : route === "21" ? 15 : 40}</small></strong></article>
              <article><span>◌</span><p>最长连续</p><strong>{longestStreak} <small>天</small></strong></article>
            </div>
            <article className={styles.insightCard}>
              <div className={styles.insightOrb} />
              <div><small>当前阶段</small><p>{getStageLabel(route, day)} · 中断不会让已有记录归零。</p></div>
            </article>
          </div>
        )}

        {tab === "records" && (
          <div className={styles.screenContent}>
            <header className={styles.appHeader}>
              <div><p>{currentRoute.name}</p><h1>记录</h1></div>
              <button className={styles.sunButton} aria-label="搜索记录" onClick={() => setSearchingRecords((value) => !value)}>⌕</button>
            </header>
            {searchingRecords && (
              <label className={styles.searchField}>
                <span>⌕</span>
                <input autoFocus value={recordQuery} onChange={(event) => setRecordQuery(event.target.value)} placeholder="搜索阶段、状态或文字记录" />
                {recordQuery && <button onClick={() => setRecordQuery("")}>×</button>}
              </label>
            )}
            <div className={styles.recordMonth}><span>‹</span><b>2026年7月</b><span>›</span></div>
            <div className={styles.recordTimeline}>
              {filteredHistory.length === 0 && <div className={styles.emptyState}>{history.length ? "没有找到相关记录。" : "第一条记录会在你完成今日结算后出现在这里。"}</div>}
              {[...filteredHistory].reverse().map((record) => (
                <article key={record.day} className={styles.recordItem} onClick={() => setDetailRecord(record)}>
                  <div className={`${styles.timelineDot} ${!record.counted ? styles.partial : ""}`} />
                  <time>{record.date}</time>
                  <div>
                    <span>DAY {String(record.day).padStart(2, "0")} · {record.status}</span>
                    <h3>{record.stage}</h3>
                    <p>{record.note || `完成${record.doneIds.length}项，其他内容按当时状态保存。`}</p>
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
              <div><small>{lifecycle === "paused" ? "已暂停" : lifecycle === "finished" ? "已结束" : "当前挑战"}</small><h2>{currentRoute.name}</h2><p>DAY {day} · {history.length}天记录保存在本机</p></div>
            </section>
            <div className={styles.settingsGroup}>
              <button onClick={() => setSettingsOpen(true)}><span>◴</span><div><b>提醒与时间设置</b><small>{reminder.enabled ? `${reminder.morning} · ${reminder.evening}` : "当前未开启"}</small></div></button>
              {lifecycle !== "finished" && (
                <button onClick={() => setLifecycle(lifecycle === "paused" ? "active" : "paused")}>
                  <span>{lifecycle === "paused" ? "▶" : "Ⅱ"}</span>
                  <div><b>{lifecycle === "paused" ? "恢复挑战" : "暂停挑战"}</b><small>{lifecycle === "paused" ? "从当前挑战日继续" : "暂停期间不生成新的挑战日"}</small></div>
                </button>
              )}
              <button onClick={exportBackup}><span>⇩</span><div><b>导出完整备份</b><small>生成可恢复的本地文件</small></div></button>
              <button onClick={() => importRef.current?.click()}><span>⇧</span><div><b>从备份恢复</b><small>选择此前导出的回序文件</small></div></button>
              <input ref={importRef} className={styles.hiddenInput} type="file" accept="application/json,.json" onChange={(event) => restoreBackup(event.target.files?.[0])} />
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

        {(detailTask || detailRecord) && (
          <div className={styles.sheetBackdrop} onClick={() => { setDetailTask(null); setDetailRecord(null); }}>
            <section className={styles.detailSheet} role="dialog" aria-modal="true" aria-label={detailTask ? "行动说明" : "记录详情"} onClick={(event) => event.stopPropagation()}>
              <div className={styles.sheetHandle} />
              {detailTask ? (
                <>
                  <div className={`${styles.sheetIcon} ${styles[detailTask.tone]}`}>{detailTask.icon}</div>
                  <small>{detailTask.category === "anchor" ? "稳定锚点" : detailTask.category === "optional" ? "可选挑战" : "今日行动"}</small>
                  <h2>{detailTask.name}</h2>
                  <p>{detailTask.description}</p>
                  <div className={styles.sheetTip}><span>建议</span>只需要完成最低标准，不必把一次行动做成新的压力。</div>
                  <button className={styles.primaryButton} onClick={() => {
                    toggleCheckin(detailTask.id);
                    setDetailTask(null);
                  }}>{detailTask.done ? "取消完成" : "标记为完成"}</button>
                </>
              ) : detailRecord ? (
                <>
                  <small>DAY {String(detailRecord.day).padStart(2, "0")} · {detailRecord.date}</small>
                  <h2>{detailRecord.stage}</h2>
                  <span className={styles.statusPill}>{detailRecord.status}</span>
                  <div className={styles.recordTaskList}>
                    {getTasks(route, detailRecord.day).map((task) => (
                      <div key={task.id} className={detailRecord.doneIds.includes(task.id) ? styles.recordDone : ""}>
                        <span>{task.icon}</span><b>{task.name}</b><i>{detailRecord.doneIds.includes(task.id) ? "✓" : "—"}</i>
                      </div>
                    ))}
                  </div>
                  {detailRecord.note && <blockquote>“{detailRecord.note}”</blockquote>}
                  <button className={styles.secondaryButton} onClick={() => setDetailRecord(null)}>关闭</button>
                </>
              ) : null}
            </section>
          </div>
        )}
        {settingsOpen && (
          <div className={styles.sheetBackdrop} onClick={() => setSettingsOpen(false)}>
            <section className={styles.detailSheet} role="dialog" aria-modal="true" aria-label="提醒设置" onClick={(event) => event.stopPropagation()}>
              <div className={styles.sheetHandle} />
              <small>温柔提醒</small>
              <h2>为一天设置边界</h2>
              <p>回序只记录你选择的时间，不会强制打断你。浏览器提醒将在后续原生版本接入。</p>
              <label className={styles.toggleRow}>
                <span><b>启用提醒时段</b><small>保存起床与晚间收尾时间</small></span>
                <input type="checkbox" checked={reminder.enabled} onChange={(event) => setReminder({ ...reminder, enabled: event.target.checked })} />
              </label>
              <div className={styles.timeGrid}>
                <label><span>早晨开始</span><input type="time" value={reminder.morning} onChange={(event) => setReminder({ ...reminder, morning: event.target.value })} /></label>
                <label><span>晚间收尾</span><input type="time" value={reminder.evening} onChange={(event) => setReminder({ ...reminder, evening: event.target.value })} /></label>
              </div>
              <button className={styles.primaryButton} onClick={() => { setSettingsOpen(false); showToast("提醒时间已保存"); }}>保存设置</button>
            </section>
          </div>
        )}
        {toast && <div className={styles.toast} role="status">{toast}</div>}
      </section>
    </main>
  );
}

const assessmentQuestions = [
  { title: "最近，你的生活有多乱？", hint: "选择最接近最近一周的状态。", answers: ["只是有点散，需要重新整理", "作息和行动经常失控", "已经很难开始任何事情"] },
  { title: "你现在能稳定投入多少精力？", hint: "不用选择理想状态，只看此刻。", answers: ["每天能留出一段完整时间", "能完成几件固定小事", "只能从一件很小的事开始"] },
  { title: "面对连续挑战，你更担心什么？", hint: "答案不会影响评价，只用于匹配坡度。", answers: ["内容太少，看不到变化", "坚持几天后中断", "第一天就压力太大"] },
  { title: "你希望这次改变带来什么？", hint: "选一个现在最重要的方向。", answers: ["建立长期而完整的生活结构", "先拥有一套稳定日常", "尽快清理混乱、重新启动"] },
];

function WeekStrip() {
  const today = new Date();
  const monday = new Date(today);
  const offset = (today.getDay() + 6) % 7;
  monday.setDate(today.getDate() - offset);
  const labels = ["一", "二", "三", "四", "五", "六", "日"];
  const days = labels.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return [label, String(date.getDate()), date.toDateString() === today.toDateString()] as const;
  });
  return (
    <div className={styles.weekStrip}>
      {days.map(([week, date, isToday]) => (
        <span key={`${week}-${date}`} className={isToday ? styles.todayDate : ""}><small>{week}</small><b>{date}</b></span>
      ))}
    </div>
  );
}
