import { describe, expect, it } from 'vitest'
import { defaultAsrModel, guessAudioFilename, normalizeTranscriptionUrl } from './asr'

// 语音输入是「点了没反应」的重灾区：端点拼错、模型名不对都只会得到一句
// 服务端报错。这两个纯函数是唯一能在本地锁住行为的地方。

describe('normalizeTranscriptionUrl', () => {
  it('把 /vN 结尾的地址补成 /audio/transcriptions', () => {
    expect(normalizeTranscriptionUrl('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/audio/transcriptions',
    )
    expect(normalizeTranscriptionUrl('https://api.siliconflow.cn/v1')).toBe(
      'https://api.siliconflow.cn/v1/audio/transcriptions',
    )
  })

  it('容忍结尾斜杠与空白', () => {
    expect(normalizeTranscriptionUrl('  https://api.openai.com/v1/  ')).toBe(
      'https://api.openai.com/v1/audio/transcriptions',
    )
  })

  it('裸域名补 /v1/audio/transcriptions', () => {
    expect(normalizeTranscriptionUrl('https://api.openai.com')).toBe(
      'https://api.openai.com/v1/audio/transcriptions',
    )
  })

  it('从聊天端点改写而来', () => {
    expect(normalizeTranscriptionUrl('https://api.openai.com/v1/chat/completions')).toBe(
      'https://api.openai.com/v1/audio/transcriptions',
    )
  })

  it('兼容模式与多段路径', () => {
    expect(normalizeTranscriptionUrl('https://dashscope.aliyuncs.com/compatible-mode/v1')).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/audio/transcriptions',
    )
    expect(normalizeTranscriptionUrl('https://relay.example.com/api/v1')).toBe(
      'https://relay.example.com/api/v1/audio/transcriptions',
    )
    expect(normalizeTranscriptionUrl('https://relay.example.com/proxy')).toBe(
      'https://relay.example.com/proxy/audio/transcriptions',
    )
  })

  it('已经是转写端点就原样返回', () => {
    const url = 'https://relay.example.com/v1/audio/transcriptions'
    expect(normalizeTranscriptionUrl(url)).toBe(url)
  })

  it('空输入返回空串，交给调用方报错', () => {
    expect(normalizeTranscriptionUrl('   ')).toBe('')
  })
})

describe('defaultAsrModel', () => {
  it('硅基流动用 SenseVoiceSmall', () => {
    expect(defaultAsrModel('https://api.siliconflow.cn/v1')).toBe('FunAudioLLM/SenseVoiceSmall')
  })

  it('其余端点退回 whisper-1', () => {
    expect(defaultAsrModel('https://api.openai.com/v1')).toBe('whisper-1')
    expect(defaultAsrModel('https://relay.example.com/v1')).toBe('whisper-1')
  })

  it('地址不成形也不抛错', () => {
    expect(defaultAsrModel('not-a-url')).toBe('whisper-1')
  })
})

describe('guessAudioFilename', () => {
  it('按容器类型给后缀，识别服务多依赖后缀判格式', () => {
    expect(guessAudioFilename('audio/webm;codecs=opus')).toBe('audio.webm')
    expect(guessAudioFilename('audio/mp4')).toBe('audio.m4a')
    expect(guessAudioFilename('audio/mpeg')).toBe('audio.mp3')
    expect(guessAudioFilename('audio/ogg;codecs=opus')).toBe('audio.ogg')
    expect(guessAudioFilename('')).toBe('audio.webm')
  })
})
