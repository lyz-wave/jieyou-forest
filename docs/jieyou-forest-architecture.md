# 解忧森林 · 48 小时封包架构

双击打开的 Mac 应用：窗口跑四幕，主进程做闸门、编排和档案。模型只是可选出站，演示不依赖它。

## 运行时

```mermaid
flowchart TB
  user["演示者"]
  user --> fork["首页：今天是心事，还是事情？"]

  fork --> heart["心事 · 情绪小树林"]
  fork --> work["事情 · 散木"]

  heart --> gate{"安全闸门<br/>关键词先判，模型再判"}
  work --> gate

  gate -->|命中| stop["中断<br/>不生树，不开盲盒，不辩论"]
  gate -->|通过| route["主进程编排"]

  route --> feel["情绪识别 → 一句接住"]
  feel --> local["窗口本地完成<br/>三档树 · 三只盲盒 · 年轮"]
  route --> memo["书记改写辩题"]
  memo --> trio["三辩：一次生成，逐角播出"]
  trio --> mirror["折返镜"]
  mirror --> judge["裁决：判断 · 置信度 · 复盘日"]
  route --> bump["两篇笔记 → 幽灵观点"]
  route --> look["扫描档案 → 回顾报告"]

  local --> store[("SQLite 档案")]
  judge --> store
  bump --> store
  look --> store

  feel -.-> seed["内置小艾稿<br/>超时或断网秒切"]
  trio -.-> seed
  mirror -.-> seed
  judge -.-> seed
  bump -.-> seed

  feel --> models["出站，有钥匙才走<br/>DeepSeek 跑量"]
  trio --> models
  mirror --> strong["强模型<br/>折返镜与裁决"]
  judge --> strong
```

双线在闸门之后才分叉。心事走完若藏着待决事项，可以上书；裁决页可以回到林子。碰撞和报告只读同一份档案。

## 进程

```mermaid
flowchart LR
  subgraph app ["解忧森林.app"]
    win["窗口<br/>四幕界面"]
    orch["主进程<br/>闸门与编排"]
    sql[("SQLite<br/>应用数据目录")]
    win <-->|"直播流"| orch
    orch --> sql
  end
  seed["安装包内的小艾稿"] --> orch
  orch -->|"可选"| api["模型 API"]
```

窗口断了不影响兜底稿。预录视频在安装包外，由演示的人切，不进这条链路。

## 档案

```mermaid
erDiagram
  EMOTION_EVENT ||--o| DEBATE : "待决事项上书"
  DEBATE ||--o| EMOTION_EVENT : "裁决后回林子"
  NOTE ||--o{ COLLISION : "任选两篇"
  EMOTION_EVENT {
    string emotion
    int intensity
    bool crisis
    bool has_decision
    int ring
    bool golden_scar
  }
  DEBATE {
    string topic
    string voices
    string mirror
    string judgment
    float confidence
    date review_date
    string framework_type
    string emotional_arc
  }
  NOTE {
    string title
    string body
    string status
    int days_stalled
    int validation_count
  }
  COLLISION {
    string note_a
    string note_b
    string guess
    string ghost
  }
```

## 封包边界

封包内：安全闸门、吐槽到年轮、上书到裁决、幽灵碰撞、回顾报告基础版、小艾合成档案。

封包外：登录、移动端、服务器、真实笔记库、情绪森林、五级成长。
