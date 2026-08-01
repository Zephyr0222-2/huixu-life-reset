export type RouteKey = "7" | "21" | "50";
export type Tone = "blue" | "purple" | "blend" | "mist";

export type TaskDefinition = {
  id: string;
  name: string;
  detail: string;
  icon: string;
  tone: Tone;
  description: string;
  suggestion: string;
  category: "main" | "anchor" | "rotation" | "base" | "optional";
};

export const rulesVersion = 2;

export const routeInfo: Record<RouteKey, {
  days: number;
  name: string;
  label: string;
  description: string;
  structure: string;
  target: string;
}> = {
  "7": {
    days: 7,
    name: "7日清场",
    label: "适合：生活已经有些混乱，不知道先处理什么",
    description: "七天中每天清理一个现实阻力，同时保留身体和注意力两个小锚点。",
    structure: "每日1个清场挑战＋2个小锚点",
    target: "完成至少5个清场挑战，并在第7天留下回序卡",
  },
  "21": {
    days: 21,
    name: "21日稳定",
    label: "适合：能够行动，但作息、活动和注意力经常波动",
    description: "每天完成固定起床、主动活动和收回注意力三项固定挑战，并参与一项轮换附加挑战。",
    structure: "每日3项固定挑战＋1项附加挑战",
    target: "获得15个稳定日，并完成15次附加挑战",
  },
  "50": {
    days: 50,
    name: "50日挑战",
    label: "适合：已有基础，希望长期实践完整生活规则",
    description: "每天照顾五项基础生活规则，并从五项可选挑战中自由选择成长内容。",
    structure: "每日5项基础挑战＋5项可选挑战",
    target: "累计获得40个达标日",
  },
};

export const routeDetails: Record<RouteKey, {
  groups: { label: string; items: string[] }[];
  rules: string[];
}> = {
  "7": {
    groups: [
      { label: "每日清场", items: ["DAY 01 停下信息流", "DAY 02 清理数字空间", "DAY 03 拿回一个空间", "DAY 04 晨起仪式", "DAY 05 处理一件积压", "DAY 06 安排简单的一天", "DAY 07 留下自己的回序方法"] },
      { label: "每日小锚点", items: ["身体锚点：主动活动至少10分钟", "注意力锚点：睡前20分钟不刷信息流"] },
    ],
    rules: ["每天完成当日清场挑战，即记为1个完成日；两个小锚点用于帮助恢复状态，不影响完成日判定。", "7天内完成至少5个清场挑战，并在DAY 07完成回序卡，即完成本轮挑战。"],
  },
  "21": {
    groups: [
      { label: "每日固定挑战", items: ["固定起床：在自己设置的一小时范围内起床", "主动活动：累计至少20分钟", "收回注意力：睡前30分钟不刷信息流"] },
      { label: "轮换附加挑战", items: ["主动补水", "好好吃一餐", "留出安静时间：1小时不接收信息流", "认真照顾自己", "真实连接", "停止一项自动行为", "为明天做准备"] },
    ],
    rules: ["前三项固定挑战全部完成，才记为1个稳定日。附加挑战手动勾选完成，按完成次数单独累计。", "21天内累计获得至少15个稳定日，并完成至少15次附加挑战，即完成本轮挑战。"],
  },
  "50": {
    groups: [
      { label: "每日基础挑战", items: ["稳定起床", "晨间仪式：至少10分钟", "主动活动：累计至少30分钟", "好好吃饭：完成一顿完整、营养均衡的正餐", "每日记录与反思：手动确认，不强制在回序输入文字"] },
      { label: "自由选择的可选挑战", items: ["阅读：至少10分钟", "学习新技能：至少30分钟", "屏蔽信息流：至少2小时", "身体觉察：至少10分钟", "创造性输出：完成一次具体产出"] },
    ],
    rules: ["每天5项基础挑战至少完成4项，即记为1个达标日；可选挑战不影响达标日判定，只累计完成次数。", "50天内累计获得至少40个达标日，即完成本轮挑战。"],
  },
};

const clearMain: Omit<TaskDefinition, "category">[] = [
  { id: "clear-stream", name: "停下信息流", detail: "连续4小时", icon: "◌", tone: "blue", description: "连续4小时不打开短视频、推荐页、热榜或无目的信息流。必要通讯、导航和主动搜索不受限制。推荐内容会不断为注意力安排下一个目标，暂停一段时间可以让大脑重新决定自己要看什么、做什么。", suggestion: "开始前关闭相关通知，把常用信息流入口移出首页，并提前选好替代活动，例如散步、听音乐、看完整文章或整理房间。" },
  { id: "clear-digital", name: "清理数字空间", detail: "完成3项整理", icon: "⌘", tone: "blend", description: "完成三项数字整理。杂乱的通知、标签页和应用入口会制造持续但不易察觉的干扰，清理它们可以减少以后每天重复发生的消耗。", suggestion: "可从关闭无用通知、清理浏览器标签、退出低价值群聊、整理手机首页、删除闲置应用、取消无用订阅中任选三项。" },
  { id: "clear-space", name: "拿回一个空间", detail: "恢复1个小区域", icon: "⌂", tone: "purple", description: "让一个小区域恢复正常使用。不需要一次整理整个房间，只要一个常用区域重新可用，生活就会少一个现实阻力。", suggestion: "选择床边、桌面、衣物区、背包或厨房一角。先移走垃圾和无关物品，再给常用物品留下固定位置。" },
  { id: "clear-morning", name: "晨起仪式", detail: "至少10分钟", icon: "☼", tone: "blue", description: "起床后完成至少10分钟的晨间准备。它不要求早起，而是帮助身体和注意力从睡眠状态平稳进入一天。", suggestion: "可以温水补水、简单拉伸、梳理当日待办、户外快走、清淡早餐等。选择两三项，组成自己容易重复的晨起流程。" },
  { id: "clear-backlog", name: "处理一件积压", detail: "3件小事或1件重要事", icon: "◇", tone: "blend", description: "完成三件小事，或让一件重要事项产生明确进展。今天不追求清空清单，只结束一件反复惦记的事情。", suggestion: "把事项改写成可以直接执行的动作，例如“预约体检时间”“回复那封邮件”，而不是“处理健康问题”“整理工作”。" },
  { id: "clear-day", name: "安排简单的一天", detail: "3个时间锚点＋1项准备", icon: "◷", tone: "purple", description: "为明天设置三个时间锚点，并提前完成一个准备动作。简单安排不是把一天塞满，而是减少临时决定和反复犹豫。", suggestion: "只确定大致起床时间、主要行动时段和晚间停止信息流的时间，再提前准备衣物、早餐或所需用品。" },
  { id: "clear-card", name: "留下自己的回序方法", detail: "完成回序卡", icon: "回", tone: "blend", description: "完成一张回序卡，从七天的真实记录中找出以后生活混乱时仍然可以使用的方法。", suggestion: "回答：什么最容易打乱生活、什么行动最有效、身体需要什么、注意力需要什么边界、下次先恢复什么、最后只保留哪一件事。" },
];

const rotationGroups = [
  { id: "water", name: "主动补水", detail: "三个时间点完成两个", icon: "◉", description: "在起床后、午饭前后、晚饭前后三个时间点中，至少主动喝水两次。把补水绑定生活节点，比依赖临时想起更容易形成习惯。", suggestion: "把水杯放在经常活动的位置，喝完后再补满。不需要追求固定容量，也不要一次大量饮水。" },
  { id: "meal", name: "好好吃一餐", detail: "认真完成一顿正餐", icon: "◒", description: "认真完成至少一顿正餐，不用零食或饮料随便替代。稳定的一餐能提供基本能量，也能帮助一天形成自然的时间结构。", suggestion: "尽量包含主食、蛋白质和蔬菜；吃饭时暂时离开短视频和推荐内容。" },
  { id: "quiet", name: "留出安静时间", detail: "1小时不接收信息流", icon: "◎", description: "连续一个小时不接收新的高密度信息。注意力不仅需要专注，也需要没有新输入的恢复时间。", suggestion: "可以散步、静坐、洗澡、收拾物品或只是发呆。必要通讯和主动搜索不受限制，重点是不继续打开新的推荐内容。" },
  { id: "care", name: "认真照顾自己", detail: "完成1件生活照料", icon: "✦", description: "完成一件已经被忽略的生活照料。照顾自己往往就是处理那些持续降低舒适度的小问题。", suggestion: "可以洗澡、更换床单、整理衣物、补充生活用品、修剪指甲或处理一个小不适。" },
  { id: "connect", name: "真实连接", detail: "一次有内容的联系", icon: "∞", description: "与一个真实的人产生一次有内容的联系。真实连接不是刷到动态，而是一次能够得到回应、表达关心或分享近况的互动。", suggestion: "可以见面、通话或认真发一段消息。试着问一个具体问题，或说一件真实近况。" },
  { id: "boundary", name: "停止一项自动行为", detail: "设置并执行一个边界", icon: "◐", description: "为一个无意识行为设置边界，并在今天执行。看见触发点，才能重新获得选择权。", suggestion: "选择一个具体行为，例如躺下就刷手机；为它设置时间、地点或次数边界，并准备替代动作。" },
  { id: "prepare", name: "为明天做准备", detail: "晚上至少10分钟", icon: "→", description: "晚上用至少10分钟，提前减少明天的一个现实阻力。准备不是控制明天，而是让明天开始时少一个临时问题。", suggestion: "可以准备衣物、早餐、出门物品、待办清单或整理工作区域。只处理最可能阻碍明天开始的一件事。" },
];

const longBase: TaskDefinition[] = [
  { id: "long-wake", name: "稳定起床", detail: "在目标范围内离开床铺", icon: "☼", tone: "blue", category: "base", description: "在自己设置的一小时范围内起床并离开床铺。稳定起床帮助身体建立节律，也减少每天重新决定什么时候开始的消耗。", suggestion: "把闹钟放在必须起身才能关闭的位置，起床后先拉开窗帘或接触自然光。周末也尽量不要偏离太多。" },
  { id: "long-morning", name: "晨间仪式", detail: "至少10分钟", icon: "◌", tone: "blend", category: "base", description: "起床后完成至少10分钟的晨间准备，帮助身体、空间和注意力平稳过渡到一天。", suggestion: "可以温水补水、简单拉伸、梳理当日待办、户外快走、清淡早餐等。选择两三项组成容易重复的流程。" },
  { id: "long-body", name: "主动活动", detail: "累计至少30分钟", icon: "⌁", tone: "blue", category: "base", description: "累计主动活动至少30分钟，可以分段完成。主动活动也是改善久坐和重新感受身体的重要方式。", suggestion: "可以快走、骑车、健身、拉伸、游泳、跳操或有意识地做家务。没有完整时间时，可拆成三次10分钟。" },
  { id: "long-meal", name: "好好吃饭", detail: "一顿完整、均衡的正餐", icon: "◒", tone: "purple", category: "base", description: "至少完成一顿相对完整、营养更均衡的正餐，不用零食或含糖饮料随便替代。", suggestion: "尽量同时包含主食、优质蛋白质和蔬菜，例如米饭加鸡蛋、鱼肉或豆制品，再搭配一份蔬菜。无需精确计算热量。" },
  { id: "long-reflect", name: "每日记录与反思", detail: "手动确认完成，不强制输入", icon: "⌁", tone: "mist", category: "base", description: "完成一次简短记录或反思。可以写在回序、其他日记软件或纸质日记中，文字内容不强制保存在回序。", suggestion: "可以只回答一个问题：今天什么让我更稳定？什么消耗了我？明天最想保留哪一个行动？" },
];

const longOptional: TaskDefinition[] = [
  { id: "long-read", name: "阅读", detail: "至少10分钟", icon: "□", tone: "blue", category: "optional", description: "主动阅读至少10分钟。阅读是一种由自己选择节奏的连续输入，能够替代碎片化的信息消费。", suggestion: "纸质书、电子书、长文章或专业材料都可以。提前选好内容，避免把阅读时间花在寻找材料上。" },
  { id: "long-skill", name: "学习新技能", detail: "至少30分钟", icon: "✦", tone: "blend", category: "optional", description: "围绕一个明确对象学习或练习至少30分钟。技能成长来自持续练习，而不是收藏教程。", suggestion: "先确定具体产出，例如完成一道练习、临摹一个案例、练习一个动作或整理一页笔记。" },
  { id: "long-stream", name: "屏蔽信息流", detail: "至少2小时", icon: "◌", tone: "purple", category: "optional", description: "连续至少2小时不打开短视频、推荐页、热榜或无目的信息流。必要通讯、导航和主动搜索不受限制。", suggestion: "关闭通知、把应用移出首页，并提前安排替代活动。" },
  { id: "long-awareness", name: "身体觉察", detail: "至少10分钟", icon: "◎", tone: "mist", category: "optional", description: "完成一次至少10分钟的身体觉察练习，注意呼吸、紧张、疲劳和身体感受。", suggestion: "可以冥想、静坐、呼吸练习、身体扫描或安静拉伸。走神很正常，注意到以后再回到身体即可。" },
  { id: "long-create", name: "创造性输出", detail: "完成一次具体产出", icon: "✧", tone: "blend", category: "optional", description: "完成一次有具体产出的创造活动，把注意力从消费内容转向形成作品。", suggestion: "可以做手工、写文章、画画、摄影、编曲、设计、做饭或制作内容。不要求公开，也不要求专业。" },
];

export function getTasks(route: RouteKey, day: number): TaskDefinition[] {
  if (route === "7") {
    const main = clearMain[Math.min(day - 1, clearMain.length - 1)];
    return [
      { ...main, category: "main" },
      { id: "clear-anchor-body", name: "身体锚点", detail: "主动活动至少10分钟", icon: "⌁", tone: "blue", description: "主动活动至少10分钟。身体活动能打断长时间的停滞，让人重新感受到自己可以采取行动。", suggestion: "散步、拉伸、骑车、遛狗或有意识地做家务都可以。选择今天最容易开始的一种，不追求强度。", category: "anchor" },
      { id: "clear-anchor-focus", name: "注意力锚点", detail: "睡前20分钟不刷信息流", icon: "☾", tone: "purple", description: "睡前20分钟停止短视频、推荐页和无目的信息流，给注意力留下收尾时间。", suggestion: "提前选择洗漱、音乐、纸质阅读、准备明天用品或安静坐一会儿作为替代，不需要完全关闭手机。", category: "anchor" },
    ];
  }
  if (route === "21") {
    const groupIndex = Math.min(Math.floor((day - 1) / 3), rotationGroups.length - 1);
    const groupDay = ((day - 1) % 3) + 1;
    const rotation = rotationGroups[groupIndex];
    return [
      { id: "stable-wake", name: "固定起床", detail: "在目标范围内起床", icon: "☼", tone: "blue", description: "在自己设置的一小时范围内起床并离开床铺。相对固定的起床时间可以帮助身体形成稳定节律。", suggestion: "包括周末在内都尽量保持相近范围。前一晚偶尔睡晚时可以适当放宽，但尽量不要补觉到打乱下一天。", category: "anchor" },
      { id: "stable-body", name: "主动活动", detail: "累计至少20分钟", icon: "⌁", tone: "blend", description: "累计主动活动至少20分钟，可以分段完成。它帮助身体从久坐、疲惫或迟钝中恢复。", suggestion: "散步、骑车、拉伸、运动、遛狗或有意识的家务都可以。一次完成困难时，可以拆成两次10分钟。", category: "anchor" },
      { id: "stable-focus", name: "收回注意力", detail: "睡前30分钟不刷信息流", icon: "☾", tone: "purple", description: "睡前30分钟停止短视频、推荐页和无目的信息流，为一天建立明确边界。", suggestion: "提前选择洗漱、听音乐、整理明天用品、阅读或安静坐一会儿。必要通讯和主动搜索仍然可以使用。", category: "anchor" },
      { id: `rotation-${rotation.id}`, name: rotation.name, detail: `${rotation.detail} · 第${groupDay}天`, icon: rotation.icon, tone: "mist", description: rotation.description, suggestion: rotation.suggestion, category: "rotation" },
    ];
  }
  return [...longBase, ...longOptional];
}

export function getDayStatus(route: RouteKey, doneIds: string[], day = 1) {
  const done = new Set(doneIds);
  const tasks = getTasks(route, day);
  if (route === "7") return done.has(tasks[0].id)
    ? { key: "complete", label: "完成日", counted: true }
    : { key: "incomplete", label: "未完成日", counted: false };
  if (route === "21") {
    const anchors = ["stable-wake", "stable-body", "stable-focus"].filter((id) => done.has(id)).length;
    return anchors === 3
      ? { key: "stable", label: "稳定日", counted: true }
      : { key: "incomplete", label: "", counted: false };
  }
  const baseCount = ["long-wake", "long-morning", "long-body", "long-meal", "long-reflect"].filter((id) => done.has(id)).length;
  if (baseCount === 5) return { key: "full", label: "全部完成日", counted: true };
  if (baseCount >= 4) return { key: "qualified", label: "达标日", counted: true };
  return { key: "incomplete", label: "未达标日", counted: false };
}

export function getStageLabel(route: RouteKey, day: number) {
  if (route === "7") return clearMain[Math.min(day - 1, 6)].name;
  if (route === "21") return `DAY ${String(day).padStart(2, "0")}`;
  return "完整生活规则";
}

export const encouragements: Record<RouteKey, string[]> = {
  "7": ["你不是失去了注意力，只是今天开始把它领回来。", "少一个干扰入口，生活就多一小块安静。", "一个角落重新可用，生活就多了一个落脚点。", "早晨不需要完美，只需要一个清醒的开始。", "一件被处理的积压，会释放一小块注意力。", "简单的安排，是在为明天减少阻力。", "真正值得留下的，不是坚持本身，而是你找到的方法。"],
  "21": ["稳定不是突然改变，而是今天有一个清晰的开始。", "重复一次看似普通的行动，也是在建立新的节奏。", "不必追赶昨天，先让今天完整地发生。", "身体知道你正在认真照顾这一天。", "节奏不是束缚，而是减少反复决定的消耗。", "今天的稳定不需要漂亮，只需要真实完成。", "第一周走完了，留下来的是几个可以重复的动作。", "偶尔偏离不会清空之前走过的路。", "让注意力回来一点，生活就会清楚一点。", "你正在把偶然做到的事，慢慢变成可以依靠的事。", "普通的一天被认真完成，本身就很重要。", "今天不需要更多目标，把三个固定动作照顾好就够了。", "稳定并不等于没有变化，而是变化之后仍能回来。", "两周的重复，已经开始形成属于你的生活线索。", "达到一个条件不是终点，而是证明这套节奏可以被你使用。", "越接近结束，越不需要额外用力，只需要继续真实记录。", "今天完成的小事，会成为下一次混乱时的入口。", "你不必每天感觉良好，也可以每天留下一点秩序。", "稳定不是永远不乱，而是知道乱了以后先恢复什么。", "接近终点时，也允许自己按原来的步幅继续。", "二十一天留下的，是一套你已经亲自试过的生活方法。"],
  "50": ["今天不需要证明什么，先完成一个能够重复的开始。", "节奏来自普通日子的重复，不只来自状态最好的时候。", "做到四项已经足够让今天成为一个达标日。", "给身体稳定的输入，也是在给生活稳定的回应。", "记录一句真实感受，比写下完美总结更有价值。", "一天的秩序，常常从起床后的十分钟开始。", "第一周不是考验意志，而是在认识什么方法适合你。", "不必一次提高所有标准，先把基本动作做稳。", "今天的活动可以很普通，只要身体真正参与了。", "一顿完整的饭，也是对自己生活负责的方式。", "让早晨有一个流程，后面的行动会少一点阻力。", "少完成一项不代表这一天没有价值，真实记录就好。", "可选挑战是探索，不是另一份必须完成的清单。", "两周的行动已经开始形成可以辨认的节奏。", "你不需要依靠每天都有动力，流程可以替你承担一部分。", "今天只关注今天的五项，不提前承担剩下的日子。", "当生活变忙，最低标准会帮助你继续留在挑战里。", "重复不是停滞，它让有效的方法变得更可靠。", "留意今天最容易完成的一项，那可能是你的稳定入口。", "完整的一餐、一次活动、一次记录，都在把生活带回现实。", "三周以后，你已经拥有了一段可以回看的真实样本。", "今天可以调整做法，但不必改变对事实的记录。", "不是每一天都要有突破，普通地完成也很好。", "让一项行动更容易开始，比要求自己更自律更有效。", "走到一半，值得看的还有哪些动作真的帮到了你。", "后半程不需要加速，继续按可以长期承受的节奏走。", "今天的记录会提醒未来的你：什么曾经有效。", "状态变化时，先保护基础挑战，再决定是否增加可选内容。", "稳定起床不是控制一天，而是为一天提供一个坐标。", "晨间仪式不必固定形式，只要它确实帮助你开始。", "主动活动不是惩罚身体，而是重新和身体站在一起。", "好好吃饭不需要精确完美，先让营养比昨天完整一点。", "反思不是评价自己，只是看清今天发生了什么。", "可选挑战完成一次，就多发现一种可能适合你的生活内容。", "五周的记录已经足够让感受变成可以观察的规律。", "今天如果很累，就用最低可行的方式完成基础动作。", "中断没有让挑战归零，回来本身就是一次有效行动。", "你正在练习的不是连续打卡，而是长期照顾生活的能力。", "达标不是完美，它只是说明今天的基础被照顾到了。", "四十天的积累已经证明，稳定可以由许多普通日子组成。", "接近终点以后，更要保留真实，不需要为了数字美化结果。", "今天做不到的部分，也可以成为下一次调整方法的线索。", "已经有效的流程不必频繁更换，让它继续为你服务。", "把注意力放回下一项具体行动，而不是剩余天数。", "你可以开始思考：挑战结束后，最想留下哪三件事。", "结束挑战不等于结束这些行动，而是把选择权交还给你。", "看看哪些可选挑战给了你能量，而不是只增加任务。", "最后几天不需要冲刺，保持原来的节奏就是最好的收尾。", "明天会完成这一轮，今天仍然只需要认真完成今天。", "五十天留下的不是一张成绩单，而是一套经过你生活验证的方法。"],
};
