import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server renders the Huixu application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /回序｜从混乱，回到自己的节奏/);
  assert.match(html, /正在打开回序/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("keeps fixed routes isolated and adds the custom route explicitly", async () => {
  const [fixedData, app] = await Promise.all([
    readFile(new URL("app/challengeData.ts", root), "utf8"),
    readFile(new URL("app/HuixuApp.tsx", root), "utf8"),
  ]);
  assert.match(fixedData, /export type RouteKey = "7" \| "21" \| "50"/);
  assert.match(app, /自定义挑战/);
  assert.match(app, /3—50天/);
  assert.doesNotMatch(app, /不限期挑战|isUnlimited/);
  assert.match(app, /schemaVersion: 8/);
  assert.match(app, /challengeType, customConfig/);
  assert.match(app, /pausedAt, pausedDays/);
  assert.match(app, /window\.addEventListener\("pageshow", resume\)/);
  assert.match(app, /setDay\(expectedDay\)/);
  assert.doesNotMatch(app, /window\.location\.reload\(\);\s*return true/);
  assert.match(app, /queueIndexedStateWrite\(state\)/);
  assert.match(app, /chooseNewestState/);
});

test("challenge clock follows local dates, pauses elapsed days, and detects the final boundary", async () => {
  const { challengeDateTransition, challengeDayForDate, challengeElapsedDays, challengeHasEnded, dateKeyAfter, localDateKey, pausedDaysAfterResume } = await import("../app/challengeClock.ts");
  const earlyMorning = new Date(2026, 7, 5, 4, 0, 0);
  assert.equal(localDateKey(earlyMorning), "2026-08-05");
  assert.equal(dateKeyAfter(earlyMorning, 1), "2026-08-06");

  const start = new Date(2026, 7, 1, 8, 0, 0);
  const resumed = new Date(2026, 7, 5, 8, 0, 0);
  assert.equal(pausedDaysAfterResume(0, "2026-08-02", resumed), 3);
  assert.equal(challengeElapsedDays(start, resumed, 3), 1);
  assert.equal(challengeDayForDate(start, resumed, 3, 21), 2);
  assert.equal(challengeDayForDate(start, new Date(2026, 8, 30), 0, 21), 21);
  assert.deepEqual(challengeDateTransition(1, start, new Date(2026, 7, 2, 8), 0, 7), { expectedDay: 2, ended: false, shouldAdvance: true, lastDayToRecord: 1 });
  assert.deepEqual(challengeDateTransition(1, start, new Date(2026, 7, 5, 8), 0, 7), { expectedDay: 5, ended: false, shouldAdvance: true, lastDayToRecord: 4 });
  assert.deepEqual(challengeDateTransition(1, start, new Date(2026, 7, 5, 8), 2, 7), { expectedDay: 3, ended: false, shouldAdvance: true, lastDayToRecord: 2 });
  assert.deepEqual(challengeDateTransition(1, start, new Date(2026, 7, 4, 8), 0, 3), { expectedDay: 3, ended: true, shouldAdvance: true, lastDayToRecord: 3 });
  assert.deepEqual(challengeDateTransition(2, start, new Date(2026, 7, 2, 8), 0, 7), { expectedDay: 2, ended: false, shouldAdvance: false, lastDayToRecord: 1 });
  assert.equal(challengeHasEnded(start, new Date(2026, 7, 4, 0, 0), 0, 3), true);
  assert.equal(challengeHasEnded(start, new Date(2026, 7, 3, 23, 59, 0), 0, 3), false);
});

test("today page exposes a fixed seven-day read-only viewer", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("app/HuixuApp.tsx", root), "utf8"),
    readFile(new URL("app/huixu.module.css", root), "utf8"),
  ]);
  assert.match(app, /Array\.from\(\{ length: 7 \}/);
  assert.match(app, /center\.getDate\(\) \+ index - 3/);
  assert.match(app, /key < today \? styles\.pastDate : key > today \? styles\.futureDate : styles\.todayDate/);
  assert.match(css, /\.weekStrip button \{[\s\S]*?appearance: none;[\s\S]*?border: 0;/);
  assert.match(css, /\.weekStrip \.pastDate/);
  assert.match(css, /\.weekStrip \.futureDate/);
  assert.match(app, /selectedDateState === "future" \? "未开启"/);
  assert.match(app, /仅供查看，不可编辑/);
  assert.match(app, /挑战尚未开始/);
  assert.match(app, /挑战已结束/);
  assert.match(app, /当天没有安排任务/);
  assert.doesNotMatch(app, /取消完成/);
});

test("bilingual UI keeps local data compatible and includes the complete English catalog", async () => {
  const [app, i18n, manifest, catalog] = await Promise.all([
    readFile(new URL("app/HuixuApp.tsx", root), "utf8"),
    readFile(new URL("app/i18n.ts", root), "utf8"),
    readFile(new URL("public/manifest-en.webmanifest", root), "utf8"),
    import("../app/i18n.generated.ts"),
  ]);
  assert.equal(Object.keys(catalog.englishTranslations).length, 1270);
  assert.equal(catalog.englishTranslations["回序"], "Huixu");
  assert.equal(catalog.englishTranslations["今天"], "Today");
  assert.equal(catalog.englishTranslations["生活盲盒"], "Life Spark");
  assert.match(app, /setLocale\(initialLocale\(\)\)/);
  assert.match(app, /语言 \/ Language/);
  assert.match(app, /manifest-en\.webmanifest/);
  assert.match(i18n, /localStorage\.getItem\("huixu-v1-state"\)/);
  assert.match(i18n, /window\.location\.pathname === "\/en"/);
  assert.match(i18n, /new WeakMap<Node/);
  assert.match(manifest, /Huixu \| Life Reset Challenge System/);
  const englishPage = await readFile(new URL("app/en/page.tsx", root), "utf8");
  assert.match(englishPage, /Huixu — Find Your Rhythm Again/);
  assert.match(englishPage, /locale: "en_US"/);
});

test("custom challenge data includes the three rhythms and snapshot calculations", async () => {
  const source = await readFile(new URL("app/customChallenge.ts", root), "utf8");
  assert.match(source, /"daily" \| "every_other_day" \| "weekly"/);
  assert.match(source, /challengeDay % 2 === 1/);
  assert.match(source, /task\.selectedWeekdays\.includes\(weekday\)/);
  assert.match(source, /Math\.max\(1, total - Math\.max\(0, allowedMisses\)\)/);
  for (const group of ["照顾身体", "整理环境", "管理注意力", "持续成长"]) assert.match(source, new RegExp(group));
  for (const title of ["稳定起床", "晨起仪式", "完整正餐", "停止信息流", "阅读", "真实连接"]) assert.match(source, new RegExp(title));
});

test("life spark stays separate from check-ins and keeps a structured library", async () => {
  const [app, source] = await Promise.all([
    readFile(new URL("app/HuixuApp.tsx", root), "utf8"),
    readFile(new URL("app/lifeSparkData.ts", root), "utf8"),
  ]);
  assert.match(app, /lifeSparkData/);
  assert.match(app, /renderLifeSparkEntry\(\)/);
  assert.match(app, /screen === "life-spark"/);
  assert.match(app, /recentDraws: \[item\.id/);
  assert.match(source, /export const lifeSparkItems/);
  assert.match(source, /data\.recentDraws/);
  assert.match(source, /item\.id !== data\.lastDrawnItemId/);
  for (const group of ["创作一点", "连接一点", "探索一点", "认识一点", "玩耍一点", "记录一点", "自然一点", "仪式感一点", "放松一点", "新体验一点"]) assert.match(source, new RegExp(group));
  assert.doesNotMatch(source, /difficulty|duration|location|mood/);
});

test("anonymous analytics loads only after consent and keeps automatic tracking disabled", async () => {
  const [app, layout, privacy] = await Promise.all([
    readFile(new URL("app/HuixuApp.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("PRIVACY.md", root), "utf8"),
  ]);
  assert.match(app, /analyticsConsent !== "accepted"/);
  assert.match(app, /script\.dataset\.autoTrack = "false"/);
  assert.match(app, /script\.dataset\.domains = analyticsDomain/);
  assert.match(app, /huixu\.qingtaolabs\.com/);
  assert.match(app, /life_spark_opened/);
  assert.match(app, /hm\.baidu\.com\/hm\.js/);
  assert.match(app, /4e0dca8d470c4d1e78d8e1c283bbfd6c/);
  assert.match(app, /_trackEvent/);
  assert.doesNotMatch(layout, /cloud\.umami\.is|data-website-id/);
  assert.doesNotMatch(layout, /hm\.baidu\.com|4e0dca8d470c4d1e78d8e1c283bbfd6c/);
  assert.match(privacy, /Umami Cloud（欧盟数据区域）和百度统计/);
  assert.match(privacy, /Cookie 或匿名标识符/);
  assert.match(privacy, /用户拒绝或尚未作出选择时，不会发送这些事件/);
});
