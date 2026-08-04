import { getTasks, routeInfo, type RouteKey, type TaskDefinition, type Tone } from "./challengeData";

export type RhythmType = "daily" | "every_other_day" | "weekly";
export type CustomTaskSource = "library" | "route-7" | "route-21" | "route-50" | "user";

export type CustomTask = {
  taskId: string;
  source: CustomTaskSource;
  category: string;
  title: string;
  userGoal: string;
  rhythmType: RhythmType;
  selectedWeekdays: number[];
  createdAt: string;
  description: string;
  suggestion: string;
  goalExamples: string;
  icon: string;
  tone: Tone;
  dedupeKey: string;
};

export type CustomChallengeConfig = {
  challengeId: string;
  challengeType: "custom";
  challengeName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  pausedDays?: number;
  selectedTasks: CustomTask[];
  dailyThresholdRule: { type: "allowed_misses"; allowedMisses: number };
  createdAt: string;
  updatedAt: string;
  currentDay: number;
  challengeStatus: "preparing" | "active" | "paused" | "finished" | "ended";
};

export type CustomLibraryGroup = {
  groupId: string;
  groupName: string;
  items: CustomTask[];
};

type LibrarySeed = [string, string, string, string, string, string, Tone, string?];

const seeds: Record<string, LibrarySeed[]> = {
  "照顾身体": [
    ["stable-wake", "稳定起床", "8:00—9:00／周末不晚于10:00", "让起床保持在相对稳定的范围，为一天提供一个清楚的开始。它不要求越早越好，重点是减少作息反复变化。", "先选择多数时候能够做到的范围，并把离开床铺作为完成标志；偶尔睡晚时不必为了打卡压缩必要睡眠。", "☼", "blue"],
    ["morning-ritual", "晨起仪式", "起床后10分钟／三项固定动作", "用一组简单动作帮助身体和注意力进入白天状态。它关注如何开始一天，不等同于规定起床时间。", "可从拉开窗帘、温水补水、洗漱、整理床铺、简单拉伸或梳理待办中选两三项。", "◌", "blend"],
    ["complete-meal", "完整正餐", "每天1顿／午餐／有主食、蛋白质和蔬菜", "用一顿相对完整的正餐照顾基本能量和生活节奏，减少用零食或饮料随便代替吃饭。", "先照顾好最容易的一餐，尽量包含主食、蛋白质和蔬菜，无需精确计算热量。", "◒", "purple"],
    ["hydration", "补水", "起床后／两餐之间／下午补水", "把喝水放进明确的生活节点，减少忙碌或注意力分散时长时间忘记补水。", "把水杯放在经常活动的位置，或把补水和起床、吃饭、休息等动作绑定，不必一次大量饮水。", "◉", "blue"],
    ["body-movement", "身体活动", "散步20分钟／骑车30分钟／拉伸10分钟", "让身体从久坐、疲惫或停滞中动起来。它不局限于高强度运动，也不以减肥为目标。", "散步、拉伸、骑行、瑜伽、跳操、力量训练或有意识地做家务都可以，也可以分段完成。", "⌁", "blend"],
    ["nature-contact", "接触自然", "晒太阳10分钟／户外散步／看树和天空", "暂时离开持续的人造信息和室内环境，接触自然光、空气或真实景物。", "可以去户外散步、在阳台停留或看看树木和天空；天气不合适时不必勉强。", "◇", "blue"],
    ["bedtime-ritual", "睡前仪式", "睡前30分钟／三项收尾动作", "在一天结束前减少刺激，用一组固定动作提醒自己开始收尾，但不要求必须在某个时间睡着。", "可选择停止信息流、调暗灯光、洗漱、阅读或整理明日物品，先保留两三项即可。", "☾", "purple"],
    ["meditation", "冥想", "5分钟／睡前静坐／观察呼吸", "有意识地暂停，观察呼吸、身体感受或当下正在发生的事情。", "静坐、观察呼吸、身体扫描或安静停留都可以；走神很正常，不舒服时可以停止。", "◎", "mist"],
    ["scheduled-intake", "按时服用", "早餐后／睡前／按处方时间", "把需要规律服用的药物、医生建议的补充剂或其他物品放进明确的生活节点。", "可使用药盒或闹钟。具体时间和用量应遵循医生、药师或产品说明，不自行改变用法。", "＋", "mist"],
  ],
  "整理环境": [
    ["organize-space", "整理空间", "书桌恢复可用／整理床铺／清理洗手台", "让一个现实区域恢复可使用状态，减少行动前先处理杂乱的阻力。", "从书桌、床铺、衣柜、洗手台或厨房台面中选一个，做到可用就可以停下。", "⌂", "purple"],
    ["remove-waste", "清理废弃物", "一袋垃圾／过期物品／空包装", "减少已经明确无用、过期或持续占据空间的物品。它强调移除废弃物，不等同于一般收纳。", "先处理判断明确的垃圾、空包装、过期用品或破损物品；不确定的东西可以暂时放过。", "◇", "mist"],
    ["prepare-tomorrow", "准备明天", "准备衣服／整理书包／确认日程／给设备充电", "提前完成一件能降低第二天行动阻力的事情，让明天开始时少一个临时决定。", "只选择最可能影响明天开始的一件事，不需要把所有事情都准备好。", "→", "blend"],
  ],
  "管理注意力": [
    ["stop-feeds", "停止信息流", "4小时／起床后30分钟／晚上8点后／吃饭期间", "暂停没有明确目的、持续滚动的信息，让注意力回到自己选择的事情。它不等于完全不用手机。", "关闭相关通知并准备替代活动；必要通讯、导航和主动搜索仍然可以使用。", "◌", "blue"],
    ["phone-free-time", "无手机时间", "吃饭期间／散步时／起床后30分钟", "在一个明确时间或场景中暂时不用手机，把注意力交还给正在发生的事情。", "从吃饭、散步、起床后或睡前开始，把手机放在看不见或够不到的位置。", "□", "purple"],
    ["focus-one-thing", "专注一事", "25分钟／完成一节课／写完一段", "在一段时间里持续推进一件明确的事情，减少注意力切换造成的启动消耗。", "先把任务改写成可执行动作并关掉无关入口，目标可以很短，结束后再决定是否继续。", "◎", "blend"],
    ["single-tasking", "单任务", "吃饭时只吃饭／阅读时不聊天", "减少同时进行多个行为，让一个动作结束前不被另一件事持续打断。", "从一个常见场景开始；发现切换时只需回到当前动作，不用因为一次分心重新计时。", "｜", "mist"],
    ["organize-digital-space", "整理数字空间", "清理下载文件／关闭标签页／整理照片", "整理手机、电脑或网络空间中堆积的文件和内容，减少打开设备时的视觉和选择负担。", "从照片、下载文件、浏览器标签页、电脑桌面或收藏夹中选一个区域即可。", "⌘", "blue"],
    ["clean-information-sources", "清理信息源", "取消关注／退出无用群聊／关闭订阅", "减少会长期进入生活、持续占用注意力的信息入口，而不是只做一次文件删除。", "先处理最常让你分心的一个来源，不需要一次清空所有信息入口。", "◐", "purple"],
  ],
  "持续成长": [
    ["reading", "阅读", "20分钟／10页／睡前阅读／每次一章", "主动选择一段连续内容阅读，让输入由自己决定，而不是被碎片化推荐带走。", "提前选好内容并放在容易开始的位置，目标可以按时间、页数或章节填写。", "□", "blue"],
    ["learning", "学习", "30分钟／完成一节课／理解一个知识点", "围绕明确主题获取并理解新知识。它偏向理解，与动手技能练习有所不同。", "开始前写下今天要理解什么，结束时留下一个简单结论，不要求一次掌握完整体系。", "✦", "blend"],
    ["skill-practice", "技能练习", "30分钟／完成一道题／临摹一个案例", "通过实际操作练习一项能力，让理解转化为可以使用的动作。", "选择一个具体练习单元，重点是实际动手，不要求每次都产生明显进步。", "⌁", "purple"],
    ["creative-output", "创造输出", "写一段文字／完成一张图／提交一段代码", "形成一个能够看见或保存的成果，把注意力从消费内容转向表达、制作和完成。", "先定义一个今天能够收尾的小成果，不必等待完整灵感，也不要求公开。", "✧", "blend"],
    ["long-term-goal-step", "推进长期目标", "完成下一步／联系一个人／提交一个版本", "为长期计划完成当下可以执行的一步，让模糊目标重新变成现实行动。", "先问下一步可以直接做什么；目标越具体越容易开始，完成一步就可以停下。", "→", "blue"],
    ["journaling", "日记", "写三句话／记录今天／写下一个感受", "记录生活、感受、经历或想法，为日子留下可以回看的线索，不要求复杂复盘。", "纸质本、其他软件或回序都可以；不想深入时只记录事实也足够。", "⌁", "mist"],
    ["intentional-rest", "主动休息", "安静20分钟／闭眼休息／散步不看手机", "有意识地暂停消耗性活动，为身体和注意力留出恢复空间。休息不需要产生额外成果。", "躺一会儿、闭眼、散步、洗澡、听音乐或安静坐着都可以，从容易接受的范围开始。", "◒", "mist"],
    ["real-connection", "真实连接", "打一通电话／一起吃饭／认真聊一件事", "与重要的人发生有关注、有回应的交流或陪伴，而不只是浏览对方动态。", "选择让自己相对安全的人和方式，不需要强迫自己进行不舒服的社交。", "∞", "purple"],
  ],
};

export const customChallengeLibrary: CustomLibraryGroup[] = Object.entries(seeds).map(([groupName, items], groupIndex) => ({
  groupId: ["body-care", "environment", "attention", "growth"][groupIndex],
  groupName,
  items: items.map(([id, title, goalExamples, description, suggestion, icon, tone, dedupeKey]) => ({
    taskId: `library-${id}`,
    source: "library",
    category: groupName,
    title,
    userGoal: "",
    rhythmType: "daily",
    selectedWeekdays: [],
    createdAt: "",
    description,
    suggestion,
    goalExamples,
    icon,
    tone,
    dedupeKey: dedupeKey ?? id,
  })),
}));

const titleAliases: Record<string, string> = {
  "固定起床": "stable-wake", "稳定起床": "stable-wake", "主动活动": "body-movement", "身体锚点": "body-movement",
  "好好吃一餐": "complete-meal", "好好吃饭": "complete-meal", "停下信息流": "stop-feeds", "屏蔽信息流": "stop-feeds",
  "收回注意力": "bedtime-focus", "注意力锚点": "bedtime-focus", "拿回一个空间": "organize-space", "为明天做准备": "prepare-tomorrow",
  "晨起仪式": "morning-ritual", "晨间仪式": "morning-ritual", "主动补水": "hydration", "整理数字空间": "organize-digital-space",
  "每日记录与反思": "journaling", "阅读": "reading", "创造性输出": "creative-output", "学习新技能": "skill-practice", "身体觉察": "meditation",
  "真实连接": "real-connection", "留出安静时间": "quiet-time",
};

export function routeTaskGroups() {
  return (["7", "21", "50"] as RouteKey[]).map((route) => {
    const seen = new Set<string>();
    const items: CustomTask[] = [];
    for (let day = 1; day <= routeInfo[route].days; day += 1) {
      getTasks(route, day).forEach((task) => {
        const key = titleAliases[task.name] ?? task.name;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
          taskId: `route-${route}-${task.id.replace(/^rotation-/, "")}`,
          source: `route-${route}` as CustomTaskSource,
          category: routeInfo[route].name,
          title: task.name,
          userGoal: "",
          rhythmType: "daily",
          selectedWeekdays: [],
          createdAt: "",
          description: task.description,
          suggestion: task.suggestion,
          goalExamples: task.detail,
          icon: task.icon,
          tone: task.tone,
          dedupeKey: key,
        });
      });
    }
    return { route, name: routeInfo[route].name, items };
  });
}

export function customTaskToDefinition(task: CustomTask): TaskDefinition {
  return {
    id: task.taskId,
    name: task.title,
    detail: task.userGoal ? `目标：${task.userGoal}` : "按自己的目标完成",
    icon: task.icon,
    tone: task.tone,
    description: task.description || "这是你为本轮挑战设置的一项行动。",
    suggestion: task.suggestion || "从自己当前容易完成的版本开始，重点是稳定重复。",
    category: "base",
  };
}

export function scheduledCustomTasks(config: CustomChallengeConfig, challengeDay: number, date: Date) {
  const weekday = date.getDay();
  return config.selectedTasks.filter((task) => {
    if (task.rhythmType === "daily") return true;
    if (task.rhythmType === "every_other_day") return challengeDay % 2 === 1;
    return task.selectedWeekdays.includes(weekday);
  });
}

export function customRequiredCount(total: number, allowedMisses: number) {
  if (total <= 0) return 0;
  return Math.max(1, total - Math.max(0, allowedMisses));
}

export function customDayStatus(completed: number, total: number, required: number) {
  if (total > 0 && completed === total) return { key: "completed", label: "完成日", counted: true };
  if (completed >= required && required > 0) return { key: "qualified", label: "达标日", counted: true };
  return { key: "failed", label: "未达标日", counted: false };
}

export function dateForChallengeDay(startDate: string, day: number) {
  const date = new Date(`${startDate}T12:00:00`);
  date.setDate(date.getDate() + day - 1);
  return date;
}

export function endDateFor(startDate: string, durationDays: number) {
  const date = dateForChallengeDay(startDate, durationDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
