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

type Screen = "welcome" | "routes" | "assessment" | "setup" | "app";
type Tab = "today" | "progress" | "records" | "me";

type Checkin = TaskDefinition & { done: boolean };
type Lifecycle = "preparing" | "active" | "paused" | "finished" | "ended";
type DailyRecord = {
  day: number;
  date: string;
  status: string;
  statusKey: string;
  counted: boolean;
  doneIds: string[];
  skippedIds?: string[];
  note: string;
  stage: string;
  taskNotes?: Record<string, string>;
  completedAt?: string;
  tasks?: TaskDefinition[];
};

type ChallengeSettings = {
  wakeStart: string;
  wakeEnd: string;
  showReading: boolean;
  showSkill: boolean;
};

type ChallengeArchive = {
  id: string;
  route: RouteKey;
  status: Lifecycle;
  startedAt: string;
  endedAt: string;
  history: DailyRecord[];
  settings: ChallengeSettings;
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
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
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
  const [pendingRoute, setPendingRoute] = useState<RouteKey>("21");
  const [challengeSettings, setChallengeSettings] = useState<ChallengeSettings>({
    wakeStart: "08:00",
    wakeEnd: "09:00",
    showReading: true,
    showSkill: true,
  });
  const [startChoice, setStartChoice] = useState<"today" | "tomorrow">("today");
  const [scheduledDate, setScheduledDate] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [archives, setArchives] = useState<ChallengeArchive[]>([]);
  const [recordMode, setRecordMode] = useState<"timeline" | "calendar">("timeline");
  const [recordFilter, setRecordFilter] = useState<"all" | "counted" | "not-counted">("all");
  const [undoUntil, setUndoUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [endingOpen, setEndingOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState<ChallengeArchive | null>(null);
  const [supplementText, setSupplementText] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const indexed = await readIndexedState();
        const raw = indexed ? JSON.stringify(indexed) : localStorage.getItem(storageKey);
        if (raw && active) {
          const saved = JSON.parse(raw);
          const savedRoute: RouteKey = saved.route ?? "21";
          const savedHistory: DailyRecord[] = saved.history ?? [];
          const savedDay = saved.day ?? 1;
          const canAdvanceByDate = saved.lifecycle === "active" && saved.startedAt;
          const elapsed = canAdvanceByDate ? Math.max(0, Math.floor((Date.now() - new Date(saved.startedAt).getTime()) / 86400000)) : 0;
          const targetDay = Math.min(routeInfo[savedRoute].days, Math.max(savedDay, elapsed + 1));
          const crossedDay = targetDay > savedDay;
          const missed = crossedDay ? Array.from({ length: targetDay - savedDay }, (_, index) => savedDay + index)
            .filter((missedDay) => !savedHistory.some((record) => record.day === missedDay))
            .map((missedDay) => ({
              day: missedDay,
              date: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(new Date(saved.startedAt).getTime() + (missedDay - 1) * 86400000)),
              status: "未记录",
              statusKey: "unrecorded",
              counted: false,
              doneIds: [],
              note: "",
              stage: getStageLabel(savedRoute, missedDay),
              tasks: missedDay === savedDay && saved.checkins
                ? saved.checkins.map(({ done: _done, ...task }: Checkin) => task)
                : getTasks(savedRoute, missedDay),
            } satisfies DailyRecord)) : [];
          setScreen(saved.screen ?? "welcome");
          setRoute(savedRoute);
          setDay(targetDay);
          setCheckins(crossedDay ? getTasks(savedRoute, targetDay).map((task) => ({ ...task, done: false })) : saved.checkins ?? getTasks(savedRoute, targetDay).map((task) => ({ ...task, done: false })));
          setNote(crossedDay ? "" : saved.note ?? "");
          setTaskNotes(crossedDay ? {} : saved.taskNotes ?? {});
          setSkippedIds(crossedDay ? [] : saved.skippedIds ?? []);
          setSettled(crossedDay ? false : saved.settled ?? false);
          setLifecycle(saved.lifecycle ?? "active");
          setHistory([...savedHistory, ...missed].sort((a, b) => a.day - b.day));
          setStartedAt(saved.startedAt ?? "");
          setReminder(saved.reminder ?? { morning: "08:00", evening: "22:30", enabled: false });
          setChallengeSettings(saved.challengeSettings ?? { wakeStart: "08:00", wakeEnd: "09:00", showReading: true, showSkill: true });
          setScheduledDate(saved.scheduledDate ?? "");
          setChallengeId(saved.challengeId ?? "");
          setArchives(saved.archives ?? []);
          setUndoUntil(crossedDay ? 0 : saved.undoUntil ?? 0);
        }
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const state = { screen, route, day, checkins, note, taskNotes, skippedIds, settled, lifecycle, history, startedAt, reminder, challengeSettings, scheduledDate, challengeId, archives, undoUntil, schemaVersion: 2 };
    localStorage.setItem(storageKey, JSON.stringify(state));
    void writeIndexedState(state);
  }, [screen, route, day, checkins, note, taskNotes, skippedIds, settled, lifecycle, history, startedAt, reminder, challengeSettings, scheduledDate, challengeId, archives, undoUntil, hydrated]);

  useEffect(() => {
    if (!undoUntil || undoUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [undoUntil]);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    if (!reminder.enabled || lifecycle !== "active" || !("Notification" in window) || Notification.permission !== "granted") return;
    const timers = [reminder.morning, reminder.evening].map((time, index) => {
      const [hour, minute] = time.split(":").map(Number);
      const target = new Date();
      target.setHours(hour, minute, 0, 0);
      if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
      return window.setTimeout(() => new Notification(index === 0 ? "回序 · 今天" : "回序 · 晚间收尾", {
        body: index === 0 ? "今天的挑战已经准备好，从能承受的一件事开始。" : "今天的记录还没有结束，需要时可以回来继续。",
      }), target.getTime() - Date.now());
    });
    return () => timers.forEach(window.clearTimeout);
  }, [reminder, lifecycle]);

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
  const optionalCounts = {
    reading: history.filter((record) => record.doneIds.includes("long-read")).length,
    skill: history.filter((record) => record.doneIds.includes("long-skill")).length,
  };
  const participatedGroups = new Set(history.flatMap((record) =>
    record.doneIds.filter((id) => id.startsWith("rotation-")).map(() => Math.floor((record.day - 1) / 3) + 1)
  )).size;
  const finalRequiredDone = route === "7"
    ? Boolean(taskNotes["clear-card"]?.trim())
    : route === "21"
      ? Boolean(taskNotes["rotation-prepare"]?.trim())
      : true;
  const challengePassed = route === "7"
    ? countedDays >= 5 && history.some((record) => record.day === 7 && record.doneIds.includes("clear-card") && record.taskNotes?.["clear-card"]?.trim())
    : route === "21"
      ? countedDays >= 15 && participatedGroups >= 5 && history.some((record) => record.day === 21 && record.doneIds.includes("rotation-prepare") && record.taskNotes?.["rotation-prepare"]?.trim())
      : countedDays >= 40;
  const filteredHistory = history.filter((record) => {
    const matchesText = `${record.stage}${record.status}${record.note}${Object.values(record.taskNotes ?? {}).join("")}`.toLowerCase().includes(recordQuery.trim().toLowerCase());
    const matchesStatus = recordFilter === "all" || (recordFilter === "counted" ? record.counted : !record.counted);
    return matchesText && matchesStatus;
  });
  const undoSeconds = Math.max(0, Math.ceil((undoUntil - now) / 1000));

  function configuredTasks(key: RouteKey, targetDay: number, settings = challengeSettings) {
    return getTasks(key, targetDay)
      .filter((task) => key !== "50" || task.id !== "long-read" || settings.showReading)
      .filter((task) => key !== "50" || task.id !== "long-skill" || settings.showSkill)
      .map((task) => task.id === "stable-wake" || task.id === "long-wake"
        ? { ...task, detail: `${settings.wakeStart}—${settings.wakeEnd} 内起床`, description: `在你设置的 ${settings.wakeStart}—${settings.wakeEnd} 时间范围内起床并离开床铺。` }
        : task);
  }

  function prepareRoute(key: RouteKey) {
    setPendingRoute(key);
    setScreen("setup");
  }

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
    const burden = assessmentScore.slice(0, 5).reduce((sum, value) => sum + value, 0);
    const stableBase = assessmentScore[5] ?? 1;
    const capacity = assessmentScore[6] ?? 1;
    const preference = assessmentScore[7];

    if (capacity === 2) return "7";
    if (capacity === 1) return burden >= 7 || stableBase === 2 ? "7" : "21";
    if (burden >= 8) return "7";
    if (burden <= 3 && stableBase === 0) return preference === 0 ? "21" : "50";
    if (preference === 2 && burden <= 5 && stableBase !== 2) return "50";
    if (preference === 0 && burden >= 5) return "7";
    return "21";
  }

  function exportBackup() {
    const data = localStorage.getItem(storageKey);
    if (!data) return showToast("还没有可备份的数据");
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `回序备份-${new Date().toISOString().slice(0, 10)}.huixu`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("备份文件已生成");
  }

  function exportMarkdown() {
    const lines = [
      `# 回序 · ${currentRoute.name}`,
      "",
      `开始时间：${startedAt ? new Date(startedAt).toLocaleString("zh-CN") : "尚未开始"}`,
      `当前进度：DAY ${day} / ${currentRoute.days}`,
      "",
      ...history.flatMap((record) => [
        `## ${record.date} · DAY ${String(record.day).padStart(2, "0")} · ${record.status}`,
        ...((record.tasks ?? getTasks(route, record.day)).map((task) => `- ${record.doneIds.includes(task.id) ? "已完成" : "未完成"}｜${task.name}${record.taskNotes?.[task.id] ? `：${record.taskNotes[task.id]}` : ""}`)),
        record.note ? `\n> ${record.note}` : "",
        "",
      ]),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `回序记录-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("阅读导出已生成");
  }

  function restoreBackup(file?: File) {
    if (!file) return;
    file.text().then((text) => {
      try {
        const saved = JSON.parse(text);
        if (!saved.route || !saved.checkins || !Array.isArray(saved.history)) throw new Error();
        const mode = window.prompt(`备份包含 ${saved.history.length} 条当前记录、${saved.archives?.length ?? 0} 轮归档。\n输入“合并”保留本机归档，输入“替换”使用备份覆盖。`, "合并");
        if (mode !== "合并" && mode !== "替换") return;
        const restored = mode === "合并"
          ? { ...saved, archives: [...(saved.archives ?? []), ...archives.filter((local) => !(saved.archives ?? []).some((remote: ChallengeArchive) => remote.id === local.id))] }
          : saved;
        localStorage.setItem(storageKey, JSON.stringify(restored));
        void writeIndexedState(restored).then(() => window.location.reload());
      } catch {
        showToast("这不是有效的回序备份");
      }
    });
  }

  function archiveCurrent(status: Lifecycle) {
    if (!challengeId || (!startedAt && history.length === 0)) return;
    setArchives((items) => [{
      id: challengeId,
      route,
      status,
      startedAt,
      endedAt: new Date().toISOString(),
      history,
      settings: challengeSettings,
    }, ...items.filter((item) => item.id !== challengeId)]);
  }

  function startRoute(key: RouteKey) {
    if (history.length || startedAt) archiveCurrent(lifecycle);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scheduled = startChoice === "tomorrow" ? tomorrow.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    setRoute(key);
    setChallengeId(`hx-${Date.now()}-${key}`);
    setScheduledDate(scheduled);
    setDay(1);
    setCheckins(configuredTasks(key, 1).map((item) => ({ ...item, done: false })));
    setNote("");
    setTaskNotes({});
    setSkippedIds([]);
    setSettled(false);
    setLifecycle(startChoice === "tomorrow" ? "preparing" : "active");
    setHistory([]);
    setStartedAt(startChoice === "today" ? new Date().toISOString() : "");
    setTab("today");
    setScreen("app");
  }

  function toggleCheckin(id: string) {
    if (settled || lifecycle !== "active") return;
    setCheckins((items) => {
      const target = items.find((item) => item.id === id);
      const nextDone = !target?.done;
      return items.map((item) => {
        if (item.id === id) return { ...item, done: nextDone };
        if (route === "7" && day === 4 && id === "clear-body" && item.id === "clear-anchor-body") {
          return { ...item, done: nextDone || item.done };
        }
        return item;
      });
    });
    setSkippedIds((items) => items.filter((item) => item !== id));
  }

  function markIncomplete(id: string) {
    if (settled || lifecycle !== "active") return;
    setCheckins((items) => items.map((item) => item.id === id ? { ...item, done: false } : item));
    setSkippedIds((items) => [...new Set([...items, id])]);
    setDetailTask(null);
  }

  function resetDemo() {
    localStorage.removeItem(storageKey);
    void clearIndexedState();
    setScreen("welcome");
    setTab("today");
    setRoute("21");
    setDay(8);
    setCheckins(getTasks("21", 8).map((task, index) => ({ ...task, done: index < 2 })));
    setNote("");
    setTaskNotes({});
    setSkippedIds([]);
    setSettled(false);
    setLifecycle("active");
    setHistory([]);
    setStartedAt("");
  }

  function settleToday() {
    if (((route === "7" && day === 7) || (route === "21" && day === 21)) && !finalRequiredDone) {
      showToast(route === "7" ? "请先写下你的回序卡" : "请先写下你的生活节奏卡");
      return;
    }
    const unanswered = checkins.filter((item) => !item.done && !skippedIds.includes(item.id));
    if (unanswered.length && !window.confirm(`还有 ${unanswered.length} 项没有选择。继续结算会将它们记录为“今天未完成”，是否继续？`)) return;
    const finalSkipped = [...new Set([...skippedIds, ...unanswered.map((item) => item.id)])];
    const result = getDayStatus(route, checkins.filter((item) => item.done).map((item) => item.id), day);
    const record: DailyRecord = {
      day,
      date: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date()),
      status: result.label,
      statusKey: result.key,
      counted: result.counted,
      doneIds: checkins.filter((item) => item.done).map((item) => item.id),
      skippedIds: finalSkipped,
      note,
      stage: getStageLabel(route, day),
      taskNotes,
      completedAt: new Date().toISOString(),
      tasks: checkins.map(({ done: _done, ...task }) => task),
    };
    setHistory((records) => [...records.filter((item) => item.day !== day), record].sort((a, b) => a.day - b.day));
    setSettled(true);
    setUndoUntil(Date.now() + 10 * 60 * 1000);
  }

  function advanceDay() {
    if (day >= currentRoute.days) {
      setLifecycle("finished");
      archiveCurrent("finished");
      setTab("progress");
      return;
    }
    const next = day + 1;
    setDay(next);
    setCheckins(configuredTasks(route, next).map((item) => ({ ...item, done: false })));
    setNote("");
    setTaskNotes({});
    setSkippedIds([]);
    setSettled(false);
    setTab("today");
  }

  function undoSettlement() {
    if (undoUntil <= Date.now()) return;
    setHistory((records) => records.filter((item) => item.day !== day));
    setSettled(false);
    setUndoUntil(0);
  }

  function beginPreparedChallenge() {
    setLifecycle("active");
    setStartedAt(new Date().toISOString());
    setScheduledDate(new Date().toISOString().slice(0, 10));
  }

  function endChallengeEarly() {
    archiveCurrent("ended");
    setLifecycle("ended");
    setEndingOpen(false);
    setTab("progress");
  }

  function addSupplement(record: DailyRecord) {
    if (!supplementText.trim()) return;
    const stamp = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
    setHistory((items) => items.map((item) => item.day === record.day ? { ...item, note: `${item.note}${item.note ? "\n\n" : ""}后来补记（${stamp}）：${supplementText.trim()}` } : item));
    setDetailRecord((current) => current ? { ...current, note: `${current.note}${current.note ? "\n\n" : ""}后来补记（${stamp}）：${supplementText.trim()}` } : current);
    setSupplementText("");
    showToast("补记已保存，原结果没有改变");
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
            <button className={styles.primaryButton} onClick={() => {
              setAssessmentStep(0);
              setAssessmentScore([]);
              setScreen("assessment");
            }}>
              开始探索
            </button>
            <button className={styles.textButton} onClick={() => setScreen("routes")}>
              直接开始挑战
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
                  <button onClick={() => prepareRoute(key)} aria-label={`开始${item.name}`}>选择</button>
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
              <button className={styles.primaryButton} onClick={() => prepareRoute(recommended)}>从这里开始</button>
              <button className={styles.textButton} onClick={() => setScreen("routes")}>仍然查看其他路线</button>
              <button className={styles.textButton} onClick={() => { setAssessmentStep(0); setAssessmentScore([]); }}>重新测试</button>
            </section>
          )}
        </section>
      </main>
    );
  }

  if (screen === "setup") {
    const selected = routeInfo[pendingRoute];
    return (
      <main className={styles.centerStage}>
        <section className={`${styles.phoneShell} ${styles.setupShell}`}>
          <header className={styles.pageHeader}>
            <button className={styles.iconButton} onClick={() => setScreen("routes")} aria-label="返回">‹</button>
            <div><p className={styles.eyebrow}>开始前设置</p><h1>把节奏设成<br />适合你的样子。</h1></div>
          </header>
          <section className={styles.setupRoute}>
            <small>{selected.days} DAYS</small>
            <h2>{selected.name}</h2>
            <p>{selected.description}</p>
          </section>
          {pendingRoute !== "7" && <div className={styles.setupGroup}>
            <div className={styles.setupTitle}><span>什么时候开始？</span><small>只生成正式开始后的挑战日</small></div>
            <div className={styles.segmented}>
              <button className={startChoice === "today" ? styles.segmentActive : ""} onClick={() => setStartChoice("today")}>今天</button>
              <button className={startChoice === "tomorrow" ? styles.segmentActive : ""} onClick={() => setStartChoice("tomorrow")}>明天</button>
            </div>
          </div>}
          <div className={styles.setupGroup}>
            <div className={styles.setupTitle}><span>你的起床范围</span><small>保持一小时，不要求越早越好</small></div>
            <div className={styles.wakeRange}>
              <label><span>从</span><input type="time" value={challengeSettings.wakeStart} onChange={(event) => {
                const start = event.target.value;
                const [hour, minute] = start.split(":").map(Number);
                const end = `${String((hour + 1) % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                setChallengeSettings({ ...challengeSettings, wakeStart: start, wakeEnd: end });
              }} /></label>
              <i>—</i>
              <label><span>到</span><input type="time" value={challengeSettings.wakeEnd} readOnly /></label>
            </div>
            <p className={styles.setupHint}>挑战开始后，“起居”将显示为：在 {challengeSettings.wakeStart}—{challengeSettings.wakeEnd} 内起床。</p>
          </div>
          {pendingRoute === "50" && (
            <div className={styles.setupGroup}>
              <div className={styles.setupTitle}><span>可选成长挑战</span><small>不参与每日达标判断</small></div>
              <label className={styles.optionRow}><span><b>阅读半小时</b><small>在今日页显示</small></span><input type="checkbox" checked={challengeSettings.showReading} onChange={(event) => setChallengeSettings({ ...challengeSettings, showReading: event.target.checked })} /></label>
              <label className={styles.optionRow}><span><b>学习新技能</b><small>在今日页显示</small></span><input type="checkbox" checked={challengeSettings.showSkill} onChange={(event) => setChallengeSettings({ ...challengeSettings, showSkill: event.target.checked })} /></label>
            </div>
          )}
          <div className={styles.setupActions}>
            <button className={styles.primaryButton} onClick={() => startRoute(pendingRoute)}>{startChoice === "today" ? "今天开始挑战" : "准备好，明天开始"}</button>
            <p>设置会保存在这台设备上，之后可以调整。</p>
          </div>
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

            {lifecycle === "preparing" ? (
              <section className={styles.pausePanel}>
                <BrandOrbit compact />
                <span>挑战准备中</span>
                <h2>{scheduledDate} 开始</h2>
                <p>第一天的内容已经准备好，正式开始前不会生成挑战记录。</p>
                <button className={styles.primaryButton} onClick={beginPreparedChallenge}>现在开始 DAY 01</button>
                <button className={styles.textButton} onClick={() => setScreen("routes")}>重新选择路线</button>
              </section>
            ) : lifecycle === "finished" || lifecycle === "ended" ? (
              <section className={styles.finishPanel}>
                <div className={styles.finishHalo}><BrandOrbit compact /></div>
                <span className={styles.statusPill}>{lifecycle === "ended" ? "已提前结束" : challengePassed ? "完成本轮挑战" : "本轮挑战已结束"}</span>
                <h2>{challengePassed ? "你把生活，带回了自己的手里。" : "结果没有被美化，但走过的路都在。"}</h2>
                <p>{challengePassed ? `${currentRoute.days} 天不是终点，而是一套可以再次回来的秩序。` : `这轮没有达到完成条件，${currentRoute.days} 天的全部记录仍会保留。`}</p>
                <div className={styles.finishStats}>
                  <div><strong>{countedDays}</strong><small>达标日</small></div>
                  <div><strong>{completionRate}%</strong><small>稳定率</small></div>
                  <div><strong>{longestStreak}</strong><small>最长连续</small></div>
                </div>
                {route === "50" && <p className={styles.optionalSummary}>阅读 {optionalCounts.reading} 次 · 技能学习 {optionalCounts.skill} 次</p>}
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
                <button className={styles.textButton} onClick={undoSettlement} disabled={undoSeconds === 0}>
                  {undoSeconds > 0 ? `${Math.floor(undoSeconds / 60)}:${String(undoSeconds % 60).padStart(2, "0")} 内可撤销结算` : "今日结果已锁定"}
                </button>
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
                      className={`${styles.checkinPanel} ${styles[item.tone]} ${item.done ? styles.checked : ""} ${skippedIds.includes(item.id) ? styles.skipped : ""}`}
                      onClick={() => toggleCheckin(item.id)}
                      aria-pressed={item.done}
                    >
                      <span className={styles.checkinIcon}>{item.icon}</span>
                      <span className={styles.checkinText}>
                        <b>{item.name}</b>
                        <small>{item.detail}</small>
                      </span>
                      <span className={styles.checkCircle}>{item.done ? "✓" : skippedIds.includes(item.id) ? "—" : ""}</span>
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
                return <button key={n} className={styles[state]} onClick={() => record && setDetailRecord(record)} disabled={!record}>{n}</button>;
              })}
            </div>
            <div className={styles.statGrid}>
              <article><span>☼</span><p>{route === "7" ? "完成日" : route === "21" ? "稳定日" : "累计达标"}</p><strong>{countedDays} <small>/ {route === "7" ? 5 : route === "21" ? 15 : 40}</small></strong></article>
              <article><span>◌</span><p>{route === "21" ? "参与轮换组" : "最长连续"}</p><strong>{route === "21" ? participatedGroups : longestStreak} <small>{route === "21" ? "/ 5组" : "天"}</small></strong></article>
            </div>
            {route === "50" && (
              <div className={styles.routeStats}>
                {[
                  ["全部完成日", history.filter((item) => item.statusKey === "full").length],
                  ["达标日", history.filter((item) => item.statusKey === "qualified").length],
                  ["记录日", history.filter((item) => item.statusKey === "recorded").length],
                  ["未达标日", history.filter((item) => item.statusKey === "incomplete").length],
                  ["阅读挑战", optionalCounts.reading],
                  ["技能学习", optionalCounts.skill],
                ].map(([label, value]) => <div key={label}><span>{label}</span><b>{value} 天</b></div>)}
              </div>
            )}
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
            <div className={styles.recordControls}>
              <div className={styles.segmented}><button className={recordMode === "timeline" ? styles.segmentActive : ""} onClick={() => setRecordMode("timeline")}>时间线</button><button className={recordMode === "calendar" ? styles.segmentActive : ""} onClick={() => setRecordMode("calendar")}>日历</button></div>
              <select value={recordFilter} onChange={(event) => setRecordFilter(event.target.value as typeof recordFilter)} aria-label="筛选记录">
                <option value="all">全部状态</option><option value="counted">已达标</option><option value="not-counted">未达标／未记录</option>
              </select>
            </div>
            <div className={styles.recordMonth}><span>‹</span><b>{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(new Date())}</b><span>›</span></div>
            {recordMode === "calendar" ? (
              <div className={styles.recordCalendar}>
                {Array.from({ length: currentRoute.days }, (_, index) => {
                  const record = filteredHistory.find((item) => item.day === index + 1);
                  return <button key={index} className={record?.counted ? styles.calendarDone : record ? styles.calendarPartial : ""} disabled={!record} onClick={() => record && setDetailRecord(record)}><small>DAY</small>{index + 1}</button>;
                })}
              </div>
            ) : <div className={styles.recordTimeline}>
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
            </div>}
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
                <button onClick={() => {
                  if (lifecycle === "active" && !settled && (completed > 0 || note.trim() || Object.keys(taskNotes).length)) {
                    showToast("今天已有内容，请先完成今日记录再暂停");
                    setTab("today");
                    return;
                  }
                  setLifecycle(lifecycle === "paused" ? "active" : "paused");
                }}>
                  <span>{lifecycle === "paused" ? "▶" : "Ⅱ"}</span>
                  <div><b>{lifecycle === "paused" ? "恢复挑战" : "暂停挑战"}</b><small>{lifecycle === "paused" ? "从当前挑战日继续" : "暂停期间不生成新的挑战日"}</small></div>
                </button>
              )}
              <button onClick={exportBackup}><span>⇩</span><div><b>导出完整备份</b><small>生成可恢复的本地文件</small></div></button>
              <button onClick={exportMarkdown}><span>≡</span><div><b>导出阅读记录</b><small>生成可查看的Markdown文件</small></div></button>
              <button onClick={() => importRef.current?.click()}><span>⇧</span><div><b>从备份恢复</b><small>选择此前导出的回序文件</small></div></button>
              <input ref={importRef} className={styles.hiddenInput} type="file" accept=".huixu,application/json,.json" onChange={(event) => restoreBackup(event.target.files?.[0])} />
              <button onClick={() => setScreen("routes")}><span>⌁</span><div><b>查看全部路线</b><small>当前挑战会继续保留</small></div></button>
              {lifecycle === "active" || lifecycle === "paused" ? <button onClick={() => setEndingOpen(true)}><span>□</span><div><b>提前结束这轮挑战</b><small>保留全部事实并生成归档</small></div></button> : null}
              {archives.map((item) => <button key={item.id} onClick={() => setArchiveOpen(item)}><span>◇</span><div><b>{routeInfo[item.route].name} · 已归档</b><small>{item.history.length}天记录 · {new Date(item.endedAt).toLocaleDateString("zh-CN")}</small></div></button>)}
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
                  {detailTask.id === "clear-card" && <div className={styles.cardPrompts}>最近最容易打乱生活的事 · 最有帮助的行动 · 想保留的身体动作 · 注意力边界 · 下次先做什么 · 最后只保留一件事</div>}
                  {detailTask.id === "rotation-prepare" && day === 21 && <div className={styles.cardPrompts}>适合的起床范围 · 最容易动起来的时机 · 有效的注意力边界 · 最有帮助的轮换行动 · 生活变乱时先恢复什么 · 接下来只保留一件事</div>}
                  <label className={styles.actionInput}>
                    <span>{detailTask.id === "clear-card" ? "我的回序卡" : detailTask.id === "rotation-prepare" && day === 21 ? "我的生活节奏卡" : "我实际做了什么"}</span>
                    <textarea
                      value={taskNotes[detailTask.id] ?? ""}
                      onChange={(event) => setTaskNotes({ ...taskNotes, [detailTask.id]: event.target.value })}
                      placeholder={detailTask.id === "clear-card" ? "写下最容易打乱你的事、最有帮助的行动，以及下次先做什么……" : "可以记录时间、内容或实际感受"}
                      rows={3}
                    />
                  </label>
                  <button className={styles.primaryButton} onClick={() => {
                    toggleCheckin(detailTask.id);
                    setDetailTask(null);
                  }}>{detailTask.done ? "取消完成" : "标记为完成"}</button>
                  {!detailTask.done && <button className={styles.textButton} onClick={() => markIncomplete(detailTask.id)}>今天未完成</button>}
                </>
              ) : detailRecord ? (
                <>
                  <small>DAY {String(detailRecord.day).padStart(2, "0")} · {detailRecord.date}</small>
                  <h2>{detailRecord.stage}</h2>
                  <span className={styles.statusPill}>{detailRecord.status}</span>
                  <div className={styles.recordTaskList}>
                    {(detailRecord.tasks ?? getTasks(route, detailRecord.day)).map((task) => (
                      <div key={task.id} className={detailRecord.doneIds.includes(task.id) ? styles.recordDone : ""}>
                        <span>{task.icon}</span><b>{task.name}<small>{detailRecord.taskNotes?.[task.id]}</small></b><i>{detailRecord.doneIds.includes(task.id) ? "✓" : detailRecord.skippedIds?.includes(task.id) ? "未完成" : "未记录"}</i>
                      </div>
                    ))}
                  </div>
                  {detailRecord.completedAt && <p className={styles.completedTime}>结算于 {new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(detailRecord.completedAt))}</p>}
                  {detailRecord.note && <blockquote>“{detailRecord.note}”</blockquote>}
                  <label className={styles.actionInput}><span>后来补记（不会修改当天结果）</span><textarea value={supplementText} onChange={(event) => setSupplementText(event.target.value)} rows={2} placeholder="补充当时的感受或细节" /></label>
                  <button className={styles.secondaryButton} onClick={() => addSupplement(detailRecord)}>保存补记</button>
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
                <input type="checkbox" checked={reminder.enabled} onChange={async (event) => {
                  const enabled = event.target.checked;
                  if (enabled && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
                  setReminder({ ...reminder, enabled: enabled && (!("Notification" in window) || Notification.permission === "granted") });
                  if (enabled && "Notification" in window && Notification.permission === "denied") showToast("通知权限未开启，时间设置仍会保存");
                }} />
              </label>
              <div className={styles.timeGrid}>
                <label><span>早晨开始</span><input type="time" value={reminder.morning} onChange={(event) => setReminder({ ...reminder, morning: event.target.value })} /></label>
                <label><span>晚间收尾</span><input type="time" value={reminder.evening} onChange={(event) => setReminder({ ...reminder, evening: event.target.value })} /></label>
              </div>
              {route !== "7" && (
                <div className={styles.inlineWakeSetting}>
                  <span>起床范围</span>
                  <div><input type="time" value={challengeSettings.wakeStart} onChange={(event) => {
                    const start = event.target.value;
                    const [hour, minute] = start.split(":").map(Number);
                    const end = `${String((hour + 1) % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                    setChallengeSettings({ ...challengeSettings, wakeStart: start, wakeEnd: end });
                  }} /><i>—</i><input type="time" value={challengeSettings.wakeEnd} readOnly /></div>
                </div>
              )}
              <button className={styles.primaryButton} onClick={() => {
                if (!settled) setCheckins((items) => items.map((item) => item.id === "stable-wake" || item.id === "long-wake"
                  ? { ...item, detail: `${challengeSettings.wakeStart}—${challengeSettings.wakeEnd} 内起床`, description: `在你设置的 ${challengeSettings.wakeStart}—${challengeSettings.wakeEnd} 时间范围内起床并离开床铺。` }
                  : item));
                setSettingsOpen(false);
                showToast("设置已保存");
              }}>保存设置</button>
            </section>
          </div>
        )}
        {endingOpen && (
          <div className={styles.sheetBackdrop} onClick={() => setEndingOpen(false)}>
            <section className={styles.detailSheet} role="dialog" aria-modal="true" aria-label="提前结束挑战" onClick={(event) => event.stopPropagation()}>
              <div className={styles.sheetHandle} /><small>结束与归档</small><h2>提前结束这轮挑战？</h2>
              <p>已经完成和未完成的事实都会保留，不会标记为失败，也不会从 Day 1 重置。</p>
              <button className={styles.primaryButton} onClick={endChallengeEarly}>保留记录并结束</button>
              <button className={styles.textButton} onClick={() => setEndingOpen(false)}>继续这轮挑战</button>
            </section>
          </div>
        )}
        {archiveOpen && (
          <div className={styles.sheetBackdrop} onClick={() => setArchiveOpen(null)}>
            <section className={styles.detailSheet} role="dialog" aria-modal="true" aria-label="挑战归档" onClick={(event) => event.stopPropagation()}>
              <div className={styles.sheetHandle} /><small>独立挑战档案</small><h2>{routeInfo[archiveOpen.route].name}</h2>
              <p>{archiveOpen.history.length} 天记录 · {archiveOpen.status === "finished" ? "自然结束" : archiveOpen.status === "ended" ? "提前结束" : "历史挑战"}</p>
              <div className={styles.recordTaskList}>
                {archiveOpen.history.map((record) => <div key={record.day} className={record.counted ? styles.recordDone : ""}><span>{record.counted ? "◆" : "◇"}</span><b>DAY {String(record.day).padStart(2, "0")}<small>{record.stage}</small></b><i>{record.status}</i></div>)}
              </div>
              <button className={styles.secondaryButton} onClick={() => setArchiveOpen(null)}>关闭</button>
            </section>
          </div>
        )}
        {toast && <div className={styles.toast} role="status">{toast}</div>}
      </section>
    </main>
  );
}

const assessmentQuestions = [
  { title: "最近两周，你的作息变化大吗？", hint: "这里不评价早晚，只看是否有相对稳定的范围。", answers: ["大多数时候比较稳定", "偶尔会相差几个小时", "经常昼夜颠倒或没有规律"] },
  { title: "你会因为混乱或疲惫，忽略基本照料吗？", hint: "例如吃饭、洗漱、更换衣物或补充生活用品。", answers: ["很少，基本能够照顾好", "有时会拖延或随便应付", "经常顾不上这些事情"] },
  { title: "常用空间现在处于什么状态？", hint: "想想床边、桌面、衣物区或经常使用的角落。", answers: ["基本可用，不太影响生活", "有些乱，但还能使用", "已经影响使用或让我持续烦躁"] },
  { title: "你会无意识地刷信息流多久？", hint: "包括短视频、推荐页、新闻流和无目的浏览。", answers: ["能够主动停下来", "经常比原计划刷得更久", "常常停不下来并挤占睡眠或正事"] },
  { title: "近期的小事和积压事项多吗？", hint: "看它们是否持续占据注意力，而不是事情本身大小。", answers: ["不多，通常能及时处理", "有一些，经常想起却没处理", "很多，已经不知道先做哪件"] },
  { title: "你现在还保有几个稳定锚点？", hint: "例如相近的起床时间、固定活动或晚间边界。", answers: ["至少有两个比较稳定", "大概还能保持一个", "几乎没有固定节奏"] },
  { title: "你每天能为挑战投入多少行动？", hint: "按当前真实精力选择，不按理想中的自己。", answers: ["能稳定完成5—6项行动", "能完成2—3项小行动", "目前只能承受1件小事"] },
  { title: "你此刻最希望先得到什么？", hint: "这一题用于修正推荐方向，不会限制你的选择。", answers: ["清理眼前阻力，重新启动", "建立几个可重复的节奏", "长期实践一套完整规则", "还不确定，希望系统判断"] },
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

function openHuixuDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open("huixu-local", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("state")) request.result.createObjectStore("state");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readIndexedState() {
  const db = await openHuixuDb();
  if (!db) return null;
  return new Promise<unknown>((resolve) => {
    const request = db.transaction("state", "readonly").objectStore("state").get("current");
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
  });
}

async function writeIndexedState(state: unknown) {
  const db = await openHuixuDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction("state", "readwrite");
    transaction.objectStore("state").put(state, "current");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

async function clearIndexedState() {
  const db = await openHuixuDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction("state", "readwrite");
    transaction.objectStore("state").delete("current");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}
