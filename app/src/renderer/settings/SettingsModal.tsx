import { useState, useEffect } from 'react'
import type { ModelConfigDto, TestModelResult } from '../../shared/ipc'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ProviderPreset {
  id: string
  name: string
  baseUrl: string
  model: string
  hint: string
}

const PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek 官方',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    hint: '推荐 · 极具共情力与反思深度的官方端点',
  },
  {
    id: 'openai',
    name: 'OpenAI 官方',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    hint: '全球标准接口，支持 gpt-4o / gpt-4o-mini',
  },
  {
    id: 'qwen',
    name: '阿里通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    hint: '阿里云百炼兼容模式，支持 qwen-max / qwen-plus',
  },
  {
    id: 'zhipu',
    name: '智谱清言 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    hint: '清华智谱开放平台，支持 glm-4 系列',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    hint: 'SiliconFlow 聚合推理平台，性价比优选',
  },
  {
    id: 'custom',
    name: '自定义中转站 / OneAPI',
    baseUrl: '',
    model: '',
    hint: '支持 OneAPI、NewAPI、各类代理中转或本地 Ollama',
  },
]

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [config, setConfig] = useState<ModelConfigDto>({
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKey: '',
  })
  const [showKey, setShowKey] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>('deepseek')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestModelResult | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)

  useEffect(() => {
    if (isOpen && window.forest?.getModelConfig) {
      window.forest.getModelConfig().then((cfg) => {
        if (cfg) {
          setConfig(cfg)
          // 判断属于哪个预设
          const matched = PRESETS.find(
            (p) => p.id !== 'custom' && cfg.baseUrl.includes(new URL(p.baseUrl).hostname),
          )
          if (matched) {
            setSelectedPreset(matched.id)
          } else {
            setSelectedPreset('custom')
          }
        }
      })
      setTestResult(null)
      setSavedNotice(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const applyPreset = (preset: ProviderPreset) => {
    setSelectedPreset(preset.id)
    if (preset.id !== 'custom') {
      setConfig((prev) => ({
        ...prev,
        baseUrl: preset.baseUrl,
        model: preset.model,
        // 换端点时把识别模型清空，回到按端点自动推断，
        // 免得留下上一个厂商的模型名导致 400。
        asrModel: '',
      }))
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await window.forest.testModelConfig(config)
      setTestResult(res)
    } catch (err: any) {
      setTestResult({
        ok: false,
        error: err.message || '网络连接测试异常',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    try {
      await window.forest.saveModelConfig(config)
      setSavedNotice(true)
      setTimeout(() => {
        setSavedNotice(false)
        onClose()
      }, 1000)
    } catch (err: any) {
      alert('保存失败: ' + (err.message || '未知错误'))
    }
  }

  return (
    <div
      className="settings-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18, 24, 20, 0.48)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="settings-modal-card card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 580,
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'rgba(255, 253, 248, 0.94)',
          border: '1px solid rgba(220, 205, 185, 0.75)',
          borderRadius: 22,
          padding: '24px 28px',
          boxShadow: '0 20px 48px -12px rgba(35, 30, 20, 0.28)',
          position: 'relative',
        }}
      >
        {/* 头部 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
              ⚙️ 大模型与中转站设置
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              配置你的 OpenAI 兼容端点，离线或无 Key 时将自动无缝降级为内置心理模型
            </p>
          </div>
          <button
            type="button"
            className="ghost"
            onClick={onClose}
            aria-label="关闭设置"
            style={{ padding: '6px 12px', fontSize: 16 }}
          >
            ✕
          </button>
        </div>

        {/* 预设提供商标签栏 */}
        <div style={{ marginBottom: 16 }}>
          <label className="field" style={{ marginBottom: 8, display: 'block', fontSize: 12, fontWeight: 600 }}>
            厂商与中转站预设
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                aria-pressed={selectedPreset === p.id}
                onClick={() => applyPreset(p)}
                style={{
                  fontSize: 12,
                  padding: '5px 11px',
                  fontWeight: selectedPreset === p.id ? 600 : 400,
                  border: selectedPreset === p.id ? '1px solid #4a8d5c' : undefined,
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
          {PRESETS.find((p) => p.id === selectedPreset)?.hint && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#3d6148' }}>
              💡 {PRESETS.find((p) => p.id === selectedPreset)?.hint}
            </p>
          )}
        </div>

        {/* 表单项 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Base URL */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label className="field" style={{ marginBottom: 4 }}>
                Base URL (API 地址)
              </label>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>自动兼容 /v1 与 /chat/completions</span>
            </div>
            <input
              type="text"
              value={config.baseUrl}
              placeholder="例如 https://api.deepseek.com/v1 或中转站地址"
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(180, 160, 130, 0.45)',
                background: 'rgba(255, 255, 255, 0.85)',
                fontSize: 13,
                fontFamily: 'monospace',
              }}
            />
          </div>

          {/* API Key */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label className="field" style={{ marginBottom: 4 }}>
                API Key (密钥)
              </label>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>纯本地持久化，永不上传第三方</span>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey || ''}
                placeholder="sk-..."
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 42px 10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(180, 160, 130, 0.45)',
                  background: 'rgba(255, 255, 255, 0.85)',
                  fontSize: 13,
                  fontFamily: 'monospace',
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? '隐藏密钥' : '显示密钥'}
                style={{
                  position: 'absolute',
                  right: 8,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  padding: '4px 6px',
                  fontSize: 13,
                }}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Model Name */}
          <div>
            <label className="field" style={{ marginBottom: 4, display: 'block' }}>
              Model (模型标识名称)
            </label>
            <input
              type="text"
              value={config.model}
              placeholder="例如 deepseek-chat, gpt-4o-mini, qwen-plus"
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(180, 160, 130, 0.45)',
                background: 'rgba(255, 255, 255, 0.85)',
                fontSize: 13,
              }}
            />
          </div>

          {/* 语音识别模型（可选） */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label className="field" style={{ marginBottom: 4 }}>
                语音识别模型（可选）
              </label>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>留空则按端点自动推断</span>
            </div>
            <input
              type="text"
              value={config.asrModel || ''}
              placeholder="whisper-1"
              onChange={(e) => setConfig({ ...config, asrModel: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(180, 160, 130, 0.45)',
                background: 'rgba(255, 255, 255, 0.85)',
                fontSize: 13,
                fontFamily: 'monospace',
              }}
            />
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              语音输入会调用 <code>{'{baseUrl}'}/audio/transcriptions</code>。OpenAI 用 <code>whisper-1</code>；
              硅基流动用 <code>FunAudioLLM/SenseVoiceSmall</code>。DeepSeek 官方端点没有这条路，
              要单独配一个支持转写的地址。
            </p>
          </div>
        </div>

        {/* 测试连通性结果反馈 */}
        {testResult && (
          <div
            style={{
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 13,
              background: testResult.ok ? 'rgba(74, 141, 92, 0.12)' : 'rgba(190, 60, 50, 0.12)',
              border: `1px solid ${testResult.ok ? 'rgba(74, 141, 92, 0.35)' : 'rgba(190, 60, 50, 0.35)'}`,
              color: testResult.ok ? '#2d6a3f' : '#b03025',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{testResult.ok ? `✓ ${testResult.message}` : `✕ 测试失败: ${testResult.error}`}</span>
            {testResult.latencyMs !== undefined && (
              <span style={{ fontSize: 11, opacity: 0.85 }}>{testResult.latencyMs}ms</span>
            )}
          </div>
        )}

        {/* 隐私与断网说明 */}
        <div
          style={{
            marginTop: 18,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(0, 0, 0, 0.03)',
            fontSize: 12,
            color: 'var(--muted)',
            lineHeight: 1.5,
          }}
        >
          🔒 <strong>隐私说明：</strong>
          密钥与请求地址仅保存在本机（SQLite / localStorage），应用直接与你的目标端点通信，零中转。
          未配置 API 时可离线完整使用所有舒缓与年轮功能；
          <strong>只有语音输入例外</strong>——按麦克风录下的音频会发往上面填写的端点做转写，
          除此之外不会上传任何内容。
        </div>

        {/* 操作栏 */}
        <div
          style={{
            marginTop: 22,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            alignItems: 'center',
          }}
        >
          {savedNotice && (
            <span style={{ color: '#2d6a3f', fontSize: 13, fontWeight: 600 }}>✓ 已保存并即时热更新</span>
          )}
          <button
            type="button"
            className="ghost"
            onClick={handleTest}
            disabled={testing || !config.apiKey?.trim()}
            style={{ minWidth: 100 }}
          >
            {testing ? '正在测速...' : '测试连通性'}
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleSave}
            style={{ minWidth: 100 }}
          >
            保存并应用
          </button>
        </div>
      </div>
    </div>
  )
}
