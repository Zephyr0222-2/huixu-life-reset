export type RouteKey = "7" | "21" | "50";
export type Tone = "blue" | "purple" | "blend" | "mist";

export type TaskDefinition = {
  id: string;
  name: string;
  detail: string;
  icon: string;
  tone: Tone;
  description: string;
  category: "main" | "anchor" | "rotation" | "base" | "optional";
};

export const routeInfo: Record<
  RouteKey,
  {
    days: number;
    name: string;
    label: string;
    description: string;
    structure: string;
    target: string;
  }
> = {
  "7": {
    days: 7,
    name: "7日清场",
    label: "先清理眼前的混乱",
    description: "用七天减少生活里的阻力，重新获得一点空间、能量和掌控感。",
    structure: "每天一个主挑战 · 两个小锚点",
    target: "完成5个主挑战，并留下回序卡",
  },
  "21": {
    days: 21,
    name: "21日稳定",
    label: "建立可重复的节奏",
    description: "用三个固定锚点和七组三日挑战，慢慢建立能够重复的生活秩序。",
    structure: "三个固定锚点 · 七组三日挑战",
    target: "获得15个稳定日，参与5组轮换挑战",
  },
  "50": {
    days: 50,
    name: "50日挑战",
    label: "长期实践完整规则",
    description: "当基础节奏已经出现，用五十天把稳定生活变成可以持续的状态。",
    structure: "六项基础挑战 · 两项可选成长",
    target: "累计获得40个达标日",
  },
};

const clearMain: Omit<TaskDefinition, "category">[] = [
  { id: "clear-stream", name: "停下信息流", detail: "连续4小时", icon: "◌", tone: "blue", description: "暂停短视频、推荐页、新闻流和无目的连续浏览。" },
  { id: "clear-digital", name: "清理数字空间", detail: "任选3项", icon: "⌘", tone: "blend", description: "关闭通知、整理首页、清理标签页或退出无价值的信息入口。" },
  { id: "clear-space", name: "拿回一个空间", detail: "整理1个小区域", icon: "⌂", tone: "purple", description: "让床边、书桌、衣物区、背包或一小块厨房重新可用。" },
  { id: "clear-body", name: "让身体醒过来", detail: "至少20分钟", icon: "⌁", tone: "blue", description: "完成一次户外活动或主动身体活动。" },
  { id: "clear-backlog", name: "放下一些积压", detail: "3件小事或1件重要事", icon: "◇", tone: "blend", description: "让一件积压事项产生真实进展，而不只是在脑中考虑。" },
  { id: "clear-day", name: "安排简单的一天", detail: "设置3个时间锚点", icon: "◷", tone: "purple", description: "设置起床范围、活动时机与停止信息流的时间，并完成一个准备动作。" },
  { id: "clear-card", name: "留下自己的回序方法", detail: "完成回序卡", icon: "回", tone: "blend", description: "写下最有帮助的行动，并只选择一件接下来继续保留的事。" },
];

const rotationGroups = [
  { id: "water", name: "主动补水", detail: "三个时间点完成两个", icon: "◉", description: "起床后、午饭前后、晚饭前后，主动喝一杯水。" },
  { id: "meal", name: "好好吃一餐", detail: "认真完成一顿饭", icon: "◒", description: "不用零食随便替代，吃饭时不持续刷推荐内容。" },
  { id: "quiet", name: "留出安静时间", detail: "20分钟低信息时间", icon: "◎", description: "不接收新的高密度信息，让注意力安静下来。" },
  { id: "care", name: "认真照顾自己", detail: "完成1件生活照料", icon: "✦", description: "洗澡、换床单、整理衣物、补充用品或处理一个小不适。" },
  { id: "connect", name: "真实连接", detail: "一次有内容的联系", icon: "∞", description: "与一个真实的人产生一次有内容的联系。" },
  { id: "boundary", name: "停止一项自动行为", detail: "保持同一边界", icon: "◐", description: "为一个无意识行为设置边界和替代动作。" },
  { id: "prepare", name: "为明天做准备", detail: "晚上10分钟", icon: "→", description: "提前减少第二天的一个现实阻力。" },
];

export function getTasks(route: RouteKey, day: number): TaskDefinition[] {
  if (route === "7") {
    const main = clearMain[Math.min(day - 1, clearMain.length - 1)];
    return [
      { ...main, category: "main" },
      { id: "clear-anchor-body", name: "身体锚点", detail: "活动至少10分钟", icon: "⌁", tone: "blue", description: "散步、拉伸、运动、家务、骑车或遛狗。", category: "anchor" },
      { id: "clear-anchor-focus", name: "注意力锚点", detail: "睡前20分钟不刷信息流", icon: "☾", tone: "purple", description: "必要通讯和音乐可以使用，停止推荐内容消费。", category: "anchor" },
    ];
  }

  if (route === "21") {
    const groupIndex = Math.min(Math.floor((day - 1) / 3), rotationGroups.length - 1);
    const groupDay = ((day - 1) % 3) + 1;
    const rotation = rotationGroups[groupIndex];
    return [
      { id: "stable-wake", name: "起居", detail: "在目标范围内起床", icon: "☼", tone: "blue", description: "重点是相对稳定，不是越早越好。", category: "anchor" },
      { id: "stable-body", name: "身体", detail: "主动活动20分钟", icon: "⌁", tone: "blend", description: "可以分段累计，不要求一次完成。", category: "anchor" },
      { id: "stable-focus", name: "注意力", detail: "睡前30分钟不刷信息流", icon: "☾", tone: "purple", description: "为一天留下一个安静的结束。", category: "anchor" },
      { id: `rotation-${rotation.id}`, name: rotation.name, detail: `${rotation.detail} · 第${groupDay}天`, icon: rotation.icon, tone: "mist", description: rotation.description, category: "rotation" },
    ];
  }

  return [
    { id: "long-wake", name: "稳定起床", detail: "在目标范围内离开床铺", icon: "☼", tone: "blue", description: "起床是离开床铺并开始一天。", category: "base" },
    { id: "long-morning", name: "晨间仪式", detail: "至少30分钟", icon: "◌", tone: "blend", description: "喝水、早餐、拉伸、洗漱、整理或安静准备今天。", category: "base" },
    { id: "long-body", name: "主动活动", detail: "累计至少30分钟", icon: "⌁", tone: "blue", description: "散步、骑车、健身、拉伸或有意识的家务活动。", category: "base" },
    { id: "long-meal", name: "好好吃饭", detail: "至少一顿完整的饭", icon: "◒", tone: "purple", description: "不用零食随便替代，不评价卡路里。", category: "base" },
    { id: "long-reset", name: "生活归位", detail: "至少10分钟", icon: "⌂", tone: "mist", description: "让一个生活区域恢复可用。", category: "base" },
    { id: "long-evening", name: "晚间收尾", detail: "睡前30分钟", icon: "☾", tone: "purple", description: "停止信息流，用自己的方式结束一天。", category: "base" },
    { id: "long-read", name: "阅读半小时", detail: "可选挑战", icon: "□", tone: "blue", description: "纸质书、电子书、长文章或专业材料。", category: "optional" },
    { id: "long-skill", name: "学习新技能", detail: "可选挑战", icon: "✦", tone: "blend", description: "至少30分钟有明确对象的学习或练习。", category: "optional" },
  ];
}

export function getDayStatus(route: RouteKey, doneIds: string[], day = 1) {
  const done = new Set(doneIds);
  const tasks = getTasks(route, day);
  if (route === "7") {
    return done.has(tasks[0].id)
      ? { key: "complete", label: "完成日", counted: true }
      : { key: "incomplete", label: "未完成日", counted: false };
  }
  if (route === "21") {
    const anchors = ["stable-wake", "stable-body", "stable-focus"].filter((id) => done.has(id)).length;
    return anchors >= 2
      ? { key: "stable", label: "稳定日", counted: true }
      : { key: "recorded", label: "未稳定日", counted: false };
  }
  const baseCount = ["long-wake", "long-morning", "long-body", "long-meal", "long-reset", "long-evening"].filter((id) => done.has(id)).length;
  if (baseCount === 6) return { key: "full", label: "全部完成日", counted: true };
  if (baseCount === 5) return { key: "qualified", label: "达标日", counted: true };
  if (baseCount >= 3) return { key: "recorded", label: "记录日", counted: false };
  return { key: "incomplete", label: "未达标日", counted: false };
}

export function getStageLabel(route: RouteKey, day: number) {
  if (route === "7") return clearMain[Math.min(day - 1, 6)].name;
  if (route === "21") return rotationGroups[Math.min(Math.floor((day - 1) / 3), 6)].name;
  return "完整生活规则";
}
