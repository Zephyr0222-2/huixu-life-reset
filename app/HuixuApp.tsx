"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import styles from "./huixu.module.css";
import {
  getDayStatus,
  getStageLabel,
  getTasks,
  encouragements,
  rulesVersion,
  routeDetails,
  routeInfo,
  type RouteKey,
  type TaskDefinition,
} from "./challengeData";

type Screen = "welcome" | "routes" | "assessment" | "setup" | "about" | "feedback" | "app";
type Tab = "today" | "progress" | "records" | "history" | "me";

type Checkin = TaskDefinition & { done: boolean };
type Lifecycle = "preparing" | "active" | "paused" | "finished" | "ended";
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
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
  rulesVersion?: number;
};

type ChallengeSettings = {
  wakeStart: string;
  wakeEnd: string;
};

type ChallengeArchive = {
  id: string;
  route: RouteKey;
  status: Lifecycle;
  startedAt: string;
  endedAt: string;
  history: DailyRecord[];
  settings: ChallengeSettings;
  rulesVersion?: number;
};

const storageKey = "huixu-v1-state";
const feedbackUrl = "https://ucn5152u7qk7.feishu.cn/share/base/form/shrcnFBlXn4XxkRGsAdwJx06C2f";

function localDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function calendarDayDifference(start: string | Date, end: string | Date) {
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;
  const startDay = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.max(0, Math.floor((endDay - startDay) / 86400000));
}

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
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [toast, setToast] = useState("");
  const [pendingRoute, setPendingRoute] = useState<RouteKey>("21");
  const [challengeSettings, setChallengeSettings] = useState<ChallengeSettings>({
    wakeStart: "08:00",
    wakeEnd: "09:00",
  });
  const [startChoice, setStartChoice] = useState<"today" | "tomorrow">("today");
  const [scheduledDate, setScheduledDate] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [archives, setArchives] = useState<ChallengeArchive[]>([]);
  const [recordMode, setRecordMode] = useState<"timeline" | "calendar">("timeline");
  const [recordFilter, setRecordFilter] = useState<"all" | "counted" | "not-counted">("all");
  const [recordMonthCursor, setRecordMonthCursor] = useState(() => localDateKey(new Date()).slice(0, 7));
  const [undoUntil, setUndoUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [endingOpen, setEndingOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState<ChallengeArchive | null>(null);
  const [archiveRecordOpen, setArchiveRecordOpen] = useState<DailyRecord | null>(null);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [challengeRulesVersion, setChallengeRulesVersion] = useState(rulesVersion);
  const [analyticsConsent, setAnalyticsConsent] = useState<"pending" | "accepted" | "declined">("pending");
  const [analyticsPromptSeen, setAnalyticsPromptSeen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [appInstalled, setAppInstalled] = useState(false);
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [clearDataAcknowledged, setClearDataAcknowledged] = useState(false);
  const [routesFromApp, setRoutesFromApp] = useState(false);
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
          const elapsed = canAdvanceByDate ? calendarDayDifference(saved.startedAt, new Date()) : 0;
          const targetDay = Math.min(routeInfo[savedRoute].days, Math.max(savedDay, elapsed + 1));
          const crossedDay = targetDay > savedDay;
          const savedCheckins: Checkin[] = saved.checkins ?? getTasks(savedRoute, savedDay).map((task) => ({ ...task, done: false }));
          const savedDoneIds = savedCheckins.filter((item) => item.done).map((item) => item.id);
          const savedHasContent = savedDoneIds.length > 0 || Boolean(saved.note?.trim()) || Object.keys(saved.taskNotes ?? {}).length > 0 || (saved.skippedIds ?? []).length > 0;
          const savedResult = getDayStatus(savedRoute, savedDoneIds, savedDay);
          const missed = crossedDay ? Array.from({ length: targetDay - savedDay }, (_, index) => savedDay + index)
            .filter((missedDay) => !savedHistory.some((record) => record.day === missedDay))
            .map((missedDay) => {
              const recordDate = new Date(saved.startedAt);
              recordDate.setDate(recordDate.getDate() + missedDay - 1);
              const isCurrentSavedDay = missedDay === savedDay;
              if (isCurrentSavedDay && savedHasContent) {
                return {
                  day: missedDay,
                  date: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(recordDate),
                  status: savedResult.label || "未完成日",
                  statusKey: savedResult.key,
                  counted: savedResult.counted,
                  doneIds: savedDoneIds,
                  skippedIds: savedCheckins.filter((item) => !item.done).map((item) => item.id),
                  note: saved.note ?? "",
                  stage: getStageLabel(savedRoute, missedDay),
                  taskNotes: saved.taskNotes ?? {},
                  tasks: savedCheckins.map(({ done: _done, ...task }) => task),
                  rulesVersion: saved.challengeRulesVersion ?? 1,
                } satisfies DailyRecord;
              }
              return {
                day: missedDay,
                date: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(recordDate),
                status: "未记录",
                statusKey: "unrecorded",
                counted: false,
                doneIds: [],
                note: "",
                stage: getStageLabel(savedRoute, missedDay),
                tasks: isCurrentSavedDay ? savedCheckins.map(({ done: _done, ...task }) => task) : getTasks(savedRoute, missedDay),
              } satisfies DailyRecord;
            }) : [];
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
          setChallengeSettings(saved.challengeSettings ?? { wakeStart: "08:00", wakeEnd: "09:00" });
          setScheduledDate(saved.scheduledDate ?? "");
          setChallengeId(saved.challengeId ?? "");
          setArchives(saved.archives ?? []);
          setChallengeRulesVersion(saved.challengeRulesVersion ?? 1);
          setAnalyticsConsent(saved.analyticsConsent ?? "pending");
          setAnalyticsPromptSeen(saved.analyticsPromptSeen ?? false);
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
    const state = { screen, route, day, checkins, note, taskNotes, skippedIds, settled, lifecycle, history, startedAt, reminder, challengeSettings, scheduledDate, challengeId, archives, undoUntil, challengeRulesVersion, analyticsConsent, analyticsPromptSeen, schemaVersion: 4 };
    localStorage.setItem(storageKey, JSON.stringify(state));
    void writeIndexedState(state);
  }, [screen, route, day, checkins, note, taskNotes, skippedIds, settled, lifecycle, history, startedAt, reminder, challengeSettings, scheduledDate, challengeId, archives, undoUntil, challengeRulesVersion, analyticsConsent, analyticsPromptSeen, hydrated]);

  useEffect(() => {
    if (!hydrated || lifecycle !== "active" || !startedAt || day >= routeInfo[route].days) return;
    let timer = 0;
    const advanceWhenDateChanges = () => {
      const expectedDay = Math.min(routeInfo[route].days, calendarDayDifference(startedAt, new Date()) + 1);
      if (expectedDay > day) {
        window.location.reload();
        return true;
      }
      return false;
    };
    const scheduleMidnightCheck = () => {
      window.clearTimeout(timer);
      if (advanceWhenDateChanges()) return;
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 0, 750);
      timer = window.setTimeout(scheduleMidnightCheck, nextMidnight.getTime() - Date.now());
    };
    const resume = () => { if (document.visibilityState === "visible") scheduleMidnightCheck(); };
    scheduleMidnightCheck();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [hydrated, lifecycle, startedAt, day, route]);

  useEffect(() => {
    if (!undoUntil || undoUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [undoUntil]);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    setNotificationPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setAppInstalled(standalone);
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => { setAppInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  useEffect(() => {
    if (!reminder.enabled || lifecycle !== "active" || !("Notification" in window) || Notification.permission !== "granted") return;
    let timer = 0;
    const entries = [
      { kind: "morning" as const, time: reminder.morning },
      { kind: "evening" as const, time: reminder.evening },
    ];
    const occurrence = (time: string, dayOffset = 0) => {
      const [hour, minute] = time.split(":").map(Number);
      const target = new Date();
      target.setDate(target.getDate() + dayOffset);
      target.setHours(hour, minute, 0, 0);
      return target;
    };
    const sentKey = (kind: "morning" | "evening", target: Date) => `huixu-reminder-${localDateKey(target)}-${kind}`;
    const deliver = async (kind: "morning" | "evening", target: Date) => {
      const key = sentKey(kind, target);
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, new Date().toISOString());
      try {
        await showReminderNotification(kind);
      } catch {
        localStorage.removeItem(key);
      }
    };
    const schedule = () => {
      window.clearTimeout(timer);
      const now = Date.now();
      const gracePeriod = 30 * 60 * 1000;
      const due = entries
        .map((entry) => ({ ...entry, target: occurrence(entry.time) }))
        .find((entry) => now >= entry.target.getTime() && now - entry.target.getTime() <= gracePeriod && !localStorage.getItem(sentKey(entry.kind, entry.target)));
      if (due) {
        void deliver(due.kind, due.target).finally(schedule);
        return;
      }
      const next = entries
        .flatMap((entry) => [0, 1].map((offset) => ({ ...entry, target: occurrence(entry.time, offset) })))
        .filter((entry) => entry.target.getTime() > now && !localStorage.getItem(sentKey(entry.kind, entry.target)))
        .sort((a, b) => a.target.getTime() - b.target.getTime())[0];
      if (!next) return;
      timer = window.setTimeout(() => void deliver(next.kind, next.target).finally(schedule), Math.min(next.target.getTime() - now, 2147483647));
    };
    const resume = () => { if (document.visibilityState === "visible") schedule(); };
    schedule();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [reminder, lifecycle]);

  const completed = useMemo(() => checkins.filter((item) => item.done).length, [checkins]);
  const baseCompleted = useMemo(() => checkins.filter((item) => item.category === "base" && item.done).length, [checkins]);
  const optionalTodayCompleted = useMemo(() => checkins.filter((item) => item.category === "optional" && item.done).length, [checkins]);
  const todayCompleted = route === "50" ? baseCompleted : completed;
  const todayTotal = route === "50" ? 5 : checkins.length;
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
  const optionalCount = history.reduce((sum, record) => sum + record.doneIds.filter((id) => ["long-read", "long-skill", "long-stream", "long-awareness", "long-create"].includes(id)).length, 0);
  const additionalCount = history.filter((record) => record.doneIds.some((id) => id.startsWith("rotation-"))).length;
  const finalRequiredDone = route === "7"
    ? Boolean(taskNotes["clear-card"]?.trim())
    : route === "21" && challengeRulesVersion < 2
      ? Boolean(taskNotes["rotation-prepare"]?.trim())
      : true;
  const challengePassed = route === "7"
    ? countedDays >= 5 && history.some((record) => record.day === 7 && record.doneIds.includes("clear-card") && record.taskNotes?.["clear-card"]?.trim())
    : route === "21"
      ? countedDays >= 15 && additionalCount >= 15
      : countedDays >= 40;
  const filteredHistory = history.filter((record) => {
    const matchesText = `${record.stage}${record.status}${record.note}${Object.values(record.taskNotes ?? {}).join("")}`.toLowerCase().includes(recordQuery.trim().toLowerCase());
    const matchesStatus = recordFilter === "all" || (recordFilter === "counted" ? record.counted : !record.counted);
    return matchesText && matchesStatus;
  });
  const undoSeconds = Math.max(0, Math.ceil((undoUntil - now) / 1000));
  const analyticsAvailable = typeof window !== "undefined" && Boolean((window as Window & { umami?: unknown }).umami);
  const calendarCursor = new Date(`${recordMonthCursor}-01T12:00:00`);
  const calendarOffset = (calendarCursor.getDay() + 6) % 7;
  const calendarDays = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0).getDate();
  const calendarRecords = useMemo(() => {
    const map = new Map<string, DailyRecord>();
    filteredHistory.forEach((record) => {
      if (record.completedAt) map.set(localDateKey(record.completedAt), record);
      else if (startedAt) {
        const date = new Date(startedAt);
        date.setDate(date.getDate() + record.day - 1);
        map.set(localDateKey(date), record);
      }
    });
    return map;
  }, [filteredHistory, startedAt]);

  function configuredTasks(key: RouteKey, targetDay: number, settings = challengeSettings) {
    return getTasks(key, targetDay)
      .map((task) => task.id === "stable-wake" || task.id === "long-wake"
        ? { ...task, detail: `${settings.wakeStart}—${settings.wakeEnd} 内起床`, description: `在你设置的 ${settings.wakeStart}—${settings.wakeEnd} 时间范围内起床并离开床铺。` }
        : task);
  }

  function prepareRoute(key: RouteKey) {
    setPendingRoute(key);
    setScreen("setup");
  }

  function browseOtherRoutes() {
    setRoutesFromApp(true);
    setScreen("routes");
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function requestReminderPermission() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotificationPermission("unsupported");
      showToast("当前浏览器不支持系统提醒；iPhone 请先把回序添加到主屏幕");
      return false;
    }
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setNotificationPermission(permission);
    if (permission === "denied") showToast("通知权限已关闭，请在系统或浏览器设置中允许回序通知");
    return permission === "granted";
  }

  async function showReminderNotification(kind: "morning" | "evening" | "test") {
    const registration = await navigator.serviceWorker.ready;
    const isEvening = kind === "evening";
    await registration.showNotification(kind === "test" ? "回序 · 测试提醒" : isEvening ? "回序 · 晚间收尾" : "回序 · 今天", {
      body: kind === "test" ? "系统提醒已成功开启。之后会按你设置的时间出现。" : isEvening ? "今天的记录还没有结束，需要时可以回来继续。" : "今天的挑战已经准备好，从能承受的一件事开始。",
      icon: "/icon-v2-192.png",
      badge: "/icon-v2-192.png",
      tag: `huixu-${kind}`,
      data: { url: "/" },
    });
  }

  async function sendTestReminder() {
    if (!(await requestReminderPermission())) return;
    try {
      await showReminderNotification("test");
      showToast("测试提醒已发送");
    } catch {
      showToast("测试提醒发送失败，请重新打开回序后再试");
    }
  }

  function trackAnonymousEvent(name: string, data: Record<string, string | number> = {}) {
    if (analyticsConsent !== "accepted") return;
    const tracker = (window as Window & { umami?: { track: (event: string, value?: Record<string, string | number>) => void } }).umami;
    tracker?.track(name, data);
  }

  function answerAssessment(value: number) {
    const next = [...assessmentScore, value];
    setAssessmentScore(next);
    if (assessmentStep < assessmentQuestions.length - 1) setAssessmentStep((step) => step + 1);
  }

  function previousAssessment() {
    if (!assessmentScore.length) return;
    const onResult = assessmentScore.length === assessmentQuestions.length;
    setAssessmentScore((scores) => scores.slice(0, -1));
    setAssessmentStep((step) => Math.max(0, step - (onResult ? 0 : 1)));
  }

  async function installApp() {
    if (appInstalled) return showToast("回序已经安装到这台设备");
    if (!installPrompt) {
      setInstallGuideOpen(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setAppInstalled(true);
    setInstallPrompt(null);
  }

  function changeRecordMonth(offset: number) {
    const next = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + offset, 1, 12);
    setRecordMonthCursor(localDateKey(next).slice(0, 7));
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
    trackAnonymousEvent("backup_exported", { route });
  }

  function downloadMarkdown(lines: string[], filename: string) {
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
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
    downloadMarkdown(lines, `回序记录-${new Date().toISOString().slice(0, 10)}.md`);
    showToast("阅读导出已生成");
    trackAnonymousEvent("markdown_exported", { route });
  }

  function exportArchiveMarkdown(archive: ChallengeArchive) {
    const info = routeInfo[archive.route];
    const lines = [
      `# 回序 · ${info.name}`,
      "",
      `挑战时间：${new Date(archive.startedAt).toLocaleDateString("zh-CN")} — ${new Date(archive.endedAt).toLocaleDateString("zh-CN")}`,
      `挑战结果：${archive.status === "finished" ? "自然结束" : archive.status === "ended" ? "提前结束" : "已归档"}`,
      "",
      ...archive.history.flatMap((record) => [
        `## ${record.date} · DAY ${String(record.day).padStart(2, "0")} · ${record.status}`,
        ...((record.tasks ?? getTasks(archive.route, record.day)).map((task) => `- ${record.doneIds.includes(task.id) ? "已完成" : "未完成"}｜${task.name}${record.taskNotes?.[task.id] ? `：${record.taskNotes[task.id]}` : ""}`)),
        record.note ? `\n> ${record.note}` : "",
        "",
      ]),
    ];
    downloadMarkdown(lines, `回序-${info.name}-${archive.startedAt.slice(0, 10)}.md`);
    showToast("历史挑战 Markdown 已生成");
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
      rulesVersion: challengeRulesVersion,
    }, ...items.filter((item) => item.id !== challengeId)]);
  }

  function startRoute(key: RouteKey) {
    if (routesFromApp && (history.length || startedAt)) {
      if (!window.confirm("开启新路线会结束并归档当前挑战。是否继续？")) {
        setScreen("app");
        return;
      }
      archiveCurrent("ended");
    } else if (history.length || startedAt) archiveCurrent(lifecycle);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const effectiveStart = startChoice;
    const scheduled = effectiveStart === "tomorrow" ? tomorrow.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    setRoute(key);
    setChallengeRulesVersion(rulesVersion);
    setChallengeId(`hx-${Date.now()}-${key}`);
    setScheduledDate(scheduled);
    setDay(1);
    setCheckins(configuredTasks(key, 1).map((item) => ({ ...item, done: false })));
    setNote("");
    setTaskNotes({});
    setSkippedIds([]);
    setSettled(false);
    setLifecycle(effectiveStart === "tomorrow" ? "preparing" : "active");
    setHistory([]);
    setOptionalOpen(false);
    setStartedAt(effectiveStart === "today" ? new Date().toISOString() : "");
    setTab("today");
    setScreen("app");
    setRoutesFromApp(false);
    trackAnonymousEvent("challenge_started", { route: key, rulesVersion });
  }

  function toggleCheckin(id: string) {
    if (settled || lifecycle !== "active") return;
    setCheckins((items) => {
      const target = items.find((item) => item.id === id);
      const nextDone = !target?.done;
      return items.map((item) => {
        if (item.id === id) return { ...item, done: nextDone };
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

  function clearAllData() {
    localStorage.removeItem(storageKey);
    void clearIndexedState().then(() => window.location.reload());
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
      rulesVersion: challengeRulesVersion,
    };
    setHistory((records) => [...records.filter((item) => item.day !== day), record].sort((a, b) => a.day - b.day));
    setSettled(true);
    setUndoUntil(Date.now() + 10 * 60 * 1000);
    trackAnonymousEvent("day_settled", { route, day, result: result.key });
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

  function renderTaskCard(item: Checkin, compact = false) {
    return (
      <button
        key={item.id}
        className={`${styles.checkinPanel} ${styles[item.tone]} ${item.done ? styles.checked : ""} ${skippedIds.includes(item.id) ? styles.skipped : ""} ${compact ? styles.compactChallenge : ""}`}
        onClick={() => toggleCheckin(item.id)}
        aria-pressed={item.done}
      >
        <span className={styles.checkinIcon}>{item.icon}</span>
        <span className={styles.checkinText}><b>{item.name}</b><small>{item.detail}</small></span>
        <span className={styles.checkCircle}>{item.done ? "✓" : skippedIds.includes(item.id) ? "—" : ""}</span>
        <span className={styles.infoButton} role="button" tabIndex={0} aria-label={`查看${item.name}说明`} onClick={(event) => { event.stopPropagation(); setDetailTask(item); }} onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setDetailTask(item); }
        }}>···</span>
      </button>
    );
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
            <button className={styles.iconButton} onClick={() => setScreen(routesFromApp ? "app" : "welcome")} aria-label="返回">‹</button>
            <div><h1 className={styles.routePageTitle}>选择适合现在的路线</h1></div>
          </header>
          {routesFromApp && <p className={styles.routeWarning}>你当前的挑战仍会保留。建议先完成或结束当前挑战，再开启新的路线。</p>}
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
                    <em>完成条件：{item.target}</em>
                    <details className={styles.routeDetails}>
                      <summary>查看具体挑战项目与规则</summary>
                      {routeDetails[key].groups.map((group) => (
                        <section key={group.label}>
                          <b>{group.label}</b>
                          <ul>{group.items.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                        </section>
                      ))}
                      <section>
                        <b>完成规则</b>
                        <ol>{routeDetails[key].rules.map((rule) => <li key={rule}>{rule}</li>)}</ol>
                      </section>
                    </details>
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
              {assessmentStep > 0 && <button className={styles.assessmentBack} onClick={previousAssessment}>‹ 上一题</button>}
            </>
          ) : (
            <section className={styles.assessmentResult}>
              <BrandOrbit compact />
              <small>更适合你现在的起点</small>
              <h1>{routeInfo[recommended].name}</h1>
              <h2>{routeInfo[recommended].label}</h2>
              <p>{routeInfo[recommended].description} 这不是能力判断，只是帮你选择此刻更容易开始的坡度。</p>
              <button className={styles.primaryButton} onClick={() => prepareRoute(recommended)}>从这里开始</button>
              <button className={styles.textButton} onClick={previousAssessment}>修改上一题</button>
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
            <div><h1>开始前设置</h1></div>
          </header>
          <section className={styles.setupRoute}>
            <small>{selected.days} DAYS</small>
            <h2>{selected.name}</h2>
            <p>{selected.description}</p>
          </section>
          <section className={styles.setupDetails}>
            <div className={styles.setupTitle}><span>这条路线具体做什么？</span><small>开始前可以完整确认挑战内容</small></div>
            {routeDetails[pendingRoute].groups.map((group) => (
              <div key={group.label}><b>{group.label}</b><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></div>
            ))}
            <div className={styles.setupRules}><b>完成规则</b><ol>{routeDetails[pendingRoute].rules.map((rule) => <li key={rule}>{rule}</li>)}</ol></div>
          </section>
          <div className={styles.setupGroup}>
            <div className={styles.setupTitle}><span>什么时候开始？</span><small>只生成正式开始后的挑战日</small></div>
            <div className={styles.segmented}>
              <button className={startChoice === "today" ? styles.segmentActive : ""} onClick={() => setStartChoice("today")}>今天</button>
              <button className={startChoice === "tomorrow" ? styles.segmentActive : ""} onClick={() => setStartChoice("tomorrow")}>明天</button>
            </div>
          </div>
          {pendingRoute !== "7" && <div className={styles.setupGroup}>
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
            <p className={styles.setupHint}>{pendingRoute === "21" ? "相对固定的起床时间能帮助身体形成稳定节律。它不要求越早越好，但包括周末在内，也尽量在相近的一小时范围内起床。" : `挑战开始后，“稳定起床”将显示为：在 ${challengeSettings.wakeStart}—${challengeSettings.wakeEnd} 内起床。`}</p>
          </div>}
          <div className={styles.setupActions}>
            <button className={styles.primaryButton} onClick={() => startRoute(pendingRoute)}>{startChoice === "today" ? "今天开始挑战" : "准备好，明天开始"}</button>
            <p>设置会保存在这台设备上，之后可以调整。</p>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "about") {
    return (
      <main className={styles.centerStage}>
        <section className={`${styles.phoneShell} ${styles.infoShell}`}>
          <header className={styles.pageHeader}>
            <button className={styles.iconButton} onClick={() => { setScreen("app"); setTab("me"); }} aria-label="返回">‹</button>
            <div><h1>关于回序</h1></div>
          </header>
          <section className={styles.aboutHero}>
            <BrandOrbit compact />
            <div><small>从混乱，回到自己的节奏</small><h2>回序</h2><p>一套不依赖账号、以真实生活为起点的渐进式挑战系统。</p></div>
          </section>
          <div className={styles.infoSections}>
            <section><h2>为什么做回序</h2><p>生活混乱时，人往往不需要更多目标，而需要一个可以重新开始的顺序。回序不要求连续打卡，也不把中断视为失败，只帮助你看清今天真实完成了什么。</p></section>
            <section><h2>三条挑战路线</h2><ul><li><b>7日清场</b>：先清理眼前最真实的阻力。</li><li><b>21日稳定</b>：建立起床、活动和注意力的基本节奏。</li><li><b>50日挑战</b>：长期实践一套更完整的生活规则。</li></ul></section>
            <section><h2>产品原则</h2><ul><li>严格记录事实，温柔对待结果。</li><li>中断不会让已经发生的行动归零。</li><li>基础生活优先，不制造新的完成压力。</li></ul></section>
            <section><h2>数据与隐私</h2><p>回序不要求注册登录。每日记录、挑战内容和时间设置默认只保存在这台设备上；匿名统计未接入时不会发送任何数据，接入后也不会上传你的文字记录。</p></section>
            <section><h2>免费与开源</h2><p>回序计划以免费、非商业化和开源的方式持续迭代，希望让更多人能够使用、讨论和改进它。</p></section>
          </div>
          <button className={styles.primaryButton} onClick={() => setScreen("feedback")}>反馈与建议</button>
          <p className={styles.versionNote}>当前版本 0.1.0</p>
        </section>
      </main>
    );
  }

  if (screen === "feedback") {
    return (
      <main className={styles.centerStage}>
        <section className={`${styles.phoneShell} ${styles.infoShell}`}>
          <header className={styles.pageHeader}>
            <button className={styles.iconButton} onClick={() => { setScreen("app"); setTab("me"); }} aria-label="返回">‹</button>
            <div><h1>反馈与建议</h1></div>
          </header>
          <section className={styles.feedbackIntro}>
            <h2>你的真实体验，会帮助回序继续变好。</h2>
            <p>可以告诉我哪里不清楚、哪个功能不好用，或者哪条挑战规则真正帮助到了你。</p>
          </section>
          <img className={styles.feedbackQr} src="/feedback-qr.png" alt="回序用户满意度调查二维码" />
          <a className={styles.primaryLink} href={feedbackUrl} target="_blank" rel="noreferrer">打开飞书反馈表</a>
          <p className={styles.feedbackPrivacy}>表单不会自动读取或上传你的回序挑战记录，请按自己的意愿填写。</p>
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
                <span className={styles.statusPill}>{lifecycle === "ended" ? "已提前结束" : challengePassed ? "完成本轮挑战" : "本轮未达成"}</span>
                <h2>{challengePassed ? "你留下的不只是连续的记录，而是一套可以再次回来的生活节奏。" : "这一轮没有达到完成条件，但已经发生的行动不会归零。"}</h2>
                <p>{challengePassed ? "挑战已经结束，但这些行动不需要随之停止。看看哪些方法真正适合你，再决定接下来想继续保留什么。" : "完成、未完成和中断都会作为真实记录留在这里。你可以回看哪些方法有效，再决定休息、重新开始或选择更适合的路线。"}</p>
                <div className={styles.finishStats}>
                  <div><strong>{countedDays}</strong><small>达标日</small></div>
                  <div><strong>{completionRate}%</strong><small>稳定率</small></div>
                  <div><strong>{longestStreak}</strong><small>最长连续</small></div>
                </div>
                {route === "50" && <p className={styles.optionalSummary}>可选挑战累计完成 {optionalCount} 次</p>}
                <button className={styles.primaryButton} onClick={() => setTab("history")}>查看历史挑战</button>
                <button className={styles.secondaryButton} onClick={exportMarkdown}>下载本轮 Markdown</button>
                <button className={styles.textButton} onClick={browseOtherRoutes}>查看其他挑战路线</button>
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
                {dayStatus.label && <span className={styles.statusPill}>{dayStatus.label}</span>}
                <h2>生活，回来了一点。</h2>
                <p>{route === "50" ? `基础挑战 ${baseCompleted} / 5 · 可选挑战 ${optionalTodayCompleted} / 5（不影响达标）` : `完成 ${completed} 个今日行动 · ${checkins.length - completed} 项未完成`}</p>
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
                {day >= currentRoute.days ? (
                  <button className={styles.primaryButton} onClick={advanceDay}>完成这轮挑战</button>
                ) : (
                  <div className={styles.nextDayNotice}><b>DAY {String(day + 1).padStart(2, "0")} 将在明天自动开启</b><small>无需手动进入；到达本地时间凌晨后会自动切换。</small></div>
                )}
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
                    <small>{todayCompleted} / {todayTotal} 已完成</small>
                  </div>
                  <p>{route === "7" ? "完成今日清场挑战，就是完成日" : route === "21" ? "前三项固定挑战全部完成，就是稳定日；累计15个稳定日并完成15次附加挑战，即完成本轮挑战" : "5项基础挑战完成4项为达标日，5项全部完成为全部完成日；可选挑战不影响判定"}</p>
                </div>
                <div className={styles.checkinStack}>
                  {checkins.filter((item) => item.category !== "optional" && item.category !== "rotation").map((item) => renderTaskCard(item))}
                </div>
                {route === "21" && <>
                  <div className={styles.subChallengeLabel}><span>今日附加挑战</span><small>不影响稳定日，完成后计入挑战条件</small></div>
                  <div className={styles.checkinStack}>{checkins.filter((item) => item.category === "rotation").map((item) => renderTaskCard(item, true))}</div>
                </>}
                {route === "50" && <section className={styles.optionalChallenges}>
                  <button className={styles.optionalToggle} onClick={() => setOptionalOpen((value) => !value)}><span><b>可选挑战</b><small>自由参考，不强制完成 · 今天完成 {optionalTodayCompleted} 次</small></span><i>{optionalOpen ? "⌃" : "⌄"}</i></button>
                  {optionalOpen && <div className={styles.checkinStack}>{checkins.filter((item) => item.category === "optional").map((item) => renderTaskCard(item, true))}</div>}
                </section>}
                <label className={`${styles.noteField} ${route === "50" ? styles.reflectionField : ""}`}>
                  <span>⌁</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={route === "50" ? "可以留下一句话；也可以在其他软件或纸质日记中记录" : "今天想留下什么？"}
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
            </header>
            <section className={styles.progressHero}>
              <p>已经走过</p>
              <strong>{day}<span> / {currentRoute.days}</span></strong>
              <small>{route === "21" ? "累计获得15个稳定日，并完成15次附加挑战，即可完成本轮挑战。三项固定挑战全部完成，当天才计为稳定日。" : route === "50" ? "累计完成40个达标日即完成挑战；5项基础挑战完成4项为达标日，5项全部完成为全部完成日。可选挑战只作参考，不影响达标。" : currentRoute.target}</small>
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
              <article><span>◌</span><p>{route === "21" ? "附加挑战" : "最长连续"}</p><strong>{route === "21" ? additionalCount : longestStreak} <small>{route === "21" ? "/ 15次" : "天"}</small></strong></article>
            </div>
            {route === "50" && (
              <div className={styles.routeStats}>
                {[
                  ["全部完成日", history.filter((item) => item.statusKey === "full").length],
                  ["达标日", history.filter((item) => item.statusKey === "qualified").length],
                  ["未达标日", history.filter((item) => item.statusKey === "incomplete").length],
                  ["可选挑战累计", optionalCount],
                ].map(([label, value]) => <div key={label}><span>{label}</span><b>{value} {label === "可选挑战累计" ? "次" : "天"}</b></div>)}
              </div>
            )}
            <article className={styles.insightCard}>
              <div className={styles.insightOrb} />
              <div><small>DAY {String(day).padStart(2, "0")}</small><p>{encouragements[route][Math.min(day - 1, encouragements[route].length - 1)]}</p></div>
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
            {recordMode === "calendar" && <div className={styles.recordMonth}><button onClick={() => changeRecordMonth(-1)} aria-label="上个月">‹</button><b>{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(calendarCursor)}</b><button onClick={() => changeRecordMonth(1)} aria-label="下个月">›</button></div>}
            {recordMode === "calendar" ? (
              <div className={styles.recordCalendar}>
                {['一','二','三','四','五','六','日'].map((label) => <span className={styles.calendarWeekday} key={label}>{label}</span>)}
                {Array.from({ length: calendarOffset }, (_, index) => <i key={`blank-${index}`} />)}
                {Array.from({ length: calendarDays }, (_, index) => {
                  const dateNumber = index + 1;
                  const key = `${recordMonthCursor}-${String(dateNumber).padStart(2, "0")}`;
                  const record = calendarRecords.get(key);
                  return <button key={key} className={record?.counted ? styles.calendarDone : record ? styles.calendarPartial : ""} disabled={!record} onClick={() => record && setDetailRecord(record)}><b>{dateNumber}</b>{record && <small>DAY {record.day}</small>}</button>;
                })}
              </div>
            ) : <div className={styles.recordTimeline}>
              {filteredHistory.length === 0 && <div className={styles.emptyState}>{history.length ? "没有找到相关记录。" : "第一条记录会在你完成今日结算后出现在这里。"}</div>}
              {[...filteredHistory].reverse().map((record) => (
                <article key={record.day} className={styles.recordItem} onClick={() => setDetailRecord(record)}>
                  <div className={`${styles.timelineDot} ${!record.counted ? styles.partial : ""}`} />
                  <time>{record.date}</time>
                  <div>
                    <span>DAY {String(record.day).padStart(2, "0")}{record.status ? ` · ${record.status}` : ""}</span>
                    {route !== "21" && <h3>{record.stage}</h3>}
                    <p>{record.note || `完成${record.doneIds.length}项，其他内容按当时状态保存。`}</p>
                  </div>
                </article>
              ))}
            </div>}
          </div>
        )}

        {tab === "history" && (
          <div className={styles.screenContent}>
            <header className={styles.appHeader}>
              <div><p>过去完成或结束的挑战</p><h1>历史挑战</h1></div>
              <button className={styles.sunButton} aria-label="返回我的" onClick={() => setTab("me")}>‹</button>
            </header>
            <p className={styles.historyIntro}>每一轮挑战都独立保存。点开后可以查看当时的每日任务、完成状态和文字记录，也可以单独下载 Markdown 文件。</p>
            <div className={styles.historyList}>
              {archives.length === 0 && <div className={styles.emptyState}>完成或提前结束一轮挑战后，它会出现在这里。</div>}
              {archives.map((item) => (
                <button key={item.id} onClick={() => { setArchiveOpen(item); setArchiveRecordOpen(null); }}>
                  <span>{item.status === "finished" ? "✓" : "↗"}</span>
                  <div><small>{new Date(item.startedAt).toLocaleDateString("zh-CN")} — {new Date(item.endedAt).toLocaleDateString("zh-CN")}</small><b>{routeInfo[item.route].name}</b><p>{item.history.length} 天记录 · {item.status === "finished" ? "已完成" : "已结束"}</p></div>
                  <i>›</i>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "me" && (
          <div className={styles.screenContent}>
            <header className={styles.appHeader}><div><h1>我的</h1></div></header>
            <section className={styles.profileCard}>
              <BrandOrbit compact />
              <div><small>{lifecycle === "paused" ? "已暂停" : lifecycle === "finished" ? "已结束" : "当前挑战"}</small><h2>{currentRoute.name}</h2><p>DAY {day} · {history.length}天记录保存在本机</p></div>
            </section>
            <section className={styles.settingsSection}>
              <h2>当前挑战</h2>
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
                <button onClick={browseOtherRoutes}><span>⌁</span><div><b>查看其他挑战路线</b><small>浏览不会改变当前挑战</small></div></button>
                {lifecycle === "active" || lifecycle === "paused" ? <button onClick={() => setEndingOpen(true)}><span>□</span><div><b>提前结束这轮挑战</b><small>保留全部事实并生成归档</small></div></button> : null}
              </div>
            </section>
            <section className={styles.settingsSection}>
              <h2>记录与数据</h2>
              <div className={styles.settingsGroup}>
                <button onClick={() => setTab("history")}><span>◷</span><div><b>历史挑战</b><small>{archives.length ? `${archives.length} 轮过去的挑战` : "过去完成或结束的挑战会保存在这里"}</small></div></button>
                <button onClick={exportMarkdown}><span>≡</span><div><b>导出当前挑战可阅读记录</b><small>仅包含当前挑战，生成 Markdown 文件</small></div></button>
                <button onClick={exportBackup}><span>⇩</span><div><b>导出完整备份</b><small>包含当前挑战与全部历史挑战，可完整恢复</small></div></button>
                <button onClick={() => importRef.current?.click()}><span>⇧</span><div><b>从备份恢复</b><small>选择此前导出的回序文件</small></div></button>
              </div>
            </section>
            <input ref={importRef} className={styles.hiddenInput} type="file" accept=".huixu,application/json,.json" onChange={(event) => restoreBackup(event.target.files?.[0])} />
            <section className={styles.settingsSection}>
              <h2>应用设置</h2>
              <div className={styles.settingsGroup}>
                <button onClick={installApp}><span>▣</span><div><b>{appInstalled ? "回序已安装" : "安装回序"}</b><small>{appInstalled ? "可从桌面或主屏幕直接打开" : "添加到手机主屏幕或电脑桌面"}</small></div></button>
                <button onClick={() => {
                  if (!analyticsAvailable) return showToast("匿名统计尚未接入，目前不会发送任何数据");
                  setAnalyticsConsent(analyticsConsent === "accepted" ? "declined" : "accepted");
                  setAnalyticsPromptSeen(true);
                }}><span>◉</span><div><b>匿名使用统计</b><small>{!analyticsAvailable ? "尚未接入 · 当前不会发送数据" : analyticsConsent === "accepted" ? "已开启 · 点击关闭" : "已关闭 · 点击开启"}</small></div></button>
                <button onClick={() => setScreen("feedback")}><span>✦</span><div><b>反馈与建议</b><small>填写回序用户满意度调查</small></div></button>
                <button onClick={() => setScreen("about")}><span>序</span><div><b>关于回序</b><small>了解产品理念、隐私与开源计划</small></div></button>
              </div>
            </section>
            <section className={`${styles.settingsSection} ${styles.dangerSection}`}>
              <h2>危险操作</h2>
              <div className={styles.settingsGroup}>
                <button onClick={() => { setClearDataAcknowledged(false); setClearDataOpen(true); }}><span>×</span><div><b>清除本机全部数据</b><small>删除当前挑战、历史挑战和全部设置</small></div></button>
              </div>
            </section>
          </div>
        )}

        <nav className={styles.tabBar} aria-label="主要导航">
          {([
            ["today", "◎", "今天"],
            ["progress", "◌", "进度"],
            ["records", "◇", "记录"],
            ["me", "○", "我的"],
          ] as [Tab, string, string][]).map(([key, icon, label]) => (
            <button key={key} className={tab === key ? styles.activeTab : ""} onClick={() => { setTab(key); if (key === "records") setSearchingRecords(false); }}>
              <NavIcon name={key} fallback={icon} />{label}
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
                  <small>{detailTask.category === "anchor" ? route === "21" ? "固定挑战" : "稳定锚点" : detailTask.category === "rotation" ? "附加挑战" : detailTask.category === "optional" ? "可选挑战" : detailTask.category === "base" ? "基础挑战" : "清场挑战"}</small>
                  <h2>{detailTask.name}</h2>
                  <p>{detailTask.description}</p>
                  <div className={styles.sheetTip}><span>行动建议</span>{detailTask.suggestion}</div>
                  {detailTask.id === "clear-card" && <div className={styles.cardPrompts}>最近最容易打乱生活的事 · 最有帮助的行动 · 想保留的身体动作 · 注意力边界 · 下次先做什么 · 最后只保留一件事</div>}
                  <label className={styles.actionInput}>
                    <span>{detailTask.id === "clear-card" ? "我的回序卡" : detailTask.id === "long-reflect" ? "今天想留下什么？（可选）" : "我实际做了什么"}</span>
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
                  {detailRecord.status && <span className={styles.statusPill}>{detailRecord.status}</span>}
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
              <p>开启后，回序会在早晨和晚间通过系统通知提醒你。网页正在运行时会准点触发；从后台恢复时，会补发最近 30 分钟内错过的提醒。</p>
              <label className={styles.toggleRow}>
                <span><b>启用系统提醒</b><small>{notificationPermission === "granted" ? "通知权限已允许" : notificationPermission === "denied" ? "通知权限已被拒绝" : notificationPermission === "unsupported" ? "当前浏览器不支持" : "开启时会申请通知权限"}</small></span>
                <input type="checkbox" checked={reminder.enabled} onChange={async (event) => {
                  const enabled = event.target.checked;
                  const allowed = enabled ? await requestReminderPermission() : false;
                  setReminder({ ...reminder, enabled: enabled && allowed });
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
              <button className={styles.secondaryButton} onClick={sendTestReminder}>发送一条测试提醒</button>
              <p className={styles.reminderLimit}>如果完全退出浏览器，纯前端网页不能自行唤醒。要在关闭网页后仍准点收到提醒，需要后续接入匿名 Web Push 服务；iPhone 还需要先将回序添加到主屏幕。</p>
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
          <div className={styles.sheetBackdrop} onClick={() => { setArchiveOpen(null); setArchiveRecordOpen(null); }}>
            <section className={styles.detailSheet} role="dialog" aria-modal="true" aria-label="挑战归档" onClick={(event) => event.stopPropagation()}>
              <div className={styles.sheetHandle} /><small>历史挑战</small><h2>{routeInfo[archiveOpen.route].name}</h2>
              <p>{new Date(archiveOpen.startedAt).toLocaleDateString("zh-CN")} — {new Date(archiveOpen.endedAt).toLocaleDateString("zh-CN")} · {archiveOpen.history.length} 天记录</p>
              {archiveRecordOpen ? <>
                <button className={styles.archiveBack} onClick={() => setArchiveRecordOpen(null)}>‹ 返回挑战记录</button>
                <h3>DAY {String(archiveRecordOpen.day).padStart(2, "0")} · {archiveRecordOpen.stage}</h3>
                {archiveRecordOpen.status && <span className={styles.statusPill}>{archiveRecordOpen.status}</span>}
                <div className={styles.recordTaskList}>{(archiveRecordOpen.tasks ?? getTasks(archiveOpen.route, archiveRecordOpen.day)).map((task) => <div key={task.id} className={archiveRecordOpen.doneIds.includes(task.id) ? styles.recordDone : ""}><span>{task.icon}</span><b>{task.name}<small>{archiveRecordOpen.taskNotes?.[task.id]}</small></b><i>{archiveRecordOpen.doneIds.includes(task.id) ? "✓" : "未完成"}</i></div>)}</div>
                {archiveRecordOpen.note && <blockquote>“{archiveRecordOpen.note}”</blockquote>}
              </> : <div className={`${styles.recordTaskList} ${styles.archiveDays}`}>
                {archiveOpen.history.map((record) => <button key={record.day} onClick={() => setArchiveRecordOpen(record)} className={record.counted ? styles.recordDone : ""}><span>{record.counted ? "◆" : "◇"}</span><b>DAY {String(record.day).padStart(2, "0")}<small>{record.date} · 完成{record.doneIds.length}项</small></b><i>{record.status ? `${record.status} ` : ""}›</i></button>)}
              </div>}
              {!archiveRecordOpen && <button className={styles.secondaryButton} onClick={() => exportArchiveMarkdown(archiveOpen)}>下载 Markdown</button>}
              <button className={styles.secondaryButton} onClick={() => { setArchiveOpen(null); setArchiveRecordOpen(null); }}>关闭</button>
            </section>
          </div>
        )}
        {analyticsAvailable && analyticsConsent === "pending" && !analyticsPromptSeen && history.length > 0 && screen === "app" && (
          <div className={styles.sheetBackdrop}>
            <section className={styles.detailSheet} role="dialog" aria-modal="true" aria-label="匿名统计设置">
              <div className={styles.sheetHandle} /><small>数据与隐私</small><h2>帮助回序变得更好</h2>
              <p>回序希望收集匿名的页面访问与功能使用统计，用于改进产品。不会上传你的每日记录、挑战内容、时间设置或备份文件。</p>
              <button className={styles.primaryButton} onClick={() => { setAnalyticsConsent("accepted"); setAnalyticsPromptSeen(true); }}>允许匿名统计</button>
              <button className={styles.textButton} onClick={() => { setAnalyticsConsent("declined"); setAnalyticsPromptSeen(true); }}>不允许</button>
              <button className={styles.textButton} onClick={() => setAnalyticsPromptSeen(true)}>以后再决定</button>
            </section>
          </div>
        )}
        {installGuideOpen && (
          <div className={styles.sheetBackdrop} onClick={() => setInstallGuideOpen(false)}>
            <section className={styles.detailSheet} role="dialog" aria-modal="true" aria-label="安装回序" onClick={(event) => event.stopPropagation()}>
              <div className={styles.sheetHandle} /><small>安装到桌面</small><h2>把回序放到主屏幕</h2>
              <p>iPhone／iPad：使用 Safari 打开回序，点击底部“分享”，再选择“添加到主屏幕”。其他浏览器可以在菜单中选择“安装应用”或“添加到主屏幕”。</p>
              <button className={styles.primaryButton} onClick={() => setInstallGuideOpen(false)}>知道了</button>
            </section>
          </div>
        )}
        {clearDataOpen && (
          <div className={styles.sheetBackdrop} onClick={() => setClearDataOpen(false)}>
            <section className={styles.detailSheet} role="dialog" aria-modal="true" aria-label="清除本机全部数据" onClick={(event) => event.stopPropagation()}>
              <div className={styles.sheetHandle} /><small>危险操作</small><h2>清除本机全部数据？</h2>
              <p>当前挑战、历史挑战、每日记录和全部设置都会永久删除。清除后无法撤销，也无法通过回序找回。</p>
              <button className={styles.secondaryButton} onClick={exportBackup}>先导出完整备份</button>
              <label className={styles.clearConfirm}>
                <input type="checkbox" checked={clearDataAcknowledged} onChange={(event) => setClearDataAcknowledged(event.target.checked)} />
                <span>我知道清除后无法恢复</span>
              </label>
              <button className={styles.dangerButton} disabled={!clearDataAcknowledged} onClick={clearAllData}>确认清除全部数据</button>
              <button className={styles.textButton} onClick={() => setClearDataOpen(false)}>取消</button>
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

function NavIcon({ name, fallback }: { name: Tab; fallback: string }) {
  const paths: Partial<Record<Tab, ReactNode>> = {
    today: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /></>,
    progress: <><path d="M5 18V11" /><path d="M12 18V6" /><path d="M19 18V9" /></>,
    records: <><path d="M7 4.5h8.5L19 8v11.5H7z" /><path d="M15.5 4.5V8H19" /><path d="M10 12h6M10 15.5h6" /></>,
    me: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 19c.8-3.4 3-5.2 6.5-5.2s5.7 1.8 6.5 5.2" /></>,
  };
  if (!paths[name]) return <span>{fallback}</span>;
  return <span className={styles.navIcon}><svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg></span>;
}

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
