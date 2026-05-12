// src/i18n/translations.js

const translations = {
  zh: {
    // ============ 通用 ============
    app: {
      name: "PainScape",
      subtitle: "让说不出的痛，换一种方式抵达",
      loading: "AI 医疗助理转译中...",
      loadingSub: "正在基于您的痛觉参数生成多语境报告",
      loadingHint: "首次请求可能需要 30-60 秒唤醒服务器，请耐心等待",
      errorBoundary: "页面出了点小问题，请刷新重试",
    },
    painAdjectives: {
      faint: "隐隐约约的",
      persistent: "持续性的", 
      intense: "强烈的",
      extremelyIntense: "极其剧烈的",
    },
    painNames: {
      twist: "绞痛",
      pierce: "刺痛",
      heavy: "坠胀重压",
      wave: "弥漫胀痛",
      scrape: "撕裂刮痛",
    },
    // ============ 开屏页 ============
    splash: {
      quotes: [
        "慢性疼痛相当于长期的“unmaking”——把人困在身体牢笼里。\n—— Elaine Scarry",
        "疼痛不仅是神经的电冲动，它是对自我边界的侵犯。",
        "语言在痛苦面前总是匮乏的，而视觉是一道划破沉默的闪电。",
        "不被看见的痛楚，往往需要承受双倍的煎熬。",
        "拒绝隐忍，让不可言说之痛成为公共的视觉证据。",
        "你的身体是一座战场，允许它留下风暴的痕迹。",
        "这不是矫情，这是一场真切的生理型灾难。",
      ],
    },

    // ============ Onboarding 页 ============
    onboarding: {
      languageLabel: "🌐 目标语言：",
      chinese: "简体中文",
      english: "English",
      guideTitle: "使用指南",
      guideItems: [
        ["🎨 选择画笔", "每种画笔对应一种痛感质地，可混合使用"],
        ["🩸 选择颜色", "不同颜色代表疼痛的情绪与温度"],
        ["✏️ 开始绘制", "在身体图上点击或滑动，画出你的疼痛范围"],
        ["📐 调整视角", "长按 0.3 秒可拖拽移动；双指缩放细节"],
        ["↩️ 撤销/重做", "右侧按钮随时修改，清除重新开始"],
        ["⚡ 生成报告", "右上角【生成】，AI 将转译你的痛觉图谱"],
      ],
      preferenceTitle: "当痛经发作时，你最需要什么？",
      preferences: [
        { key: "alone", title: "🛑 别管我，让我一个人待着" },
        { key: "care", title: "🥣 我没力气，需要实际照顾" },
        { key: "comfort", title: "🫂 我很脆弱，需要情绪陪伴" },
      ],
      medicalTitle: "填写健康信息（可选）",
      cycleLabel: "📅 今天是月经第几天？（可选）",
      cycleOptions: ["第1天", "第2天", "第3-5天", "排卵期痛"],
      diagnosisLabel: "既往诊断（可选）",
      diagnosisOptions: {
        "": "既往诊断（可选）",
        none: "无确诊",
        endometriosis: "子宫内膜异位症",
        adenomyosis: "子宫腺肌症",
        fibroids: "子宫肌瘤",
        pcos: "多囊卵巢综合征",
        pid: "盆腔炎性疾病（PID）",
        ovariancyst: "卵巢囊肿",
        cervicalstenosis: "宫颈管狭窄",
        unchecked: "未做过相关检查",
      },
      allergyLabel: "药物过敏史（可选）",
      allergyOptions: {
        "": "药物过敏史（可选）",
        none: "无已知过敏",
        aspirin: "阿司匹林过敏",
        ibuprofen: "布洛芬过敏",
        nsaids: "多种NSAIDs过敏",
        unknown: "未留意过",
      },
      toneGentle: "🌿 温和",
      toneDirect: "💬 直接",
      toneHint: "温和：安抚为主 / 直接：只说方法",
      switchToMedical: "填写健康信息（可选）",
      switchToPreference: "回到陪伴偏好",
      cycleNotProvided: "未提供",
      startDrawing: "开始绘制",
      quickLog: "⚡ 来不及画，快速记录",
      exploreCommunity: "🌍 探索广场",
      painDiary: "📅 疼痛日记",
      feedbackPrompt: "你的反馈将帮助我们改善产品（可留空提交匿名反馈）：",
      feedbackThanks: "感谢你的反馈！每一条都会被认真阅读。",
      submitFeedback: "📮 提交使用反馈",
      gotIt: "知道了",
    },

    // ============ 画笔与颜色 ============
    brushes: {
      twist: { label: "🌪️ 绞/拧", icon: "🌪️" },
      pierce: { label: "⚡️ 荆/刺", icon: "⚡️" },
      heavy: { label: "🪨 坠/压", icon: "🪨" },
      wave: { label: "〰️ 胀/扩", icon: "〰️" },
      scrape: { label: "🔪 刮/撕", icon: "🔪" },
      eraser: { label: "🧽 橡皮", icon: "🧽" },
    },
    painNames: {
      twist: "绞痛",
      pierce: "刺痛",
      heavy: "坠痛",
      wave: "胀痛",
      scrape: "撕裂痛",
    },
    colors: {
      crimson: { label: "🩸" },
      dark: { label: "🌑" },
      purple: { label: "🔮" },
      blue: { label: "❄️" },
    },
    colorDescriptions: {
      crimson: "深红：急性锐痛/充血",
      dark: "暗灰：沉重钝痛/抑郁",
      purple: "紫：神经性放射痛",
      blue: "冰蓝：发冷/发僵",
    },

    // ============ 画板页 ============
    canvas: {
      bodyFront: "正面",
      bodyBack: "背面",
      bodyNone: "沉浸盲画",
      emotionLoad: "负荷",
      generate: "生成",
    },

    // ============ 结果页 ============
    result: {
      tabs: {
        partner: "伴侣",
        work: "请假",
        doctor: "医生",
        self: "自愈",
      },
      partner: {
        title: "通感说明书",
        experiencing: "她正在经历强烈的",
        actionPrompt: "💡 请立刻执行以下操作：",
        copyAction: "📋 复制实操指令",
      },
      work: {
        title: "高情商请假模板",
        description: "客观描述生理状况，不卑不亢，并留出交接空间。",
        copyTemplate: "📋 复制请假模板",
      },
      doctor: {
        title: "医疗辅助报告",
        disclaimer: "算法生成 · 仅供参考",
        clinicalAdvice: "🩺 临床诊断建议",
        examNotice: "💡 患者检查须知：",
        preparation: "准备：",
        purpose: "目的：",
        attachedMap: "本次多维痛觉图谱已附在报告后方，可向接诊医生展示。",
        discussReference: "📋 供您与医生讨论参考：",
        copyReport: "📋 复制完整报告",
      },
      self: {
        title: "自愈与社群互助",
        comfort: "亲爱的，你画出了你的风暴。痛不是你的错，允许自己今天做一个废物，好好休息吧。",
        copyAdvice: "📋 复制建议保存",
      },
      refine: {
        prompt: "🤖 对当前内容不满意？让 AI 帮你调调语气：",
        placeholder: "如：太正式了 / 想要更温柔 / 加一条热敷建议",
        optimizing: "优化中...",
        optimize: "优化",
        optimizeComplaint: "优化主诉",
        optimizeReference: "优化参考清单",
      },
      shareCard: "一键分享卡片",
      publish: "发布到广场",
      backHome: "返回主页",
      reportError: "报告生成遇到问题",
      backToHome: "返回首页",
    },

    // ============ 社区广场 ============
    community: {
      title: "🌍 共鸣广场",
      back: "返回",
      filterAll: "全部",
      filterFamily: "🏠 家庭群",
      filterFriend: "👥 好友群",
      createGroup: "+ 创建群组",
      createGroupPrompt: "请输入新群组名称（如：家庭群）：",
      joinGroupPrompt: "请输入群组邀请码（演示模式任意输入）：",
      groupCreated: '群组"{{name}}"创建成功！',
      joinedGroup: "已加入群组！",
      newGroup: "新群组",
      emptyState: "🌱 这里还有些安静，数据正在悄悄生长。",
      emptyStateSub: "成为第一个留下足迹的人吧，你的分享就是照亮同路人的微光 ↓",
      emptyStateHint: "—— 或许，这也是大家的痛感正在慢慢变好的信号呢 🍀",
      weeklyStats: '🌸 本周共 {{count}} 位 女性分享了她们的 {{pain}} 经历',
      statsSub: "她们中的许多人,也在这里留下了自己的缓解方法 ↓",
      sentResonance: "共鸣已发送",
    },

    // ============ 快速记录 ============
    quickLog: {
      title: "⚡ 快速记录模式",
      subtitle: "不需要绘画，3秒捕捉此刻的真实痛感",
      painSlider1: "隐隐作痛",
      painSlider2: "痛不欲生",
      generate: "生成报告",
      back: "返回详细记录",
    },

    // ============ 疼痛日记 ============
    history: {
      title: "📋 我的疼痛档案",
      export: "📄 导出PDF",
      back: "返回",
      empty: "还没有记录，去画下第一张痛感图吧。",
      records: "{{count}} 条记录",
      trendTitle: "📊 近期规律",
      trendMostCommon: "最常见痛感",
      trendAvgInterval: "平均发作间隔",
      trendTotal: "总记录次数",
      trendDeviation:
        "你的发作间隔与常见周期（28天）有偏差，建议在就诊时向医生提及。",
    },

    // ============ 日记详情 ============
    diary: {
      close: "关闭",
      recordFeelings: "📝 记录你的感受",
      feelingHint: "「语言在痛苦面前总是匮乏的，但每一种描述都是真实的。」",
      brushCount: "涂抹 {{count}} 次",
      bodyFront: "腹部正面",
      bodyBack: "腰骶背面", 
      bodyBoth: "正背双侧",
      dominantBrush: "主导",
      durationLabel: "⏱️ 这种感觉持续了...",
      durationPlaceholder: "例如：整个下午 / 断断续续几个小时 / 到晚上才缓解",
      reliefLabel: "🌿 什么让你感觉好一些？",
      reliefPlaceholder: "例如：蜷缩起来 / 热敷 / 安静独处...",
      notesLabel: "📓 想记录的其他感受",
      notesPlaceholder: "任何你想说的话...疼痛是真实存在的，不需要被证明。",
      shareContext: "选择分享语境：",
      share: "📤 分享",
      publish: "🌐 发布",
      compareToggle: "📊 与上次发作对比",
      compareHide: "收起对比",
      compareThis: "本次",
      compareLast: "上次",
      compareNoData: "没有更早的记录可对比",
      durationOptions: [
        "蜷缩侧卧，抱紧膝盖",
        "热敷小腹或后腰",
        "安静独处，不被打扰",
        "有人陪伴，握着我的手",
        "听白噪音或轻音乐",
        "喝热水或热饮",
        "垫高臀部平躺",
        "轻轻按摩腹部",
      ],
      periodMorning: "晨间痛",
      periodAfternoon: "午后痛",
      periodNight: "夜间痛",
    },

    // ============ 帖子详情 ============
    post: {
      title: "PainScape 具身证据",
      aiAnalysis: "🤖 AI 痛觉分析：",
      aiDefault:
        "根据图像特征，该痛感呈现典型的机械性收缩特征，伴随局部组织的深度压迫感。",
      selfExperience: "🌿 她的自愈经验：",
      experienceTitle: "💬 她的亲历经验",
      noExperience: "暂无自愈经验，等待过来人分享...",
      addExperience: "+ 补充我的缓解经验（帮助后来者少走弯路）",
      experiencePlaceholder: "分享你的缓解经验（她们在等你的答案）",
      tagsPlaceholder: "针对的症状（如：绞痛，坠痛，用逗号分隔）",
      cancel: "取消",
      publishExperience: "发布经验",
      hugged: "已拥抱",
      giveHug: "给她抱抱",
    },

    // ============ 发布弹窗 ============
    publishModal: {
      title: "💌 留下你的印记",
      hint: "💡 你此刻的感受，也许正是她人在长夜里寻找的共鸣。\n发布后，还可以补充一条缓解经验，告诉姐妹们你是怎么撑过来的。",
      placeholder: "写点什么吧，吐槽也好，倾诉也好，这里懂你……",
      cancel: "再想想",
      submit: "发送共鸣",
    },

    // ============ 分享预览 ============
    sharePreview: {
      shareTitle: "我的痛觉声明卡",
      title: "📤 分享预览",
      loading: "加载中...",
      noContent: "暂无绘画内容",
      livePreview: "实时绘画预览",
      archiveReview: "疼痛档案回顾",
      cancel: "取消",
      confirm: "确认分享",
      defaultTitle: "状态声明",
      defaultDoctorContent: "已记录具身痛觉图谱",
      defaultContent: "正在经历 {{pain}}",
    },

    // ============ Toast 消息 ============
    toast: {
      copySuccess: "文案已复制到剪贴板，可直接粘贴至微信！",
      copyFailed: "复制失败，请重试",
      pdfGenerating: "正在生成 PDF，请稍候...",
      pdfSuccess: "✅ PDF 已生成并下载",
      pdfFailed: "❌ PDF 生成失败，请重试",
      noRecords: "暂无记录可导出",
      saveExperienceRequired: "请写下你的经验",
      postRequired: "写下你的感受吧~",
      refineSuccess: "✨ 内容已优化",
      refineEmpty: "AI 返回了空内容，请重试",
      refineFailed: "❌ AI 优化失败，可能接口未部署或网络异常",
      hugSent: "🤗 抱抱已送达",
      hugRetracted: "收回抱抱",
      shareSaved: "已为您保存分享卡片！",
      shareFailed: "生成分享卡片失败，可能是图片加载超时。请尝试直接截图分享。",
      reportError: "报告生成遇到问题",
      publishSuccess: "你的经历已发布 🌸\n\n目前有 {{count}} 位和你一样经历着\"{{pain}}\"的人。\n\n你的分享,可能正是她们一直在找的答案。",
    },

    // ============ AI 模板 - 痛觉描述 ============
    painTemplates: {
      twist: {
        analogy:
          "想象把一条湿毛巾用力拧干，一圈一圈绞紧，从肚脐一直拧到后腰——那种闷痛从里面往外钻。",
        med: "患者自述下腹部持续性绞痛，呈阵发性加重，伴腰骶部放射痛，月经第1-2天为甚，影响日常功能。建议排查子宫痉挛及盆腔充血。",
        selfCare:
          "✨ 尝试【婴儿蜷缩式】侧卧，双膝抱向胸口，放松盆底肌\n✨ 热水袋敷于小腹和后腰，温度40-45°C，每次20分钟\n✨ 缓慢腹式呼吸：吸气4秒-屏住4秒-呼气6秒\n✨ 补充镁元素（坚果/深绿蔬菜）助肌肉放松\n✨ 允许自己蜷缩在被子里，痛经不是你的错",
      },
      pierce: {
        analogy:
          "想象不打麻药进行根管治疗——那种电钻般的锐痛突然扎进下腹，又麻又刺，像有人拿针在盆腔里搅动。",
        med: "患者自述下腹部锐利刺痛，呈一过性钻痛，可放射至大腿内侧，疼痛突发突止，伴冷汗。建议排查神经性疼痛及子宫内膜异位症。",
        selfCare:
          "✨ 刺痛发作时立即侧卧，避免压迫疼痛点\n✨ 用温热毛巾轻敷（不要太烫，刺痛区域更敏感）\n✨ 听白噪音或轻音乐转移注意力\n✨ 备好温水，小口慢饮保持体温\n✨ 发作间隙可轻微活动脚踝促进循环",
      },
      heavy: {
        analogy:
          "像在腹部绑了5公斤沙袋往下坠，站着就想蹲下，坐下又想躺平——那种沉重感从子宫一直拖到膝盖。",
        med: "患者自述下腹部严重坠胀感，站立时加重，平卧可稍缓解，伴腰骶部酸沉。建议排查盆腔充血、子宫腺肌症可能。",
        selfCare:
          "✨ 尝试【臀部垫高平躺】：用枕头垫高臀部15-20cm\n✨ 减少站立和行走，避免提重物\n✨ 穿着高腰宽松内裤，减少腹部束缚\n✨ 温补饮食：桂圆红枣茶、红糖姜水\n✨ 告诉自己：今天辛苦了，躺着不叫懒",
      },
      wave: {
        analogy:
          "像肚子里有个气球在不断充气又放气，一阵一阵地胀，有时蔓延到整个腹部，连呼吸都觉得憋闷。",
        med: "患者自述腹部弥漫性胀痛，呈阵发性加重，伴肠胀气感，疼痛范围不固定。建议排查水肿、肠胀气及盆腔炎症。",
        selfCare:
          "✨ 穿着极宽松的衣物，解开所有束缚\n✨ 顺时针轻揉腹部（力度要轻，感觉到皮肉即可）\n✨ 避免产气食物：豆类、碳酸饮料、生冷瓜果\n✨ 温敷整个腹部，用毯子营造温暖环境\n✨ 放慢节奏，节奏慢下来，疼痛也会缓下来",
      },
      scrape: {
        analogy:
          "像一颗未成熟的果实被强行剥皮，那种撕裂感从子宫内部向外刮——每动一下都像被砂纸打磨。",
        med: "患者自述下腹部强烈撕裂样锐痛，活动时加剧，伴里急后重感。建议紧急排查组织粘连、子宫内膜异位囊肿破裂可能。",
        selfCare:
          "✨ 这是最耗费体力的痛感，优先静卧休息\n✨ 绝对避免腹部按摩，减少任何体位变化\n✨ 口服温蜂蜜水补充能量（勿空腹服药）\n✨ 用温和声音和自己对话：'我听见了，我在陪你'\n✨ 疼痛稍缓后，记录下这次发作的细节",
      },
    },

    // ============ AI 模板 - 伴侣行动 ============
    partnerActions: {
      alone: [
        "☑️ 帮她倒杯温水，备好{{med}}。",
        "☑️ 调暗灯光，关门出去，不要频繁询问。",
      ],
      care: ["☑️ 搓热手掌捂在她小腹或后腰。主动承担家务。"],
      comfort: ["☑️ 坐在旁边握着她的手，不用说话，给予安全感。"],
    },

    // ============ AI 模板 - 请假 ============
    workTemplate: "领导/HR 您好：本人今日突发严重原发性痛经（{{pain}}），伴随体力透支与冷汗。目前状态已无法维持正常专注度，特申请今日居家休息。紧急事务已交接。感谢批准。",

    // ============ 医疗检查数据库 ============
    examDatabase: {
      盆腔超声: {
        prep: "需在检查前 1 小时饮水 500-800ml，保持充盈膀胱（憋尿）。",
        purpose: "观察子宫形态、内膜厚度，排除肌瘤、腺肌症或卵巢囊肿。",
      },
      经阴道超声: {
        prep: "检查前需排空尿液。如无性生活史请务必告知医生，改为经腹超声。",
        purpose: "更清晰地观察内膜异位病灶及盆腔粘连。建议在月经干净后 3-7 天复查。",
      },
      激素六项: {
        prep: "建议在月经周期的第 2-3 天清晨空腹抽血，检查前静坐 10 分钟。",
        purpose: "评估内分泌状态，排查由于激素失调（如多囊）引起的疼痛。",
      },
      腹腔镜: {
        prep: "这属于微创手术，需住院进行。术前需禁食禁饮。",
        purpose: "子宫内膜异位症诊断的'金标准'，可同时进行病灶剥离。",
      },
    },

    // ============ 分享卡片 ============
    shareCard: {
      titles: {
        partner: "通感说明书",
        work: "不可见痛苦声明",
        doctor: "医疗辅助报告",
        self: "自愈建议",
      },
      footer: "PainScape - 让不可见的痛苦被看见",
    },

    // ============ PDF 导出 ============
   pdf: {
  title: "PainScape",
  subtitle: "患者疼痛档案",
  reportRange: "报告范围：{{start}} - {{end}}",
  totalRecords: "总记录数：{{count}}",
  disclaimer1: "本文档由 AI 基于患者的视觉绘画生成，仅供参考。",
  disclaimer2: "请将此报告出示给您的医生。",
  recordLabel: "记录 {{index}}:{{date}}",
  dominantPain: "主导痛感：{{pain}}",
  medicalComplaint: "医疗主诉：",
  medicalReference: "诊疗参考：",
  footer: "PainScape 生成",
},
  },

  // ==================== 英文 ====================
  en: {
    app: {
      name: "PainScape",
      subtitle: "Let the unspeakable pain find another way to be heard",
      loading: "AI Medical Assistant translating...",
      loadingSub: "Generating multi-context report based on your pain parameters",
      loadingHint:
        "First request may take 30-60 seconds to wake the server, please be patient",
      errorBoundary:
        "Something went wrong with the page, please refresh and try again",
    },
    painAdjectives: {
  faint: "faint",
  persistent: "persistent",
  intense: "intense",
  extremelyIntense: "extremely intense",
},

painNames: {
  twist: "cramping",
  pierce: "stabbing",
  heavy: "heavy dragging",
  wave: "diffuse bloating",
  scrape: "tearing",
},
    splash: {
      quotes: [
        'Chronic pain is a prolonged "unmaking"—trapping a person in a body prison.\n— Elaine Scarry',
        "Pain is not just electrical impulses in nerves; it's an invasion of self-boundaries.",
        "Language always falls short in the face of suffering, but vision is a lightning bolt that cuts through silence.",
        "Pain that goes unseen often demands double the endurance.",
        "Refuse to suffer in silence. Let the unspeakable become public visual evidence.",
        "Your body is a battlefield—allow it to leave traces of the storm.",
        "This is not melodrama; this is a genuine physiological catastrophe.",
      ],
    },

    onboarding: {
      languageLabel: "🌐 Target Language:",
      chinese: "简体中文",
      english: "English",
      guideTitle: "User Guide",
      guideItems: [
        ["🎨 Choose Brush", "Each brush corresponds to a pain texture, mix freely"],
        ["🩸 Choose Color", "Colors represent pain emotion and temperature"],
        ["✏️ Start Drawing", "Tap or swipe on the body map to draw your pain range"],
        ["📐 Adjust View", "Long press 0.3s to drag; pinch to zoom details"],
        ["↩️ Undo/Redo", "Right-side buttons to modify anytime, clear to restart"],
        ["⚡ Generate Report", 'Top right "Generate", AI will translate your pain map'],
      ],
      preferenceTitle: "What do you need most during a dysmenorrhea episode?",
      preferences: [
        { key: "alone", title: "🛑 Leave me alone, let me be" },
        { key: "care", title: "🥣 I'm exhausted, need practical care" },
        { key: "comfort", title: "🫂 I'm fragile, need emotional support" },
      ],
      medicalTitle: "Health Information (Optional)",
      cycleLabel: "📅 What day of your period? (Optional)",
      cycleOptions: ["Day 1", "Day 2", "Day 3-5", "Ovulation Pain"],
      diagnosisLabel: "Previous Diagnosis (Optional)",
      diagnosisOptions: {
        "": "Previous Diagnosis (Optional)",
        none: "No diagnosis",
        endometriosis: "Endometriosis",
        adenomyosis: "Adenomyosis",
        fibroids: "Uterine Fibroids",
        pcos: "PCOS",
        pid: "Pelvic Inflammatory Disease (PID)",
        ovariancyst: "Ovarian Cyst",
        cervicalstenosis: "Cervical Stenosis",
        unchecked: "No exam performed",
      },
      allergyLabel: "Drug Allergies (Optional)",
      allergyOptions: {
        "": "Drug Allergies (Optional)",
        none: "No known allergies",
        aspirin: "Aspirin allergy",
        ibuprofen: "Ibuprofen allergy",
        nsaids: "Multiple NSAIDs allergy",
        unknown: "Unsure",
      },
      toneGentle: "🌿 Gentle",
      toneDirect: "💬 Direct",
      toneHint: "Gentle: soothing / Direct: just the methods",
      switchToMedical: "Health Information (Optional)",
      switchToPreference: "Back to Preferences",
      cycleNotProvided: "Not provided",
      startDrawing: "Start Drawing",
      quickLog: "⚡ No time to draw, quick log",
      exploreCommunity: "🌍 Community",
      painDiary: "📅 Pain Diary",
      feedbackPrompt:
        "Your feedback helps us improve (leave blank for anonymous):",
      feedbackThanks:
        "Thank you for your feedback! Every message is read carefully.",
      submitFeedback: "📮 Submit Feedback",
      gotIt: "Got it",
    },

    brushes: {
      twist: { label: "🌪️ Cramp", icon: "🌪️" },
      pierce: { label: "⚡️ Stab", icon: "⚡️" },
      heavy: { label: "🪨 Drag", icon: "🪨" },
      wave: { label: "〰️ Fullness", icon: "〰️" },
      scrape: { label: "🔪 Tear", icon: "🔪" },
      eraser: { label: "🧽 Eraser", icon: "🧽" },
    },
    painNames: {
      twist: "Cramping",
      pierce: "Stabbing",
      heavy: "Heavy Pain",
      wave: "Distending Pain",
      scrape: "Tearing Pain",
    },
    colors: {
      crimson: { label: "🩸" },
      dark: { label: "🌑" },
      purple: { label: "🔮" },
      blue: { label: "❄️" },
    },
    colorDescriptions: {
      crimson: "Crimson: Acute sharp pain/congestion",
      dark: "Dark Gray: Heavy dull pain/depression",
      purple: "Purple: Neuropathic radiating pain",
      blue: "Ice Blue: Cold/Stiffness",
    },

    canvas: {
      bodyFront: "Front",
      bodyBack: "Back",
      bodyNone: "Blind Mode",
      emotionLoad: "Load",
      generate: "Generate",
    },

    result: {
      tabs: {
        partner: "Partner",
        work: "Leave",
        doctor: "Doctor",
        self: "Self-care",
      },
      partner: {
        title: "Synesthesia Guide",
        experiencing: "She is experiencing intense",
        actionPrompt: "💡 Please do the following immediately:",
        copyAction: "📋 Copy Action List",
      },
      work: {
        title: "Smart Leave Request Template",
        description:
          "Objectively describes physical condition, dignified, with transition space.",
        copyTemplate: "📋 Copy Leave Request",
      },
      doctor: {
        title: "Medical Aid Report",
        disclaimer: "AI-generated · For reference only",
        clinicalAdvice: "🩺 Clinical Recommendation",
        examNotice: "💡 Patient Exam Notice: ",
        preparation: "Preparation: ",
        purpose: "Purpose: ",
        attachedMap:
          "The multidimensional pain map is included in this report for your doctor's reference.",
        discussReference: "📋 For discussion with your doctor:",
        copyReport: "📋 Copy Full Report",
      },
      self: {
        title: "Self-care & Community Support",
        comfort:
          "Dear one, you've drawn your storm. Pain is not your fault. You're allowed to be unproductive today—rest well.",
        copyAdvice: "📋 Copy Self-care Tips",
      },
      refine: {
        prompt: "🤖 Not satisfied? Let AI adjust the tone:",
        placeholder: "e.g.: too formal / make it gentler / add heat pad advice",
        optimizing: "Optimizing...",
        optimize: "Optimize",
        optimizeComplaint: "Optimize Complaint",
        optimizeReference: "Optimize Reference",
      },
      shareCard: "Share Card",
      publish: "Post to Community",
      backHome: "Back to Home",
      reportError: "Report generation encountered an issue",
      backToHome: "Back to Home",
    },

    community: {
      title: "🌍 Community",
      back: "Back",
      filterAll: "All",
      filterFamily: "🏠 Family Group",
      filterFriend: "👥 Friends Group",
      createGroup: "+ Create Group",
      createGroupPrompt: "Enter new group name (e.g., Family Group):",
      joinGroupPrompt:
        "Enter group invitation code (enter anything in demo mode):",
      groupCreated: 'Group "{{name}}" created successfully!',
      joinedGroup: "Successfully joined the group!",
      newGroup: "New Group",
      emptyState: "🌱 It's still quiet here, data is quietly growing.",
      emptyStateSub:
        "Be the first to leave a mark—your sharing is a glimmer of light for fellow travelers ↓",
      emptyStateHint:
        "—— Perhaps this also means everyone's pain is slowly getting better 🍀",
      weeklyStats:
        "🌸 This week {{count}} women shared their {{pain}} experience",
      statsSub: "Many of them also left their relief methods here ↓",
      sentResonance: "Resonance sent",
    },

    quickLog: {
      title: "⚡ Quick Log Mode",
      subtitle: "No drawing needed, capture your real pain in 3 seconds",
      painSlider1: "Mild Discomfort",
      painSlider2: "Unbearable",
      generate: "Generate Report",
      back: "Back to Detailed Log",
    },

    history: {
      title: "📋 My Pain Archive",
      export: "📄 Export PDF",
      back: "Back",
      empty: "No records yet. Go draw your first pain map.",
      records: "{{count}} records",
      trendTitle: "📊 Recent Patterns",
      trendMostCommon: "Most Common Pain",
      trendAvgInterval: "Average Interval",
      trendTotal: "Total Records",
      trendDeviation:
        "Your episode interval deviates from the typical cycle (28 days). Consider mentioning this to your doctor.",
    },

    diary: {
      close: "Close",
      brushCount: "{{count}} brush strokes",
  bodyFront: "Abdomen (Front)",
  bodyBack: "Lower Back",
  bodyBoth: "Both Sides",
  dominantBrush: "Dominant",
      recordFeelings: "📝 Record Your Feelings",
      feelingHint:
        '"Language always falls short before pain, but every description is real."',
      durationLabel: "⏱️ This feeling lasted...",
      durationPlaceholder: "e.g.: all afternoon / on and off for hours / eased by evening",
      reliefLabel: "🌿 What made you feel better?",
      reliefPlaceholder: "e.g.: curled up / heat pad / quiet alone time...",
      notesLabel: "📓 Other feelings you want to record",
      notesPlaceholder:
        "Anything you want to say... Pain is real, it doesn't need to be proven.",
      shareContext: "Choose sharing context:",
      share: "📤 Share",
      publish: "🌐 Post",
      compareToggle: "📊 Compare with Last Episode",
      compareHide: "Hide Comparison",
      compareThis: "This Time",
      compareLast: "Last Time",
      compareNoData: "No earlier records to compare",
      durationOptions: [
        "Curled on side, knees to chest",
        "Heat pad on belly or lower back",
        "Quiet solitude, undisturbed",
        "Someone beside me, holding my hand",
        "White noise or soft music",
        "Hot water or warm drink",
        "Hips elevated, lying flat",
        "Gentle abdominal massage",
      ],
      periodMorning: "Morning Pain",
      periodAfternoon: "Afternoon Pain",
      periodNight: "Night Pain",
    },

    post: {
      title: "PainScape Embodied Evidence",
      aiAnalysis: "🤖 AI Pain Analysis:",
      aiDefault:
        "Based on image characteristics, this pain exhibits typical mechanical contraction features with deep localized tissue pressure.",
      selfExperience: "🌿 Her Relief Experience:",
      experienceTitle: "💬 Her Personal Experience",
      noExperience: "No relief experience yet, waiting for someone to share...",
      addExperience: "+ Share my relief tips (help those who come after)",
      experiencePlaceholder:
        "Share your relief experience (they're waiting for your answer)",
      tagsPlaceholder: "Target symptoms (e.g.: cramping, heavy pain, comma-separated)",
      cancel: "Cancel",
      publishExperience: "Share Experience",
      hugged: "Hugged",
      giveHug: "Give a Hug",
    },

    publishModal: {
      title: "💌 Leave Your Mark",
      hint: "💡 Your current feelings might be exactly the resonance someone else is searching for in the long night.\nAfter posting, you can also add a 'relief tip' to tell others how you got through it.",
      placeholder:
        "Write something—vent, confide, here we understand...",
      cancel: "Think Again",
      submit: "Send Resonance",
    },

    sharePreview: {
         shareTitle: "My Pain Statement Card",
        title: "📤 Share Preview",
        loading: "Loading...",
        noContent: "No drawing content",
        livePreview: "Live Drawing Preview",
        archiveReview: "Pain Archive Review",
        cancel: "Cancel",
        confirm: "Confirm Share",
        defaultTitle: "Status Statement",
        defaultDoctorContent: "Embodied pain map recorded",
        defaultContent: "Currently experiencing {{pain}}",
},

    toast: {
      copySuccess: "Text copied to clipboard!",
      copyFailed: "Copy failed, please try again",
      pdfGenerating: "Generating PDF, please wait...",
      pdfSuccess: "✅ PDF generated and downloaded",
      pdfFailed: "❌ PDF generation failed, please try again",
      noRecords: "No records to export",
      saveExperienceRequired: "Please write down your experience",
      postRequired: "Share your feelings~",
      refineSuccess: "✨ Content optimized",
      refineEmpty: "AI returned empty content, please try again",
      refineFailed:
        "❌ AI optimization failed, API may not be deployed or network error",
      hugSent: "🤗 Hug delivered",
      hugRetracted: "Hug retracted",
      shareSaved: "Share card saved!",
      shareFailed:
        "Failed to generate share card. Please try taking a screenshot instead.",
      reportError: "Report generation encountered an issue",
      publishSuccess: "Your experience has been shared 🌸\n\nThere are currently {{count}} others also experiencing \"{{pain}}\".\n\nYour sharing may be exactly the answer they've been searching for.",
    },

    painTemplates: {
      twist: {
        analogy:
          "Imagine wringing out a thick, soaking wet towel—twisting tighter and tighter from your navel all the way to your lower back. That dull, deep ache that radiates outward from within.",
        med: "Patient reports persistent cramping pain in the lower abdomen, episodic exacerbation with lumbosacral radiation, most severe on days 1-2 of menstruation, affecting daily function. Recommend evaluation for uterine spasms and pelvic congestion.",
        selfCare:
          "✨ Try fetal position: lie on your side, knees to chest, relax pelvic floor\n✨ Heating pad on lower belly and back, 40-45°C, 20 min each session\n✨ Slow belly breathing: inhale 4s - hold 4s - exhale 6s\n✨ Magnesium-rich foods (nuts, dark greens) to ease muscle tension\n✨ You're allowed to curl up in bed. Pain is not your fault",
      },
      pierce: {
        analogy:
          "Imagine getting a root canal without anesthesia—that electric, drilling sharp pain suddenly jabs into your lower abdomen, numb and stinging, like someone stirring a needle inside your pelvis.",
        med: "Patient reports sharp, stabbing pain in lower abdomen, transient drilling sensation radiating to inner thighs, sudden onset and offset, accompanied by cold sweats. Recommend evaluation for neuropathic pain and endometriosis.",
        selfCare:
          "✨ Lie on your side immediately when pain strikes, avoid pressure points\n✨ Apply warm (not hot) compress—stabbing areas are more sensitive\n✨ White noise or soft music to redirect attention\n✨ Keep warm water nearby, sip slowly to maintain body heat\n✨ Between episodes, gently move ankles to improve circulation",
      },
      heavy: {
        analogy:
          "Like tying a 5kg sandbag to your abdomen—standing makes you want to crouch, sitting makes you want to lie flat. That heavy, dragging sensation from your uterus all the way down to your knees.",
        med: "Patient reports severe heavy, dragging sensation in lower abdomen, worsens when standing, slightly relieved lying down, with lumbosacral soreness. Recommend evaluation for pelvic congestion and possible adenomyosis.",
        selfCare:
          "✨ Try elevated hip position: prop hips 15-20cm with pillows, lie flat\n✨ Minimize standing/walking, avoid lifting anything heavy\n✨ Wear high-waist loose underwear, reduce abdominal pressure\n✨ Warm nourishing drinks: red date tea, ginger brown sugar water\n✨ Tell yourself: today was hard, resting isn't laziness",
      },
      wave: {
        analogy:
          "Like a balloon inside your belly constantly inflating and deflating—waves of bloating that spread across your entire abdomen, making even breathing feel suffocating.",
        med: "Patient reports diffuse bloating pain in abdomen, episodic exacerbation with intestinal gas sensation, pain location not fixed. Recommend evaluation for edema, intestinal bloating, and pelvic inflammation.",
        selfCare:
          "✨ Wear the loosest clothes you own, undo all waistbands\n✨ Gentle clockwise abdominal massage (very light pressure only)\n✨ Avoid gas-producing foods: beans, carbonated drinks, raw cold foods\n✨ Heat pad over entire belly, create a warm cocoon with blankets\n✨ Slow everything down—when you slow down, pain slows too",
      },
      scrape: {
        analogy:
          "Like an unripe fruit being forcefully peeled—that tearing sensation scraping from inside your uterus outward. Every movement feels like sandpaper grinding against raw flesh.",
        med: "Patient reports intense tearing sharp pain in lower abdomen, worsens with movement, accompanied by tenesmus. Recommend urgent evaluation for tissue adhesions and possible ruptured endometriotic cyst.",
        selfCare:
          "✨ This is the most draining type of pain—prioritize absolute rest\n✨ Absolutely no abdominal massage, minimize any position changes\n✨ Sip warm honey water for energy (don't take meds on empty stomach)\n✨ Talk to yourself gently: 'I hear you, I'm here with you'\n✨ Once pain eases, jot down details of this episode",
      },
    },

    partnerActions: {
      alone: [
        "☑️ Bring her warm water and prepare {{med}}.",
        "☑️ Dim the lights, close the door, don't check on her too often.",
      ],
      care: [
        "☑️ Rub your palms warm and place on her lower belly or back. Take over household chores.",
      ],
      comfort: [
        "☑️ Sit beside her, hold her hand without speaking—just be there with a sense of safety.",
      ],
    },

    workTemplate: "Dear Manager/HR: I am experiencing a severe primary dysmenorrhea episode today ({{pain}}), accompanied by physical exhaustion and cold sweats. I'm unable to maintain normal focus and am requesting to work from home/rest today. Urgent matters have been delegated. Thank you for your understanding.",

    examDatabase: {
      "pelvic ultrasound": {
        prep: "Requires full bladder: drink 500-800ml water 1 hour before exam.",
        purpose:
          "Evaluates uterine morphology, endometrial thickness, rules out fibroids, adenomyosis, or ovarian cysts.",
      },
      "transvaginal ultrasound": {
        prep: "Empty bladder before exam. If no history of sexual activity, inform doctor to switch to abdominal ultrasound.",
        purpose:
          "Clearer visualization of endometriotic lesions and pelvic adhesions. Best performed 3-7 days after period ends.",
      },
      "hormone panel": {
        prep: "Blood draw on day 2-3 of cycle, fasting in early morning. Sit quietly for 10 minutes before draw.",
        purpose:
          "Evaluates endocrine status, rules out hormone-related pain (e.g., PCOS).",
      },
      laparoscopy: {
        prep: "Minimally invasive surgery requiring hospitalization. Fasting required before procedure.",
        purpose:
          "Gold standard for endometriosis diagnosis, allows simultaneous lesion removal.",
      },
    },

    shareCard: {
      titles: {
        partner: "Synesthesia Guide",
        work: "Invisible Pain Statement",
        doctor: "Medical Aid Report",
        self: "Self-care Suggestions",
      },
      footer: "PainScape - Making invisible pain visible",
    },

    pdf: {
      title: "PainScape",
      subtitle: "Patient Pain Profile",
      reportRange: "Report Range: {{start}} - {{end}}",
      totalRecords: "Total Records: {{count}}",
      disclaimer1:
        "This document is generated by AI based on patient's visual drawing, for reference only",
      disclaimer2: "Please present this to your gynecologist.",
      recordLabel: "Record {{index}}: {{date}}",
      dominantPain: "Dominant Pain: {{pain}}",
      medicalComplaint: "Medical Complaint:",
      medicalReference: "Medical Reference:",
      footer: "PainScape - Generated Report",
    },
  },
};

export default translations;