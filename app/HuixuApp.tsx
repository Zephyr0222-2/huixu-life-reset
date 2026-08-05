"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
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
import {
  customChallengeLibrary,
  customDayStatus,
  customRequiredCount,
  customTaskToDefinition,
  dateForChallengeDay,
  endDateFor,
  routeTaskGroups,
  scheduledCustomTasks,
  type CustomChallengeConfig,
  type CustomTask,
  type RhythmType,
} from "./customChallenge";
import {
  drawLifeSpark,
  emptyLifeSparkData,
  lifeSparkCategories,
  lifeSparkItems,
  type LifeSparkData,
  type LifeSparkItem,
} from "./lifeSparkData";
import {
  calendarDayDifference,
  challengeDateTransition,
  challengeElapsedDays,
  challengeHasEnded,
  dateKeyAfter,
  localDateKey,
  pausedDaysAfterResume,
} from "./challengeClock";

type Screen = "welcome" | "routes" | "assessment" | "setup" | "custom-builder" | "life-spark" | "about" | "feedback" | "app";
type Tab = "today" | "progress" | "records" | "history" | "me";
type ChallengeType = "fixed" | "custom";

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
  scheduledTaskIds?: string[];
  completedTaskIds?: string[];
  totalTaskCount?: number;
  completedTaskCount?: number;
  requiredCompletedCount?: number;
  dayStatus?: "completed" | "qualified" | "failed" | "pending";
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
  challengeType?: ChallengeType;
  customConfig?: CustomChallengeConfig | null;
};

type CustomDraft = {
  challengeName: string;
  durationDays: number;
  startMode: "today" | "tomorrow" | "custom";
  startDate: string;
  selectedTasks: CustomTask[];
  allowedMisses: number;
};

const storageKey = "huixu-v1-state";
const feedbackUrl = "https://ucn5152u7qk7.feishu.cn/share/base/form/shrcnFBlXn4XxkRGsAdwJx06C2f";
const supportUrl = "https://afdian.com/a/qingtaosanhua";
let indexedStateQueue = Promise.resolve();

function todayKey() {
  return localDateKey(new Date());
}

function defaultCustomDraft(): CustomDraft {
  return {
    challengeName: "我的生活重启挑战",
    durationDays: 21,
    startMode: "today",
    startDate: todayKey(),
    selectedTasks: [],
    allowedMisses: 1,
  };
}

function challengeTotalDays(type: ChallengeType, route: RouteKey, config: CustomChallengeConfig | null) {
  return type === "custom" ? Math.min(50, Math.max(3, config?.durationDays ?? 3)) : routeInfo[route].days;
}

function challengeDisplayName(type: ChallengeType, route: RouteKey, config: CustomChallengeConfig | null) {
  return type === "custom" ? config?.challengeName || "我的生活重启挑战" : routeInfo[route].name;
}

function tasksForChallengeDay(type: ChallengeType, route: RouteKey, config: CustomChallengeConfig | null, targetDay: number) {
  if (type !== "custom" || !config) return getTasks(route, targetDay);
  return scheduledCustomTasks(config, targetDay, dateForChallengeDay(config.startDate, targetDay + (config.pausedDays ?? 0))).map(customTaskToDefinition);
}

function statusForChallengeDay(type: ChallengeType, route: RouteKey, config: CustomChallengeConfig | null, tasks: TaskDefinition[], doneIds: string[], targetDay: number) {
  if (type !== "custom") return getDayStatus(route, doneIds, targetDay);
  const required = customRequiredCount(tasks.length, config?.dailyThresholdRule.allowedMisses ?? 0);
  return customDayStatus(doneIds.filter((id) => tasks.some((task) => task.id === id)).length, tasks.length, required);
}

function stageForChallengeDay(type: ChallengeType, route: RouteKey, targetDay: number) {
  return type === "custom" ? `DAY ${String(targetDay).padStart(2, "0")}` : getStageLabel(route, targetDay);
}

function chooseNewestState(indexed: unknown, local: unknown) {
  const indexedState = indexed && typeof indexed === "object" ? indexed as Record<string, unknown> : null;
  const localState = local && typeof local === "object" ? local as Record<string, unknown> : null;
  if (!indexedState) return localState;
  if (!localState) return indexedState;
  const indexedUpdatedAt = Number(indexedState.stateUpdatedAt ?? 0);
  const localUpdatedAt = Number(localState.stateUpdatedAt ?? 0);
  return localUpdatedAt >= indexedUpdatedAt ? localState : indexedState;
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
  const [challengeType, setChallengeType] = useState<ChallengeType>("fixed");
  const [customConfig, setCustomConfig] = useState<CustomChallengeConfig | null>(null);
  const [customDraft, setCustomDraft] = useState<CustomDraft>(() => defaultCustomDraft());
  const [customStep, setCustomStep] = useState(1);
  const [customSource, setCustomSource] = useState<"routes" | "library">("library");
  const [customOpenGroup, setCustomOpenGroup] = useState("照顾身体");
  const [customTaskOpen, setCustomTaskOpen] = useState<CustomTask | null>(null);
  const [customUserTaskOpen, setCustomUserTaskOpen] = useState(false);
  const [customUserTask, setCustomUserTask] = useState({ title: "", userGoal: "", rhythmType: "daily" as RhythmType, selectedWeekdays: [] as number[] });
  const [customNameEditing, setCustomNameEditing] = useState(false);
  const [lifeSparkData, setLifeSparkData] = useState<LifeSparkData>(emptyLifeSparkData);
  const [lifeSparkResult, setLifeSparkResult] = useState<LifeSparkItem | null>(null);
  const [lifeSparkView, setLifeSparkView] = useState<"wheel" | "favorites" | "tried">("wheel");
  const [lifeSparkSpinning, setLifeSparkSpinning] = useState(false);
  const [lifeSparkRotation, setLifeSparkRotation] = useState(0);
  const [lifeSparkSpinDuration, setLifeSparkSpinDuration] = useState(1450);
  const [todayScrollTop, setTodayScrollTop] = useState(0);
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
  const [pausedAt, setPausedAt] = useState("");
  const [pausedDays, setPausedDays] = useState(0);
  const [clockDate, setClockDate] = useState(() => todayKey());
  const [now, setNow] = useState(() => Date.now());
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
  const [endingOpen, setEndingOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState<ChallengeArchive | null>(null);
  const [archiveRecordOpen, setArchiveRecordOpen] = useState<DailyRecord | null>(null);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [challengeRulesVersion, setChallengeRulesVersion] = useState(rulesVersion);
  const [analyticsConsent, setAnalyticsConsent] = useState<"pending" | "accepted" | "declined">("pending");
  const [analyticsPromptSeen, setAnalyticsPromptSeen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [appInstalled, setAppInstalled] = useState(false);
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [clearDataAcknowledged, setClearDataAcknowledged] = useState(false);
  const [routesFromApp, setRoutesFromApp] = useState(false);
  const [supplementText, setSupplementText] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const lifeSparkTimerRef = useRef<number>(0);
  const stateRevisionRef = useRef(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const indexed = await readIndexedState();
        const localRaw = localStorage.getItem(storageKey);
        const local = localRaw ? JSON.parse(localRaw) : null;
        const saved = chooseNewestState(indexed, local) as any;
        if (saved && active) {
          stateRevisionRef.current = Number(saved.stateRevision ?? 0);
          const savedRoute: RouteKey = saved.route ?? "21";
          const savedChallengeType: ChallengeType = saved.challengeType === "custom" && saved.customConfig ? "custom" : "fixed";
          const savedHistory: DailyRecord[] = saved.history ?? [];
          const savedDay = saved.day ?? 1;
          const migratedPausedDays = saved.lifecycle === "paused" && saved.startedAt
            ? Math.max(0, calendarDayDifference(saved.startedAt, new Date()) - (savedDay - 1))
            : 0;
          const savedPausedDays = Math.max(0, saved.pausedDays ?? saved.customConfig?.pausedDays ?? migratedPausedDays);
          const savedPausedAt = saved.lifecycle === "paused" ? saved.pausedAt || todayKey() : "";
          const savedCustomConfig: CustomChallengeConfig | null = savedChallengeType === "custom"
            ? { ...saved.customConfig, pausedDays: savedPausedDays }
            : null;
          const canAdvanceByDate = saved.lifecycle === "active" && saved.startedAt;
          const elapsed = canAdvanceByDate ? challengeElapsedDays(saved.startedAt, new Date(), savedPausedDays) : 0;
          const maxDays = challengeTotalDays(savedChallengeType, savedRoute, savedCustomConfig);
          const targetDay = Math.min(maxDays, Math.max(savedDay, elapsed + 1));
          const endedByDate = Boolean(canAdvanceByDate && challengeHasEnded(saved.startedAt, new Date(), savedPausedDays, maxDays));
          const crossedDay = targetDay > savedDay || endedByDate;
          const savedCheckins: Checkin[] = saved.checkins ?? tasksForChallengeDay(savedChallengeType, savedRoute, savedCustomConfig, savedDay).map((task) => ({ ...task, done: false }));
          const savedDoneIds = savedCheckins.filter((item) => item.done).map((item) => item.id);
          const savedHasContent = savedDoneIds.length > 0 || Boolean(saved.note?.trim()) || Object.keys(saved.taskNotes ?? {}).length > 0 || (saved.skippedIds ?? []).length > 0;
          const savedResult = statusForChallengeDay(savedChallengeType, savedRoute, savedCustomConfig, savedCheckins, savedDoneIds, savedDay);
          const lastDayToRecord = endedByDate ? maxDays : targetDay - 1;
          const missed = crossedDay && lastDayToRecord >= savedDay ? Array.from({ length: lastDayToRecord - savedDay + 1 }, (_, index) => savedDay + index)
            .filter((missedDay) => !savedHistory.some((record) => record.day === missedDay))
            .map((missedDay) => {
              const recordDate = new Date(saved.startedAt);
              recordDate.setDate(recordDate.getDate() + missedDay - 1 + savedPausedDays);
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
                  stage: stageForChallengeDay(savedChallengeType, savedRoute, missedDay),
                  taskNotes: saved.taskNotes ?? {},
                  completedAt: recordDate.toISOString(),
                  tasks: savedCheckins.map(({ done: _done, ...task }) => task),
                  rulesVersion: saved.challengeRulesVersion ?? 1,
                  scheduledTaskIds: savedCheckins.map((task) => task.id),
                  completedTaskIds: savedDoneIds,
                  totalTaskCount: savedCheckins.length,
                  completedTaskCount: savedDoneIds.length,
                  requiredCompletedCount: savedChallengeType === "custom" ? customRequiredCount(savedCheckins.length, savedCustomConfig?.dailyThresholdRule.allowedMisses ?? 0) : undefined,
                  dayStatus: savedChallengeType === "custom" ? savedResult.key as DailyRecord["dayStatus"] : undefined,
                } satisfies DailyRecord;
              }
              const missedTasks = tasksForChallengeDay(savedChallengeType, savedRoute, savedCustomConfig, missedDay);
              return {
                day: missedDay,
                date: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(recordDate),
                status: savedChallengeType === "custom" ? "未达标日" : "未记录",
                statusKey: savedChallengeType === "custom" ? "failed" : "unrecorded",
                counted: false,
                doneIds: [],
                note: "",
                completedAt: recordDate.toISOString(),
                stage: stageForChallengeDay(savedChallengeType, savedRoute, missedDay),
                tasks: isCurrentSavedDay ? savedCheckins.map(({ done: _done, ...task }) => task) : missedTasks,
                scheduledTaskIds: missedTasks.map((task) => task.id),
                completedTaskIds: [],
                totalTaskCount: missedTasks.length,
                completedTaskCount: 0,
                requiredCompletedCount: savedChallengeType === "custom" ? customRequiredCount(missedTasks.length, savedCustomConfig?.dailyThresholdRule.allowedMisses ?? 0) : undefined,
                dayStatus: savedChallengeType === "custom" ? "failed" : undefined,
              } satisfies DailyRecord;
            }) : [];
          const completedHistory = [...savedHistory, ...missed].sort((a, b) => a.day - b.day);
          const finishedCustomConfig = endedByDate && savedCustomConfig
            ? { ...savedCustomConfig, currentDay: targetDay, challengeStatus: "finished" as const, updatedAt: new Date().toISOString() }
            : savedCustomConfig;
          const savedArchives: ChallengeArchive[] = saved.archives ?? [];
          const completedArchives = endedByDate && saved.challengeId
            ? [{
                id: saved.challengeId,
                route: savedRoute,
                status: "finished" as const,
                startedAt: saved.startedAt,
                endedAt: new Date().toISOString(),
                history: completedHistory,
                settings: saved.challengeSettings ?? { wakeStart: "08:00", wakeEnd: "09:00" },
                rulesVersion: saved.challengeRulesVersion ?? 1,
                challengeType: savedChallengeType,
                customConfig: finishedCustomConfig,
              }, ...savedArchives.filter((item) => item.id !== saved.challengeId)]
            : savedArchives;
          setScreen(saved.screen ?? "welcome");
          setRoute(savedRoute);
          setChallengeType(savedChallengeType);
          setCustomConfig(finishedCustomConfig);
          setDay(targetDay);
          setCheckins(crossedDay ? tasksForChallengeDay(savedChallengeType, savedRoute, savedCustomConfig, targetDay).map((task) => ({ ...task, done: false })) : saved.checkins ?? tasksForChallengeDay(savedChallengeType, savedRoute, savedCustomConfig, targetDay).map((task) => ({ ...task, done: false })));
          setNote(crossedDay ? "" : saved.note ?? "");
          setTaskNotes(crossedDay ? {} : saved.taskNotes ?? {});
          setSkippedIds(crossedDay ? [] : saved.skippedIds ?? []);
          setSettled(crossedDay ? false : saved.settled ?? false);
          setLifecycle(endedByDate ? "finished" : saved.lifecycle ?? "active");
          setHistory(completedHistory);
          setStartedAt(saved.startedAt ?? "");
          setReminder(saved.reminder ?? { morning: "08:00", evening: "22:30", enabled: false });
          setChallengeSettings(saved.challengeSettings ?? { wakeStart: "08:00", wakeEnd: "09:00" });
          setScheduledDate(saved.scheduledDate ?? "");
          setChallengeId(saved.challengeId ?? "");
          setArchives(completedArchives);
          setPausedAt(endedByDate ? "" : savedPausedAt);
          setPausedDays(savedPausedDays);
          setChallengeRulesVersion(saved.challengeRulesVersion ?? 1);
          setAnalyticsConsent(saved.analyticsConsent ?? "pending");
          setAnalyticsPromptSeen(saved.analyticsPromptSeen ?? false);
          setUndoUntil(crossedDay ? 0 : saved.undoUntil ?? 0);
          setCustomDraft(saved.customDraft ?? defaultCustomDraft());
          setCustomStep(Math.min(4, Math.max(1, saved.customStep ?? 1)));
          setLifeSparkData({ ...emptyLifeSparkData, ...(saved.lifeSparkData ?? {}) });
        }
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const stateRevision = stateRevisionRef.current + 1;
    stateRevisionRef.current = stateRevision;
    const state = { screen, route, challengeType, customConfig, customDraft, customStep, lifeSparkData, day, checkins, note, taskNotes, skippedIds, settled, lifecycle, history, startedAt, pausedAt, pausedDays, reminder, challengeSettings, scheduledDate, challengeId, archives, undoUntil, challengeRulesVersion, analyticsConsent, analyticsPromptSeen, stateRevision, stateUpdatedAt: Date.now(), schemaVersion: 8 };
    localStorage.setItem(storageKey, JSON.stringify(state));
    void queueIndexedStateWrite(state);
  }, [screen, route, challengeType, customConfig, customDraft, customStep, lifeSparkData, day, checkins, note, taskNotes, skippedIds, settled, lifecycle, history, startedAt, pausedAt, pausedDays, reminder, challengeSettings, scheduledDate, challengeId, archives, undoUntil, challengeRulesVersion, analyticsConsent, analyticsPromptSeen, hydrated]);

  useEffect(() => () => window.clearTimeout(lifeSparkTimerRef.current), []);

  useEffect(() => {
    let timer = 0;
    const refreshClock = () => setClockDate(todayKey());
    const scheduleNextMidnight = () => {
      window.clearTimeout(timer);
      refreshClock();
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 0, 250);
      timer = window.setTimeout(scheduleNextMidnight, Math.max(250, nextMidnight.getTime() - Date.now()));
    };
    const resume = () => { if (document.visibilityState === "visible") scheduleNextMidnight(); };
    scheduleNextMidnight();
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || lifecycle !== "preparing" || !scheduledDate || todayKey() < scheduledDate) return;
    const start = new Date(`${scheduledDate}T00:00:00`).toISOString();
    setStartedAt(start);
    setLifecycle("active");
    if (customConfig) setCustomConfig({ ...customConfig, challengeStatus: "active", updatedAt: new Date().toISOString() });
  }, [hydrated, lifecycle, scheduledDate, customConfig, clockDate]);

  useEffect(() => {
    if (challengeType !== "custom" || !customConfig) return;
    if (customConfig.currentDay === day && customConfig.challengeStatus === lifecycle) return;
    setCustomConfig({ ...customConfig, currentDay: day, challengeStatus: lifecycle, updatedAt: new Date().toISOString() });
  }, [challengeType, customConfig, day, lifecycle]);

  useEffect(() => {
    const totalDays = challengeTotalDays(challengeType, route, customConfig);
    if (!hydrated || lifecycle !== "active" || !startedAt) return;
    const currentDate = new Date(`${clockDate}T12:00:00`);
    const transition = challengeDateTransition(day, startedAt, currentDate, pausedDays, totalDays);
    if (!transition.shouldAdvance) return;
    const { expectedDay, lastDayToRecord, ended: endedByDate } = transition;
    const nowIso = new Date().toISOString();
    const tasksAt = (targetDay: number) => challengeType === "custom"
      ? tasksForChallengeDay("custom", route, customConfig, targetDay)
      : configuredTasks(route, targetDay);

    const nextRecords = [...history];
    for (let missedDay = day; missedDay <= lastDayToRecord; missedDay += 1) {
      if (nextRecords.some((record) => record.day === missedDay)) continue;
      const isVisibleDay = missedDay === day;
      const tasks: Checkin[] = isVisibleDay ? checkins : tasksAt(missedDay).map((task) => ({ ...task, done: false }));
      const doneIds = isVisibleDay ? checkins.filter((item) => item.done).map((item) => item.id) : [];
      const hasContent = isVisibleDay && (doneIds.length > 0 || Boolean(note.trim()) || Object.keys(taskNotes).length > 0 || skippedIds.length > 0);
      const result = hasContent ? statusForChallengeDay(challengeType, route, customConfig, tasks, doneIds, missedDay) : null;
      const recordDate = new Date(startedAt);
      recordDate.setDate(recordDate.getDate() + missedDay - 1 + pausedDays);
      nextRecords.push({
        day: missedDay,
        date: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(recordDate),
        status: result?.label || (challengeType === "custom" ? "未达标日" : "未记录"),
        statusKey: result?.key || (challengeType === "custom" ? "failed" : "unrecorded"),
        counted: result?.counted ?? false,
        doneIds,
        skippedIds: tasks.filter((task) => !doneIds.includes(task.id)).map((task) => task.id),
        note: hasContent ? note : "",
        stage: stageForChallengeDay(challengeType, route, missedDay),
        taskNotes: hasContent ? taskNotes : {},
        completedAt: recordDate.toISOString(),
        tasks: tasks.map(({ done: _done, ...task }) => task),
        rulesVersion: challengeRulesVersion,
        scheduledTaskIds: tasks.map((task) => task.id),
        completedTaskIds: doneIds,
        totalTaskCount: tasks.length,
        completedTaskCount: doneIds.length,
        requiredCompletedCount: challengeType === "custom" ? customRequiredCount(tasks.length, customConfig?.dailyThresholdRule.allowedMisses ?? 0) : undefined,
        dayStatus: challengeType === "custom" ? (result?.key || "failed") as DailyRecord["dayStatus"] : undefined,
      });
    }
    nextRecords.sort((a, b) => a.day - b.day);
    setHistory(nextRecords);
    if (endedByDate && challengeId) {
      const finishedConfig = customConfig ? { ...customConfig, currentDay: totalDays, challengeStatus: "finished" as const, updatedAt: nowIso } : null;
      setArchives((items) => [{
        id: challengeId,
        route,
        status: "finished",
        startedAt,
        endedAt: nowIso,
        history: nextRecords,
        settings: challengeSettings,
        rulesVersion: challengeRulesVersion,
        challengeType,
        customConfig: finishedConfig,
      }, ...items.filter((item) => item.id !== challengeId)]);
    }

    setUndoUntil(0);
    setNote("");
    setTaskNotes({});
    setSkippedIds([]);
    setSettled(false);
    if (endedByDate) {
      setDay(totalDays);
      setLifecycle("finished");
      if (customConfig) setCustomConfig({ ...customConfig, currentDay: totalDays, challengeStatus: "finished", updatedAt: nowIso });
      return;
    }
    setDay(expectedDay);
    setCheckins(tasksAt(expectedDay).map((task) => ({ ...task, done: false })));
    if (customConfig) setCustomConfig({ ...customConfig, currentDay: expectedDay, challengeStatus: "active", updatedAt: nowIso });
  }, [hydrated, lifecycle, startedAt, pausedDays, day, route, challengeType, customConfig, clockDate]);

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
  const todayCompleted = challengeType === "fixed" && route === "50" ? baseCompleted : completed;
  const todayTotal = challengeType === "custom" ? checkins.length : route === "50" ? 5 : checkins.length;
  const currentRoute = challengeType === "custom"
    ? { days: challengeTotalDays(challengeType, route, customConfig), name: challengeDisplayName(challengeType, route, customConfig), label: "自定义挑战", description: "按自己设置的生活节律完成挑战。", structure: `${customConfig?.selectedTasks.length ?? 0} 项自定义任务`, target: "走完设定周期，完成日与达标日都会计入累计达标" }
    : routeInfo[route];
  const dayStatus = useMemo(
    () => statusForChallengeDay(challengeType, route, customConfig, checkins, checkins.filter((item) => item.done).map((item) => item.id), day),
    [challengeType, route, customConfig, checkins, day]
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
  const challengePassed = challengeType === "custom" ? true : route === "7"
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
      icon: "/icon-v3-192.png",
      badge: "/icon-v3-192.png",
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
    anchor.download = `回序备份-${todayKey()}.huixu`;
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
        ...((record.tasks ?? tasksForChallengeDay(challengeType, route, customConfig, record.day)).map((task) => `- ${record.doneIds.includes(task.id) ? "已完成" : "未完成"}｜${task.name}${task.detail ? `｜${task.detail}` : ""}${record.taskNotes?.[task.id] ? `：${record.taskNotes[task.id]}` : ""}`)),
        record.note ? `\n> ${record.note}` : "",
        "",
      ]),
    ];
    downloadMarkdown(lines, `回序记录-${todayKey()}.md`);
    showToast("阅读导出已生成");
    trackAnonymousEvent("markdown_exported", { route });
  }

  function exportArchiveMarkdown(archive: ChallengeArchive) {
    const archiveType = archive.challengeType === "custom" ? "custom" : "fixed";
    const archiveName = challengeDisplayName(archiveType, archive.route, archive.customConfig ?? null);
    const lines = [
      `# 回序 · ${archiveName}`,
      "",
      `挑战时间：${new Date(archive.startedAt).toLocaleDateString("zh-CN")} — ${new Date(archive.endedAt).toLocaleDateString("zh-CN")}`,
      `挑战结果：${archive.status === "finished" ? "自然结束" : archive.status === "ended" ? "提前结束" : "已归档"}`,
      "",
      ...archive.history.flatMap((record) => [
        `## ${record.date} · DAY ${String(record.day).padStart(2, "0")} · ${record.status}`,
        ...((record.tasks ?? tasksForChallengeDay(archiveType, archive.route, archive.customConfig ?? null, record.day)).map((task) => `- ${record.doneIds.includes(task.id) ? "已完成" : "未完成"}｜${task.name}${task.detail ? `｜${task.detail}` : ""}${record.taskNotes?.[task.id] ? `：${record.taskNotes[task.id]}` : ""}`)),
        record.note ? `\n> ${record.note}` : "",
        "",
      ]),
    ];
    downloadMarkdown(lines, `回序-${archiveName}-${archive.startedAt.slice(0, 10)}.md`);
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
        const restoredBase = mode === "合并"
          ? { ...saved, archives: [...(saved.archives ?? []), ...archives.filter((local) => !(saved.archives ?? []).some((remote: ChallengeArchive) => remote.id === local.id))] }
          : saved;
        const restored = { ...restoredBase, stateRevision: Number(restoredBase.stateRevision ?? 0) + 1, stateUpdatedAt: Date.now(), schemaVersion: 8 };
        localStorage.setItem(storageKey, JSON.stringify(restored));
        void queueIndexedStateWrite(restored).then(() => window.location.reload());
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
      challengeType,
      customConfig,
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
    const effectiveStart = startChoice;
    const scheduled = effectiveStart === "tomorrow" ? dateKeyAfter(new Date(), 1) : todayKey();
    setRoute(key);
    setChallengeType("fixed");
    setCustomConfig(null);
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
    setPausedAt("");
    setPausedDays(0);
    setOptionalOpen(false);
    setStartedAt(effectiveStart === "today" ? new Date().toISOString() : "");
    setTab("today");
    setScreen("app");
    setRoutesFromApp(false);
    trackAnonymousEvent("challenge_started", { route: key, rulesVersion });
  }

  function prepareCustomChallenge() {
    const draft = defaultCustomDraft();
    setCustomDraft(draft);
    setCustomStep(1);
    setCustomSource("library");
    setCustomOpenGroup("照顾身体");
    setScreen("custom-builder");
  }

  function toggleCustomTask(template: CustomTask) {
    setCustomDraft((draft) => {
      const existing = draft.selectedTasks.find((task) => task.dedupeKey === template.dedupeKey);
      if (existing) return { ...draft, selectedTasks: draft.selectedTasks.filter((task) => task.dedupeKey !== template.dedupeKey) };
      return { ...draft, selectedTasks: [...draft.selectedTasks, { ...template, taskId: `custom-${template.dedupeKey}`, createdAt: new Date().toISOString() }] };
    });
  }

  function selectAllCustomTasks(templates: CustomTask[]) {
    setCustomDraft((draft) => {
      const next = [...draft.selectedTasks];
      templates.forEach((template) => {
        if (!next.some((task) => task.dedupeKey === template.dedupeKey)) next.push({ ...template, taskId: `custom-${template.dedupeKey}`, createdAt: new Date().toISOString() });
      });
      return { ...draft, selectedTasks: next };
    });
  }

  function updateSelectedCustomTask(taskId: string, update: Partial<CustomTask>) {
    setCustomDraft((draft) => ({ ...draft, selectedTasks: draft.selectedTasks.map((task) => task.taskId === taskId ? { ...task, ...update } : task) }));
  }

  function addUserCustomTask() {
    const title = customUserTask.title.trim();
    if (!title) return showToast("请先填写任务名称");
    const dedupeKey = `user-${title.toLowerCase()}`;
    if (customDraft.selectedTasks.some((task) => task.dedupeKey === dedupeKey || task.title === title)) return showToast("这项任务已经添加过了");
    const task: CustomTask = {
      taskId: `custom-user-${Date.now()}`,
      source: "user",
      category: "我的任务",
      title,
      userGoal: customUserTask.userGoal.trim(),
      rhythmType: customUserTask.rhythmType,
      selectedWeekdays: customUserTask.selectedWeekdays,
      createdAt: new Date().toISOString(),
      description: "这是你为本轮挑战添加的一项个人行动。",
      suggestion: "从当前容易完成的版本开始，重点是稳定重复，不需要一次做到很多。",
      goalExamples: "例如：20分钟／完成一个小步骤",
      icon: "✦",
      tone: "blend",
      dedupeKey,
    };
    setCustomDraft((draft) => ({ ...draft, selectedTasks: [...draft.selectedTasks, task] }));
    setCustomUserTask({ title: "", userGoal: "", rhythmType: "daily", selectedWeekdays: [] });
    setCustomUserTaskOpen(false);
  }

  function customBuilderNext() {
    if (customStep === 1) {
      const days = Math.round(customDraft.durationDays);
      if (days < 3 || days > 50) return showToast("自定义挑战需要持续3—50天");
      if (customDraft.startDate < todayKey()) return showToast("开始日期不能早于今天");
    }
    if (customStep === 2 && customDraft.selectedTasks.length === 0) return showToast("请至少选择一项挑战");
    if (customStep === 3) {
      if (!customDraft.selectedTasks.some((task) => task.rhythmType === "daily")) return showToast("请至少设置一项每天执行的挑战");
      if (customDraft.selectedTasks.some((task) => task.rhythmType === "weekly" && task.selectedWeekdays.length === 0)) return showToast("请为每周任务选择星期");
    }
    setCustomStep((step) => Math.min(4, step + 1));
  }

  function createCustomChallenge() {
    if (!customDraft.selectedTasks.some((task) => task.rhythmType === "daily")) return showToast("请至少保留一项每天执行的挑战");
    if (routesFromApp && (history.length || startedAt)) {
      if (!window.confirm("开启自定义挑战会结束并归档当前挑战。是否继续？")) { setScreen("app"); return; }
      archiveCurrent("ended");
    } else if (history.length || startedAt) archiveCurrent(lifecycle);
    const createdAt = new Date().toISOString();
    const id = `hx-${Date.now()}-custom`;
    const name = customDraft.challengeName.trim() || "我的生活重启挑战";
    const allowedMisses = Math.min(Math.max(0, customDraft.selectedTasks.length - 1), customDraft.allowedMisses);
    const config: CustomChallengeConfig = {
      challengeId: id,
      challengeType: "custom",
      challengeName: name,
      startDate: customDraft.startDate,
      endDate: endDateFor(customDraft.startDate, customDraft.durationDays),
      durationDays: customDraft.durationDays,
      pausedDays: 0,
      selectedTasks: customDraft.selectedTasks,
      dailyThresholdRule: { type: "allowed_misses", allowedMisses },
      createdAt,
      updatedAt: createdAt,
      currentDay: 1,
      challengeStatus: customDraft.startDate === todayKey() ? "active" : "preparing",
    };
    setChallengeType("custom");
    setCustomConfig(config);
    setChallengeId(id);
    setScheduledDate(customDraft.startDate);
    setDay(1);
    setCheckins(tasksForChallengeDay("custom", route, config, 1).map((task) => ({ ...task, done: false })));
    setNote(""); setTaskNotes({}); setSkippedIds([]); setSettled(false); setHistory([]); setOptionalOpen(false);
    setPausedAt(""); setPausedDays(0);
    setLifecycle(config.challengeStatus);
    setStartedAt(config.challengeStatus === "active" ? new Date().toISOString() : "");
    setTab("today"); setScreen("app"); setRoutesFromApp(false);
    trackAnonymousEvent("challenge_started", { route: "custom", duration: config.durationDays, tasks: config.selectedTasks.length });
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
    void queueIndexedStateClear().then(() => window.location.reload());
  }

  function settleToday() {
    if (challengeType === "fixed" && ((route === "7" && day === 7) || (route === "21" && day === 21)) && !finalRequiredDone) {
      showToast(route === "7" ? "请先写下你的回序卡" : "请先写下你的生活节奏卡");
      return;
    }
    const unanswered = checkins.filter((item) => !item.done && !skippedIds.includes(item.id));
    if (unanswered.length && !window.confirm(`还有 ${unanswered.length} 项没有选择。继续结算会将它们记录为“今天未完成”，是否继续？`)) return;
    const finalSkipped = [...new Set([...skippedIds, ...unanswered.map((item) => item.id)])];
    const doneIds = checkins.filter((item) => item.done).map((item) => item.id);
    const result = statusForChallengeDay(challengeType, route, customConfig, checkins, doneIds, day);
    const required = challengeType === "custom" ? customRequiredCount(checkins.length, customConfig?.dailyThresholdRule.allowedMisses ?? 0) : undefined;
    const record: DailyRecord = {
      day,
      date: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date()),
      status: result.label,
      statusKey: result.key,
      counted: result.counted,
      doneIds,
      skippedIds: finalSkipped,
      note,
      stage: stageForChallengeDay(challengeType, route, day),
      taskNotes,
      completedAt: new Date().toISOString(),
      tasks: checkins.map(({ done: _done, ...task }) => task),
      rulesVersion: challengeRulesVersion,
      scheduledTaskIds: checkins.map((task) => task.id),
      completedTaskIds: doneIds,
      totalTaskCount: checkins.length,
      completedTaskCount: doneIds.length,
      requiredCompletedCount: required,
      dayStatus: challengeType === "custom" ? result.key as DailyRecord["dayStatus"] : undefined,
    };
    setHistory((records) => [...records.filter((item) => item.day !== day), record].sort((a, b) => a.day - b.day));
    setSettled(true);
    setUndoUntil(Date.now() + 10 * 60 * 1000);
    trackAnonymousEvent("day_settled", { route: challengeType === "custom" ? "custom" : route, day, result: result.key });
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
    setCheckins((challengeType === "custom" ? tasksForChallengeDay("custom", route, customConfig, next) : configuredTasks(route, next)).map((item) => ({ ...item, done: false })));
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
    setScheduledDate(todayKey());
    setPausedAt("");
    setPausedDays(0);
    if (customConfig) setCustomConfig({ ...customConfig, startDate: todayKey(), endDate: endDateFor(todayKey(), customConfig.durationDays), pausedDays: 0, challengeStatus: "active", updatedAt: new Date().toISOString() });
  }

  function pauseChallenge() {
    setPausedAt(todayKey());
    setLifecycle("paused");
    setPauseConfirmOpen(false);
  }

  function resumeChallenge() {
    const nextPausedDays = pausedDaysAfterResume(pausedDays, pausedAt, new Date());
    setPausedDays(nextPausedDays);
    setPausedAt("");
    if (customConfig) setCustomConfig({
      ...customConfig,
      pausedDays: nextPausedDays,
      endDate: endDateFor(customConfig.startDate, customConfig.durationDays + nextPausedDays),
      challengeStatus: "active",
      updatedAt: new Date().toISOString(),
    });
    setLifecycle("active");
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

  function openLifeSpark(event: ReactMouseEvent<HTMLElement>) {
    const scrollContainer = event.currentTarget.closest(`.${styles.screenContent}`);
    setTodayScrollTop(scrollContainer?.scrollTop ?? 0);
    setLifeSparkView("wheel");
    setLifeSparkResult(null);
    setScreen("life-spark");
  }

  function closeLifeSpark() {
    window.clearTimeout(lifeSparkTimerRef.current);
    setLifeSparkSpinning(false);
    setLifeSparkResult(null);
    setScreen("app");
    setTab("today");
    window.requestAnimationFrame(() => {
      const scrollContainer = document.querySelector(`.${styles.screenContent}`);
      if (scrollContainer instanceof HTMLElement) scrollContainer.scrollTop = todayScrollTop;
    });
  }

  function runLifeSparkDraw(short = false) {
    if (lifeSparkSpinning) return;
    const item = drawLifeSpark(lifeSparkData);
    const categoryIndex = Math.max(0, lifeSparkCategories.findIndex((category) => category.category === item.category));
    const target = (360 - categoryIndex * 36) % 360;
    setLifeSparkSpinning(true);
    setLifeSparkSpinDuration(short ? 720 : 1450);
    setLifeSparkResult(null);
    setLifeSparkRotation((current) => current + (short ? 720 : 1440) + ((target - (current % 360) + 360) % 360));
    setLifeSparkData((data) => ({
      ...data,
      lastDrawnItemId: item.id,
      recentDraws: [item.id, ...data.recentDraws.filter((id) => id !== item.id)].slice(0, 8),
    }));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : short ? 720 : 1450;
    window.clearTimeout(lifeSparkTimerRef.current);
    lifeSparkTimerRef.current = window.setTimeout(() => {
      setLifeSparkResult(item);
      setLifeSparkSpinning(false);
    }, duration);
  }

  function toggleLifeSparkFavorite(itemId: string) {
    setLifeSparkData((data) => ({
      ...data,
      favorites: data.favorites.includes(itemId) ? data.favorites.filter((id) => id !== itemId) : [itemId, ...data.favorites],
    }));
  }

  function markLifeSparkTried(itemId: string) {
    const triedAt = new Date().toISOString();
    setLifeSparkData((data) => ({
      ...data,
      triedItems: [{ itemId, triedAt }, ...data.triedItems.filter((item) => item.itemId !== itemId)],
    }));
    showToast("已记下，去试试看吧");
  }

  function renderLifeSparkEntry() {
    return (
      <button className={styles.lifeSparkEntry} onClick={openLifeSpark}>
        <span className={styles.lifeSparkEntryIcon}>✦</span>
        <b>给生活加一点？</b>
        <i>打开生活盲盒&nbsp; ›</i>
      </button>
    );
  }

  function renderTaskCard(item: Checkin, compact = false) {
    return (
      <div
        key={item.id}
        className={`${styles.checkinPanel} ${styles[item.tone]} ${item.done ? styles.checked : ""} ${skippedIds.includes(item.id) ? styles.skipped : ""} ${compact ? styles.compactChallenge : ""}`}
        onClick={() => toggleCheckin(item.id)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleCheckin(item.id); }
        }}
        role="button"
        tabIndex={0}
        aria-pressed={item.done}
      >
        <span className={styles.checkinIcon}>{item.icon}</span>
        <span className={styles.checkinText}><b>{item.name}</b><small>{item.detail}</small></span>
        <span className={styles.checkCircle}>{item.done ? "✓" : skippedIds.includes(item.id) ? "—" : ""}</span>
        <button type="button" className={styles.infoButton} aria-label={`查看${item.name}说明`} onClick={(event) => { event.stopPropagation(); setDetailTask(item); }} onKeyDown={(event) => event.stopPropagation()}>···</button>
      </div>
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
            <div><h1 className={styles.compactPageTitle}>选择适合现在的路线</h1></div>
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
            <article className={`${styles.routeCard} ${styles.routeCustom}`}>
              <div className={styles.routeNumber}>04</div>
              <div className={styles.routeMeta}>
                <span>3—50 DAYS</span>
                <h2>自定义挑战</h2>
                <h3>适合：希望按自己的生活状态安排挑战内容</h3>
                <p>自由选择挑战项目和生活节律，建立适合自己的稳定生活系统。</p>
                <small>自选周期＋自选任务＋三种生活节律</small>
                <em>完成方式：走完设定周期，每天按实际任务数量判断达标</em>
                <details className={styles.routeDetails}>
                  <summary>查看具体创建内容与规则</summary>
                  <section><b>你可以设置</b><ul><li>3—50天挑战周期和开始日期</li><li>从三条路线或系统题库选择项目</li><li>为每项任务填写目标并设置生活节律</li><li>用“允许未完成几项”设置每日容错</li></ul></section>
                  <section><b>完成规则</b><ol><li>当天全部任务完成，记为完成日。</li><li>达到当天自动换算的门槛，记为达标日。</li><li>走完设定周期后挑战结束，不设置整轮成功或失败。</li></ol></section>
                </details>
              </div>
              <button onClick={prepareCustomChallenge} aria-label="开始自定义挑战">开始自定义</button>
            </article>
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
            <div><h1 className={styles.compactPageTitle}>开始前设置</h1></div>
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

  if (screen === "custom-builder") {
    const weekdayLabels = [[1, "一"], [2, "二"], [3, "三"], [4, "四"], [5, "五"], [6, "六"], [0, "日"]] as const;
    const selectedKeys = new Set(customDraft.selectedTasks.map((task) => task.dedupeKey));
    const previewDays = Array.from({ length: Math.min(7, customDraft.durationDays) }, (_, index) => {
      const previewConfig: CustomChallengeConfig = {
        challengeId: "preview", challengeType: "custom", challengeName: customDraft.challengeName || "我的生活重启挑战",
        startDate: customDraft.startDate, endDate: endDateFor(customDraft.startDate, customDraft.durationDays), durationDays: customDraft.durationDays,
        selectedTasks: customDraft.selectedTasks, dailyThresholdRule: { type: "allowed_misses", allowedMisses: customDraft.allowedMisses },
        createdAt: "", updatedAt: "", currentDay: 1, challengeStatus: "preparing",
      };
      const date = dateForChallengeDay(customDraft.startDate, index + 1);
      return { day: index + 1, total: scheduledCustomTasks(previewConfig, index + 1, date).length };
    });
    return (
      <main className={styles.centerStage}>
        <section className={`${styles.phoneShell} ${styles.setupShell}`}>
          <header className={styles.pageHeader}>
            <button className={styles.iconButton} onClick={() => customStep > 1 ? setCustomStep((step) => step - 1) : setScreen("routes")} aria-label="返回">‹</button>
            <div><h1 className={styles.compactPageTitle}>创建自定义挑战</h1><p>第 {customStep} 步，共 4 步</p></div>
          </header>
          <div className={styles.builderProgress}>{[1,2,3,4].map((step) => <i key={step} className={step <= customStep ? styles.builderProgressActive : ""} />)}</div>

          {customStep === 1 && <>
            <section className={styles.builderIntro}><small>01 · 基本信息</small><h2>这次想走多久？</h2><p>名称可以留空，系统会使用默认名称。</p></section>
            <div className={styles.setupGroup}>
              <label className={styles.builderField}><span>挑战名称</span><input value={customDraft.challengeName} maxLength={30} placeholder="给这次挑战起一个名字" onChange={(event) => setCustomDraft({ ...customDraft, challengeName: event.target.value })} /></label>
            </div>
            <div className={styles.setupGroup}>
              <div className={styles.setupTitle}><span>挑战周期</span><small>最少3天，最多50天</small></div>
              <div className={styles.durationGrid}>{[3,7,14,21,30,50].map((days) => <button key={days} className={customDraft.durationDays === days ? styles.choiceActive : ""} onClick={() => setCustomDraft({ ...customDraft, durationDays: days })}>{days}天</button>)}</div>
              <label className={styles.builderField}><span>自定义天数</span><input type="number" min={3} max={50} value={customDraft.durationDays} onChange={(event) => setCustomDraft({ ...customDraft, durationDays: Math.min(50, Math.max(0, Number(event.target.value))) })} /></label>
            </div>
            <div className={styles.setupGroup}>
              <div className={styles.setupTitle}><span>开始日期</span><small>只生成正式开始后的挑战日</small></div>
              <div className={`${styles.segmented} ${styles.threeSegments}`}>
                {(["today", "tomorrow", "custom"] as const).map((mode) => <button key={mode} className={customDraft.startMode === mode ? styles.segmentActive : ""} onClick={() => {
                  const date = new Date(); if (mode === "tomorrow") date.setDate(date.getDate() + 1);
                  setCustomDraft({ ...customDraft, startMode: mode, startDate: mode === "custom" ? customDraft.startDate : localDateKey(date) });
                }}>{mode === "today" ? "今天" : mode === "tomorrow" ? "明天" : "选择日期"}</button>)}
              </div>
              {customDraft.startMode === "custom" && <label className={styles.builderField}><span>日期</span><input type="date" min={todayKey()} value={customDraft.startDate} onChange={(event) => setCustomDraft({ ...customDraft, startDate: event.target.value })} /></label>}
            </div>
          </>}

          {customStep === 2 && <>
            <section className={styles.builderIntro}><small>02 · 选择项目</small><h2>想把哪些事放进生活？</h2><p>可以跨路线选择，重复项目会自动合并。已选择 {customDraft.selectedTasks.length} 项。</p></section>
            <div className={styles.segmented}><button className={customSource === "library" ? styles.segmentActive : ""} onClick={() => setCustomSource("library")}>系统题库</button><button className={customSource === "routes" ? styles.segmentActive : ""} onClick={() => setCustomSource("routes")}>已有路线</button></div>
            <div className={styles.libraryGroups}>
              {(customSource === "library" ? customChallengeLibrary.map((group) => ({ key: group.groupName, name: group.groupName, items: group.items })) : routeTaskGroups().map((group) => ({ key: group.route, name: group.name, items: group.items }))).map((group) => (
                <section key={group.key} className={styles.libraryGroup}>
                  <button className={styles.libraryGroupHeader} onClick={() => setCustomOpenGroup(customOpenGroup === group.name ? "" : group.name)}><span><b>{group.name}</b><small>{group.items.length} 项 · 已选 {group.items.filter((item) => selectedKeys.has(item.dedupeKey)).length}</small></span><i>{customOpenGroup === group.name ? "⌃" : "⌄"}</i></button>
                  {customOpenGroup === group.name && <>
                    <button className={styles.selectAllButton} onClick={() => selectAllCustomTasks(group.items)}>全选当前分类</button>
                    <div className={styles.libraryItems}>{group.items.map((item) => <article key={item.taskId} className={selectedKeys.has(item.dedupeKey) ? styles.libraryItemSelected : ""}>
                      <button className={styles.libraryItemMain} onClick={() => toggleCustomTask(item)}><span>{item.icon}</span><div><b>{item.title}</b><small>{item.goalExamples}</small></div><i>{selectedKeys.has(item.dedupeKey) ? "✓" : "+"}</i></button>
                      <button className={styles.libraryInfo} aria-label={`查看${item.title}说明`} onClick={() => setCustomTaskOpen(item)}>···</button>
                    </article>)}</div>
                  </>}
                </section>
              ))}
            </div>
            <button className={styles.secondaryButton} onClick={() => setCustomUserTaskOpen(true)}>＋ 新增自己的任务</button>
          </>}

          {customStep === 3 && <>
            <section className={styles.builderIntro}><small>03 · 目标与节律</small><h2>把每项行动变得更具体</h2><p>目标可以不填。请至少保留一项“每天”任务，作为生活的稳定锚点。</p></section>
            <div className={styles.selectedTaskEditor}>{customDraft.selectedTasks.map((task, index) => <article key={task.taskId}>
              <header><span>{task.icon}</span><div><small>挑战 {index + 1}</small><b>{task.title}</b></div><button onClick={() => setCustomDraft({ ...customDraft, selectedTasks: customDraft.selectedTasks.filter((item) => item.taskId !== task.taskId) })} aria-label={`移除${task.title}`}>×</button></header>
              <label className={styles.builderField}><span>我的目标（可选）</span><input value={task.userGoal} placeholder={task.goalExamples.split("／")[0]} onChange={(event) => updateSelectedCustomTask(task.taskId, { userGoal: event.target.value })} /></label>
              <label className={styles.builderField}><span>生活节律</span><select value={task.rhythmType} onChange={(event) => updateSelectedCustomTask(task.taskId, { rhythmType: event.target.value as RhythmType, selectedWeekdays: [] })}><option value="daily">每天</option><option value="every_other_day">隔一天</option><option value="weekly">每周指定日期</option></select></label>
              {task.rhythmType === "weekly" && <div className={styles.weekdayPicker}>{weekdayLabels.map(([value, label]) => <button key={value} className={task.selectedWeekdays.includes(value) ? styles.choiceActive : ""} onClick={() => updateSelectedCustomTask(task.taskId, { selectedWeekdays: task.selectedWeekdays.includes(value) ? task.selectedWeekdays.filter((day) => day !== value) : [...task.selectedWeekdays, value] })}>{label}</button>)}</div>}
              {task.rhythmType === "every_other_day" && <p className={styles.rhythmHint}>从挑战开始日计算，在第1、3、5、7天出现。</p>}
            </article>)}</div>
          </>}

          {customStep === 4 && <>
            <section className={styles.builderIntro}><small>04 · 达标与确认</small><h2>给每天留一点容错</h2><p>达标门槛会根据当天实际出现的任务数量自动换算。</p></section>
            <div className={styles.setupGroup}>
              <div className={styles.setupTitle}><span>每天允许未完成几项？</span><small>当天只有1项任务时，仍需完成1项才算达标</small></div>
              <div className={styles.stepper}><button onClick={() => setCustomDraft({ ...customDraft, allowedMisses: Math.max(0, customDraft.allowedMisses - 1) })}>−</button><strong>{customDraft.allowedMisses}<small>项</small></strong><button onClick={() => setCustomDraft({ ...customDraft, allowedMisses: Math.min(Math.max(0, customDraft.selectedTasks.length - 1), customDraft.allowedMisses + 1) })}>＋</button></div>
            </div>
            <section className={styles.confirmCard}>
              <h2>{customDraft.challengeName.trim() || "我的生活重启挑战"}</h2>
              <dl><div><dt>挑战周期</dt><dd>{customDraft.durationDays}天</dd></div><div><dt>开始日期</dt><dd>{customDraft.startDate}</dd></div><div><dt>结束日期</dt><dd>{endDateFor(customDraft.startDate, customDraft.durationDays)}</dd></div><div><dt>挑战项目</dt><dd>{customDraft.selectedTasks.length}项</dd></div><div><dt>生活节律</dt><dd>每天 {customDraft.selectedTasks.filter((task) => task.rhythmType === "daily").length} · 隔日 {customDraft.selectedTasks.filter((task) => task.rhythmType === "every_other_day").length} · 每周 {customDraft.selectedTasks.filter((task) => task.rhythmType === "weekly").length}</dd></div><div><dt>每日规则</dt><dd>允许 {customDraft.allowedMisses} 项未完成</dd></div></dl>
            </section>
            <section className={styles.previewStrip}><b>前7天任务数量预览</b><div>{previewDays.map((item) => <span key={item.day}><small>DAY {item.day}</small><strong>{item.total}项</strong><i>需完成 {customRequiredCount(item.total, customDraft.allowedMisses)}项</i></span>)}</div></section>
            <p className={styles.lockNotice}>挑战开始后，仅可修改挑战名称；任务、目标、生活节律和容错标准将保持不变，以保护历史记录。</p>
          </>}

          <div className={styles.setupActions}><button className={styles.primaryButton} onClick={customStep === 4 ? createCustomChallenge : customBuilderNext}>{customStep === 4 ? "创建挑战" : "继续"}</button>{customStep > 1 && <button className={styles.textButton} onClick={() => setCustomStep((step) => step - 1)}>返回上一步</button>}</div>

          {customTaskOpen && <div className={styles.sheetBackdrop} onClick={() => setCustomTaskOpen(null)}><section className={styles.detailSheet} onClick={(event) => event.stopPropagation()}><div className={styles.sheetHandle}/><div className={`${styles.sheetIcon} ${styles[customTaskOpen.tone]}`}>{customTaskOpen.icon}</div><small>{customTaskOpen.category}</small><h2>{customTaskOpen.title}</h2><p>{customTaskOpen.description}</p><div className={styles.sheetTip}><span>行动建议</span>{customTaskOpen.suggestion}</div><p className={styles.goalExamples}>目标示例：{customTaskOpen.goalExamples}</p><button className={styles.primaryButton} onClick={() => { toggleCustomTask(customTaskOpen); setCustomTaskOpen(null); }}>{selectedKeys.has(customTaskOpen.dedupeKey) ? "取消选择" : "加入挑战"}</button></section></div>}
          {customUserTaskOpen && <div className={styles.sheetBackdrop} onClick={() => setCustomUserTaskOpen(false)}><section className={styles.detailSheet} onClick={(event) => event.stopPropagation()}><div className={styles.sheetHandle}/><small>我的任务</small><h2>新增自己的任务</h2><label className={styles.builderField}><span>任务名称</span><input value={customUserTask.title} maxLength={20} placeholder="例如：背英语单词" onChange={(event) => setCustomUserTask({ ...customUserTask, title: event.target.value })}/></label><label className={styles.builderField}><span>我的目标（可选）</span><input value={customUserTask.userGoal} placeholder="例如：20个" onChange={(event) => setCustomUserTask({ ...customUserTask, userGoal: event.target.value })}/></label><label className={styles.builderField}><span>生活节律</span><select value={customUserTask.rhythmType} onChange={(event) => setCustomUserTask({ ...customUserTask, rhythmType: event.target.value as RhythmType, selectedWeekdays: [] })}><option value="daily">每天</option><option value="every_other_day">隔一天</option><option value="weekly">每周指定日期</option></select></label>{customUserTask.rhythmType === "weekly" && <div className={styles.weekdayPicker}>{weekdayLabels.map(([value,label]) => <button key={value} className={customUserTask.selectedWeekdays.includes(value) ? styles.choiceActive : ""} onClick={() => setCustomUserTask({ ...customUserTask, selectedWeekdays: customUserTask.selectedWeekdays.includes(value) ? customUserTask.selectedWeekdays.filter((day) => day !== value) : [...customUserTask.selectedWeekdays,value] })}>{label}</button>)}</div>}<button className={styles.primaryButton} onClick={addUserCustomTask}>添加任务</button><button className={styles.textButton} onClick={() => setCustomUserTaskOpen(false)}>取消</button></section></div>}
        </section>
      </main>
    );
  }

  if (screen === "life-spark") {
    const favoriteItems = lifeSparkData.favorites.map((id) => lifeSparkItems.find((item) => item.id === id)).filter((item): item is LifeSparkItem => Boolean(item));
    const triedItems = lifeSparkData.triedItems.map((record) => ({ ...record, item: lifeSparkItems.find((item) => item.id === record.itemId) })).filter((record): record is typeof record & { item: LifeSparkItem } => Boolean(record.item));
    return (
      <main className={styles.centerStage}>
        <section className={`${styles.phoneShell} ${styles.lifeSparkShell}`}>
          <header className={styles.pageHeader}>
            <button className={styles.iconButton} onClick={lifeSparkView === "wheel" ? closeLifeSpark : () => setLifeSparkView("wheel")} aria-label={lifeSparkView === "wheel" ? "返回今天" : "返回转盘"}>‹</button>
            <h1 className={styles.lifeSparkTitle}>生活盲盒</h1>
          </header>
          {lifeSparkView === "wheel" ? <>
            <section className={styles.lifeSparkIntro}><h2>今天，要给生活加点什么？</h2></section>
            <div className={styles.lifeSparkWheelArea}>
              <i className={styles.lifeSparkPointer} />
              <div className={`${styles.lifeSparkWheel} ${lifeSparkSpinning ? styles.lifeSparkWheelSpinning : ""}`} style={{ transform: `rotate(${lifeSparkRotation}deg)`, transitionDuration: `${lifeSparkSpinDuration}ms` }} aria-hidden="true">
                {lifeSparkCategories.map((category, index) => {
                  const angle = index * 36 + 18;
                  return <span className={styles.lifeSparkWheelLabel} key={category.category} style={{ transform: `rotate(${angle}deg) translateY(-116px) rotate(${-angle}deg)` }}>{category.categoryName}</span>;
                })}
              </div>
              <button className={styles.lifeSparkCenterButton} onClick={() => runLifeSparkDraw(false)} disabled={lifeSparkSpinning}>{lifeSparkSpinning ? "抽取中…" : "抽一个\n试试"}</button>
            </div>
            <p className={styles.lifeSparkSpinningText}>{lifeSparkSpinning ? "看看今天加点什么……" : "轻轻点一下转盘中央"}</p>
          </> : <section className={styles.lifeSparkCollection}>
            <header><button onClick={() => setLifeSparkView("wheel")}>‹ 返回转盘</button><div><small>{lifeSparkView === "favorites" ? "留给以后再看" : "你选择尝试过的内容"}</small><h2>{lifeSparkView === "favorites" ? "我的收藏" : "我试过的"}</h2></div></header>
            <p className={styles.lifeSparkCollectionNote}>{lifeSparkView === "tried" ? "这里只记录你选择尝试过的内容，不是完成打卡。" : "收藏只是把喜欢的内容留在这里，不会加入挑战。"}</p>
            <div className={styles.lifeSparkCollectionList}>
              {(lifeSparkView === "favorites" ? favoriteItems : triedItems.map((record) => record.item)).length === 0 && <div className={styles.emptyState}>{lifeSparkView === "favorites" ? "遇到喜欢的内容时，可以把它收藏在这里。" : "点击结果卡片里的“就试试”，内容会出现在这里。"}</div>}
              {(lifeSparkView === "favorites" ? favoriteItems : triedItems.map((record) => record.item)).map((item) => {
                const tried = lifeSparkData.triedItems.find((record) => record.itemId === item.id);
                return <article key={item.id}><button onClick={() => setLifeSparkResult(item)}><small>{item.categoryName}{lifeSparkView === "tried" && tried ? ` · ${new Date(tried.triedAt).toLocaleDateString("zh-CN")}` : ""}</small><b>{item.title}</b><i>›</i></button>{lifeSparkView === "favorites" && <button className={styles.lifeSparkRemove} onClick={() => toggleLifeSparkFavorite(item.id)}>取消收藏</button>}</article>;
              })}
            </div>
          </section>}

          <nav className={styles.lifeSparkMiniNav} aria-label="生活盲盒个人内容">
            <button className={lifeSparkView === "favorites" ? styles.lifeSparkMiniActive : ""} onClick={() => setLifeSparkView(lifeSparkView === "favorites" ? "wheel" : "favorites")}><span>♡</span> 我的收藏 <small>{lifeSparkData.favorites.length}</small></button>
            <button className={lifeSparkView === "tried" ? styles.lifeSparkMiniActive : ""} onClick={() => setLifeSparkView(lifeSparkView === "tried" ? "wheel" : "tried")}><span>✦</span> 我试过的 <small>{lifeSparkData.triedItems.length}</small></button>
          </nav>

          <footer className={styles.lifeSparkFooter}>
            <p>生活不只有需要完成的事，也值得加入一些有趣、温柔或新鲜的小事。</p>
            <p><b>不影响挑战</b>这里没有正确答案，也不会计入打卡、达标或连续天数；抽到不合适的，换一个就好。</p>
          </footer>

          {lifeSparkResult && <div className={styles.sheetBackdrop} onClick={() => setLifeSparkResult(null)}>
            <section className={`${styles.detailSheet} ${styles.lifeSparkResult}`} role="dialog" aria-modal="true" aria-label="生活盲盒结果" onClick={(event) => event.stopPropagation()}>
              <div className={styles.sheetHandle} />
              <span className={styles.lifeSparkResultIcon}>✦</span>
              <small>{lifeSparkResult.categoryName}</small>
              <h2>{lifeSparkResult.title}</h2>
              {lifeSparkResult.tip && <p>{lifeSparkResult.tip}</p>}
              <button className={styles.primaryButton} onClick={() => markLifeSparkTried(lifeSparkResult.id)}>就试试</button>
              <div className={styles.lifeSparkResultActions}>
                <button onClick={() => runLifeSparkDraw(true)} disabled={lifeSparkSpinning}>{lifeSparkSpinning ? "正在换…" : "换一个"}</button>
                <button onClick={() => toggleLifeSparkFavorite(lifeSparkResult.id)}>{lifeSparkData.favorites.includes(lifeSparkResult.id) ? "已收藏" : "收藏"}</button>
              </div>
              <button className={styles.textButton} onClick={() => setLifeSparkResult(null)}>关闭</button>
            </section>
          </div>}
          {toast && <div className={styles.toast} role="status">{toast}</div>}
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
          <div className={styles.aboutLetter}>
            <section className={`${styles.aboutCard} ${styles.aboutIntroCard}`}>
              <h2>把生活，慢慢过回来。</h2>
              <div className={styles.aboutProse}>
                <p>你好，欢迎来到回序。</p>
                <p><strong>回序，意为回归生活的秩序。</strong></p>
                <p>我们生活在一个不断强调效率、成长和自我优化的环境里。</p>
                <p>人们努力完成更多目标，学习更多知识，希望成为一个更优秀的人。</p>
                <p>但很多时候，真正需要恢复的，并不是效率，而是生活本身。</p>
                <div className={styles.aboutRituals}>
                  <span>规律地起床。</span><span>好好吃一顿饭。</span><span>喝水。</span><span>活动身体。</span><span>整理房间。</span><span>记录今天发生的事。</span>
                </div>
                <p>这些看似普通的小事，往往才是一段生活重新稳定下来的开始。</p>
                <p>回序希望陪你一点一点，把生活慢慢过回来。</p>
              </div>
            </section>

            <section className={styles.aboutCard}>
              <h2>回序相信</h2>
              <ul className={styles.aboutBeliefs}>
                <li>身体状态，比效率更重要。</li>
                <li>基础生活，比额外成长更重要。</li>
                <li>稳定重复，比短期爆发更重要。</li>
                <li>可持续，比完美完成更重要。</li>
                <li>真实的生活，比漂亮的数据更重要。</li>
              </ul>
              <div className={styles.aboutQuietNote}><p>回序不会催促你成为一个更优秀的人。</p><p>它只是希望，在需要的时候，陪你慢慢找回属于自己的生活节律。</p></div>
            </section>

            <section className={`${styles.aboutCard} ${styles.aboutDataCard}`}>
              <header><span className={styles.aboutShield} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 19 6v5.5c0 4.3-2.8 7.4-7 9-4.2-1.6-7-4.7-7-9V6l7-2.5Z"/><path d="m9.2 12 1.8 1.8 3.9-4"/></svg></span><h2>关于你的数据</h2></header>
              <p>你的所有数据都保存在设备本地。</p>
              <p>开发者无法查看、收集或上传你的任何记录、日记或打卡内容。</p>
              <p>如果需要更换设备，请记得提前导出备份。</p>
            </section>

            <section className={styles.aboutCard}>
              <h2>关于反馈</h2>
              <div className={styles.aboutProse}>
                <p>如果你有新的想法、建议，或者发现了 Bug，欢迎告诉我。</p>
                <p>我会认真阅读每一条反馈。</p>
                <p>但并不是所有建议都会加入产品。</p>
                <p>每一次更新，我都会结合产品理念、长期规划以及维护成本认真考虑，希望回序始终保持简单、克制，也真正有用。</p>
              </div>
              <button className={styles.primaryButton} onClick={() => setScreen("feedback")}>反馈与建议</button>
            </section>

            <footer className={styles.aboutClosing}>
              <p>谢谢你来到这里。</p>
              <p>也谢谢你愿意让回序陪伴你的生活。</p>
              <p>愿我们都能慢一点。</p>
              <strong>把生活，慢慢过回来。</strong>
              <small>当生活重新有了秩序，很多成长都会自然发生。</small>
            </footer>
          </div>
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
                <h2>{lifecycle === "ended" ? "这一轮在这里停下，已经发生的行动和记录都会被保留。" : challengePassed ? "你留下的不只是连续的记录，而是一套可以再次回来的生活节奏。" : "这一轮没有达到完成条件，但已经发生的行动不会归零。"}</h2>
                <p>{lifecycle === "ended" ? "你可以回看哪些方法真正有效，再决定休息、重新开始或选择更适合的路线。" : challengePassed ? "挑战已经结束，但这些行动不需要随之停止。看看哪些方法真正适合你，再决定接下来想继续保留什么。" : "完成、未完成和中断都会作为真实记录留在这里。你可以回看哪些方法有效，再决定休息、重新开始或选择更适合的路线。"}</p>
                <div className={styles.finishStats}>
                  <div><strong>{challengeType === "custom" ? history.filter((item) => item.statusKey === "completed").length : countedDays}</strong><small>{challengeType === "custom" ? "完成日" : "达标日"}</small></div>
                  <div><strong>{challengeType === "custom" ? history.filter((item) => item.statusKey === "qualified").length : `${completionRate}%`}</strong><small>{challengeType === "custom" ? "达标日" : "稳定率"}</small></div>
                  <div><strong>{longestStreak}</strong><small>最长连续</small></div>
                </div>
                {challengeType === "custom" && <p className={styles.optionalSummary}>未达标 {history.filter((item) => item.statusKey === "failed").length} 天 · 累计达标 {countedDays} 天</p>}
                {challengeType === "fixed" && route === "50" && <p className={styles.optionalSummary}>可选挑战累计完成 {optionalCount} 次</p>}
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
                <button className={styles.primaryButton} onClick={resumeChallenge}>恢复这轮挑战</button>
                <button className={styles.textButton} onClick={() => setTab("records")}>查看已有记录</button>
              </section>
            ) : settled ? (
              <section className={styles.settlement}>
                <div className={styles.settlementMark}>
                  <BrandOrbit compact />
                </div>
                {dayStatus.label && <span className={styles.statusPill}>{dayStatus.label}</span>}
                <h2>生活，回来了一点。</h2>
                <p>{challengeType === "custom" ? `今日完成 ${completed} / ${checkins.length} · 需完成 ${customRequiredCount(checkins.length, customConfig?.dailyThresholdRule.allowedMisses ?? 0)} 项达标` : route === "50" ? `基础挑战 ${baseCompleted} / 5 · 可选挑战 ${optionalTodayCompleted} / 5（不影响达标）` : `完成 ${completed} 个今日行动 · ${checkins.length - completed} 项未完成`}</p>
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
                  <p>{challengeType === "custom" ? `今天显示 ${checkins.length} 项，完成 ${customRequiredCount(checkins.length, customConfig?.dailyThresholdRule.allowedMisses ?? 0)} 项为达标日，全部完成为完成日` : route === "7" ? "完成今日清场挑战，就是完成日" : route === "21" ? "前三项固定挑战全部完成，就是稳定日；累计15个稳定日并完成15次附加挑战，即完成本轮挑战" : "5项基础挑战完成4项为达标日，5项全部完成为全部完成日；可选挑战不影响判定"}</p>
                </div>
                <div className={styles.checkinStack}>
                  {checkins.filter((item) => item.category !== "optional" && item.category !== "rotation").map((item) => renderTaskCard(item))}
                </div>
                {challengeType === "fixed" && route === "21" && <>
                  <div className={styles.subChallengeLabel}><span>今日附加挑战</span><small>不影响稳定日，完成后计入挑战条件</small></div>
                  <div className={styles.checkinStack}>{checkins.filter((item) => item.category === "rotation").map((item) => renderTaskCard(item, true))}</div>
                </>}
                {challengeType === "fixed" && route === "50" && <section className={styles.optionalChallenges}>
                  <button className={styles.optionalToggle} onClick={() => setOptionalOpen((value) => !value)}><span><b>可选挑战</b><small>自由参考，不强制完成 · 今天完成 {optionalTodayCompleted} 次</small></span><i>{optionalOpen ? "⌃" : "⌄"}</i></button>
                  {optionalOpen && <div className={styles.checkinStack}>{checkins.filter((item) => item.category === "optional").map((item) => renderTaskCard(item, true))}</div>}
                </section>}
                <label className={`${styles.noteField} ${challengeType === "fixed" && route === "50" ? styles.reflectionField : ""}`}>
                  <span>⌁</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={challengeType === "fixed" && route === "50" ? "可以留下一句话；也可以在其他软件或纸质日记中记录" : "今天想留下什么？"}
                    rows={1}
                  />
                </label>
                <button className={styles.primaryButton} onClick={settleToday}>
                  完成今日记录
                </button>
              </>
            )}
            {renderLifeSparkEntry()}
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
              <small>{challengeType === "custom" ? `完成日和达标日都计入累计达标。每天允许 ${customConfig?.dailyThresholdRule.allowedMisses ?? 0} 项未完成，系统按当天实际任务数换算门槛。` : route === "21" ? "累计获得15个稳定日，并完成15次附加挑战，即可完成本轮挑战。三项固定挑战全部完成，当天才计为稳定日。" : route === "50" ? "累计完成40个达标日即完成挑战；5项基础挑战完成4项为达标日，5项全部完成为全部完成日。可选挑战只作参考，不影响达标。" : currentRoute.target}</small>
            </section>
            <div className={styles.dayGrid}>
              {Array.from({ length: currentRoute.days }, (_, index) => {
                const n = index + 1;
                const record = history.find((item) => item.day === n);
                const state = challengeType === "custom" && record?.statusKey === "completed" ? "full" : record?.counted ? "done" : record ? "partial" : n === day ? "current" : "future";
                return <button key={n} className={styles[state]} onClick={() => record && setDetailRecord(record)} disabled={!record}>{n}</button>;
              })}
            </div>
            <div className={styles.statGrid}>
              <article><span>☼</span><p>{challengeType === "custom" ? "累计达标" : route === "7" ? "完成日" : route === "21" ? "稳定日" : "累计达标"}</p><strong>{countedDays} <small>{challengeType === "custom" ? "天" : `/ ${route === "7" ? 5 : route === "21" ? 15 : 40}`}</small></strong></article>
              <article><span>◌</span><p>{challengeType === "fixed" && route === "21" ? "附加挑战" : "最长连续"}</p><strong>{challengeType === "fixed" && route === "21" ? additionalCount : longestStreak} <small>{challengeType === "fixed" && route === "21" ? "/ 15次" : "天"}</small></strong></article>
            </div>
            {challengeType === "fixed" && route === "50" && (
              <div className={styles.routeStats}>
                {[
                  ["全部完成日", history.filter((item) => item.statusKey === "full").length],
                  ["达标日", history.filter((item) => item.statusKey === "qualified").length],
                  ["未达标日", history.filter((item) => item.statusKey === "incomplete").length],
                  ["可选挑战累计", optionalCount],
                ].map(([label, value]) => <div key={label}><span>{label}</span><b>{value} {label === "可选挑战累计" ? "次" : "天"}</b></div>)}
              </div>
            )}
            {challengeType === "custom" && (
              <div className={styles.routeStats}>
                {[
                  ["完成日", history.filter((item) => item.statusKey === "completed").length],
                  ["达标日", history.filter((item) => item.statusKey === "qualified").length],
                  ["未达标日", history.filter((item) => item.statusKey === "failed" || item.statusKey === "unrecorded").length],
                  ["剩余天数", Math.max(0, currentRoute.days - day)],
                ].map(([label, value]) => <div key={label}><span>{label}</span><b>{value} 天</b></div>)}
              </div>
            )}
            <article className={styles.insightCard}>
              <div className={styles.insightOrb} />
              <div><small>DAY {String(day).padStart(2, "0")}</small><p>{challengeType === "custom" ? "按今天真实出现的任务行动就好，不需要提前承担之后的日子。" : encouragements[route][Math.min(day - 1, encouragements[route].length - 1)]}</p></div>
            </article>
          </div>
        )}

        {tab === "records" && (
          <div className={styles.screenContent}>
            <header className={styles.appHeader}>
              <div><p>{currentRoute.name}</p><h1>记录</h1></div>
              <button className={styles.sunButton} aria-label="搜索记录" onClick={() => setSearchingRecords((value) => {
                if (value) setRecordQuery("");
                return !value;
              })}>⌕</button>
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
                  return <button key={key} className={challengeType === "custom" && record?.statusKey === "completed" ? styles.calendarFull : record?.counted ? styles.calendarDone : record ? styles.calendarPartial : ""} disabled={!record} onClick={() => record && setDetailRecord(record)}><b>{dateNumber}</b>{record && <small>DAY {record.day}</small>}</button>;
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
                    {route !== "21" && challengeType !== "custom" && <h3>{record.stage}</h3>}
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
                  <div><small>{new Date(item.startedAt).toLocaleDateString("zh-CN")} — {new Date(item.endedAt).toLocaleDateString("zh-CN")}</small><b>{challengeDisplayName(item.challengeType === "custom" ? "custom" : "fixed", item.route, item.customConfig ?? null)}</b><p>{item.history.length} 天记录 · {item.status === "finished" ? "已完成" : "已结束"}</p></div>
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
                    if (lifecycle === "paused") resumeChallenge();
                    else setPauseConfirmOpen(true);
                  }}>
                    <span>{lifecycle === "paused" ? "▶" : "Ⅱ"}</span>
                    <div><b>{lifecycle === "paused" ? "恢复挑战" : "暂停挑战"}</b><small>{lifecycle === "paused" ? "从当前挑战日继续" : "暂停期间不生成新的挑战日"}</small></div>
                  </button>
                )}
                <button onClick={browseOtherRoutes}><span>⌁</span><div><b>查看其他挑战路线</b><small>浏览不会改变当前挑战</small></div></button>
                {lifecycle === "active" || lifecycle === "paused" ? <button onClick={() => setEndingOpen(true)}><span>□</span><div><b>提前结束这轮挑战</b><small>保留全部事实并生成归档</small></div></button> : null}
              </div>
              {challengeType === "custom" && customConfig && <section className={styles.customSettingsCard}>
                <header><div><small>自定义挑战设置</small><h3>{customConfig.challengeName}</h3></div><button onClick={() => setCustomNameEditing((value) => !value)}>{customNameEditing ? "取消" : "修改名称"}</button></header>
                {customNameEditing && <label className={styles.builderField}><span>挑战名称</span><input defaultValue={customConfig.challengeName} maxLength={30} onBlur={(event) => {
                  const name = event.currentTarget.value.trim() || "我的生活重启挑战";
                  setCustomConfig({ ...customConfig, challengeName: name, updatedAt: new Date().toISOString() }); setCustomNameEditing(false); showToast("挑战名称已修改");
                }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}/><small>输入后按回车或点击空白处保存</small></label>}
                <dl><div><dt>周期</dt><dd>{customConfig.durationDays}天</dd></div><div><dt>日期</dt><dd>{customConfig.startDate} — {customConfig.endDate}</dd></div><div><dt>达标规则</dt><dd>每天允许 {customConfig.dailyThresholdRule.allowedMisses} 项未完成</dd></div><div><dt>任务数量</dt><dd>{customConfig.selectedTasks.length}项</dd></div></dl>
                <details><summary>查看已选择任务</summary><div>{customConfig.selectedTasks.map((task) => <p key={task.taskId}><b>{task.title}</b><span>{task.userGoal ? `目标：${task.userGoal} · ` : ""}{task.rhythmType === "daily" ? "每天" : task.rhythmType === "every_other_day" ? "隔一天" : `每周 ${task.selectedWeekdays.map((day) => "日一二三四五六"[day]).join("、")}`}</span></p>)}</div></details>
                <p className={styles.lockNotice}>任务、目标、生活节律和容错标准在挑战开始后保持只读，历史日期不会重新计算。</p>
              </section>}
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
                <button onClick={() => setSupportOpen(true)}><span>♡</span><div><b>支持回序</b><small>自愿打赏，帮助回序继续维护</small></div></button>
                <button onClick={() => setScreen("about")}><span>序</span><div><b>关于回序</b><small>了解产品理念、隐私与反馈</small></div></button>
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
            <button key={key} className={tab === key ? styles.activeTab : ""} onClick={() => { setTab(key); setSearchingRecords(false); setRecordQuery(""); }}>
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
                  <small>{challengeType === "custom" ? "自定义挑战" : detailTask.category === "anchor" ? route === "21" ? "固定挑战" : "稳定锚点" : detailTask.category === "rotation" ? "附加挑战" : detailTask.category === "optional" ? "可选挑战" : detailTask.category === "base" ? "基础挑战" : "清场挑战"}</small>
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
                    {(detailRecord.tasks ?? tasksForChallengeDay(challengeType, route, customConfig, detailRecord.day)).map((task) => (
                      <div key={task.id} className={detailRecord.doneIds.includes(task.id) ? styles.recordDone : ""}>
                        <span>{task.icon}</span><b>{task.name}<small>{task.detail}{detailRecord.taskNotes?.[task.id] ? ` · ${detailRecord.taskNotes[task.id]}` : ""}</small></b><i>{detailRecord.doneIds.includes(task.id) ? "✓" : detailRecord.skippedIds?.includes(task.id) ? "未完成" : "未记录"}</i>
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
              {challengeType === "fixed" && route !== "7" && (
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
        {pauseConfirmOpen && (
          <div className={styles.sheetBackdrop} onClick={() => setPauseConfirmOpen(false)}>
            <section className={styles.detailSheet} role="dialog" aria-modal="true" aria-label="确认暂停挑战" onClick={(event) => event.stopPropagation()}>
              <div className={styles.sheetHandle} /><small>暂停挑战</small><h2>确定要暂停这轮挑战吗？</h2>
              <p>暂停期间不会生成新的挑战日，当前进度和已有记录都会保留。准备好后，可以随时从当前挑战日继续。</p>
              <button className={styles.primaryButton} onClick={pauseChallenge}>确认暂停挑战</button>
              <button className={styles.textButton} onClick={() => setPauseConfirmOpen(false)}>继续当前挑战</button>
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
              <div className={styles.sheetHandle} /><small>历史挑战</small><h2>{challengeDisplayName(archiveOpen.challengeType === "custom" ? "custom" : "fixed", archiveOpen.route, archiveOpen.customConfig ?? null)}</h2>
              <p>{new Date(archiveOpen.startedAt).toLocaleDateString("zh-CN")} — {new Date(archiveOpen.endedAt).toLocaleDateString("zh-CN")} · {archiveOpen.history.length} 天记录</p>
              {archiveRecordOpen ? <>
                <button className={styles.archiveBack} onClick={() => setArchiveRecordOpen(null)}>‹ 返回挑战记录</button>
                <h3>DAY {String(archiveRecordOpen.day).padStart(2, "0")} · {archiveRecordOpen.stage}</h3>
                {archiveRecordOpen.status && <span className={styles.statusPill}>{archiveRecordOpen.status}</span>}
                <div className={styles.recordTaskList}>{(archiveRecordOpen.tasks ?? tasksForChallengeDay(archiveOpen.challengeType === "custom" ? "custom" : "fixed", archiveOpen.route, archiveOpen.customConfig ?? null, archiveRecordOpen.day)).map((task) => <div key={task.id} className={archiveRecordOpen.doneIds.includes(task.id) ? styles.recordDone : ""}><span>{task.icon}</span><b>{task.name}<small>{task.detail}{archiveRecordOpen.taskNotes?.[task.id] ? ` · ${archiveRecordOpen.taskNotes[task.id]}` : ""}</small></b><i>{archiveRecordOpen.doneIds.includes(task.id) ? "✓" : "未完成"}</i></div>)}</div>
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
        {supportOpen && (
          <div className={styles.sheetBackdrop} onClick={() => setSupportOpen(false)}>
            <section className={styles.detailSheet} role="dialog" aria-modal="true" aria-label="支持回序" onClick={(event) => event.stopPropagation()}>
              <div className={styles.sheetHandle} /><small>支持回序</small><h2>谢谢你来到回序</h2>
              <p>也谢谢你提出的每一个问题。你的每一次使用、每一条建议，都在帮助回序一点点成长。</p>
              <p>回序目前仍然保持免费试用。如果它对你有所帮助，也欢迎通过爱发电自愿支持开发者。这份支持，会让我有更多时间继续把它做好。</p>
              <div className={styles.sheetTip}><span>关于打赏</span>打赏只是支持，不会解锁功能，也不是购买服务。我无法承诺具体的更新内容或更新时间，但会在自己的时间和能力范围内，认真维护和持续更新回序。</div>
              <p>希望它能一直陪伴你，也陪伴更多正在探索自己的人。</p>
              <div className={styles.supportIdentity}><b>爱发电主页：青桃三花</b><span>请确认打开的域名为 afdian.com</span></div>
              <button className={styles.primaryButton} onClick={() => {
                window.open(supportUrl, "_blank", "noopener,noreferrer");
                setSupportOpen(false);
              }}>前往爱发电</button>
              <button className={styles.textButton} onClick={() => setSupportOpen(false)}>暂时不用</button>
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

function queueIndexedStateWrite(state: unknown) {
  indexedStateQueue = indexedStateQueue.then(() => writeIndexedState(state));
  return indexedStateQueue;
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

function queueIndexedStateClear() {
  indexedStateQueue = indexedStateQueue.then(() => clearIndexedState());
  return indexedStateQueue;
}
