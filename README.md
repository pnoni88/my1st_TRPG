# RETRO QUEST — AI 게임 마스터 TRPG

레트로 CRT 터미널 감성의 텍스트 TRPG입니다. Claude / ChatGPT / Gemini 같은 AI가 **게임 마스터(GM)** 가 되어 이야기를 실시간으로 만들어내고, 규칙을 조율하며 게임을 진행합니다.

## 실행 방법

별도 설치가 필요 없는 정적 웹앱입니다.

- **가장 간단하게**: `index.html` 파일을 브라우저(Chrome/Edge 권장)로 열면 됩니다.
- **로컬 서버로 실행** (권장):
  ```
  npx http-server -p 8123
  ```
  후 브라우저에서 `http://localhost:8123` 접속.

## API 키 준비

게임 마스터로 사용할 AI의 API 키가 필요합니다. (키는 브라우저 localStorage에만 저장되며, 해당 AI 서버 외에는 어디에도 전송되지 않습니다.)

| AI | 발급처 |
|---|---|
| Claude (Anthropic) | https://platform.claude.com |
| ChatGPT (OpenAI) | https://platform.openai.com |
| Gemini (Google) | https://aistudio.google.com |

> 💡 API 키 없이 게임 방식을 체험하고 싶다면 **데모 모드**를 선택하세요. 미리 짜여진 짧은 시나리오로 전체 흐름을 확인할 수 있습니다.

## 게임 방법

1. **새로운 모험** → GM으로 쓸 AI와 모델 선택, API 키 입력
2. **플레이어 수** 선택 (1인 또는 2인 — 한 PC에서 번갈아 플레이)
3. **세계관** 선택 (판타지 / 사이버펑크 / 코즈믹 호러 / 무협 / 직접 만들기)
4. **캐릭터 생성**: 이름, 클래스 선택 후 3d6 주사위로 능력치(힘/민첩/지혜/매력) 결정
5. **모험 시작!** 매 상황마다 세 가지 방식으로 행동할 수 있습니다:
   - ▸ **선택지 클릭** — GM이 제시한 행동 중 선택
   - 🎲 **주사위 판정** — GM이 판정을 요구하면 d20을 굴려 성공/실패 결정 (d20 + 능력치 보정 ≥ 난이도)
   - `>` **자유 입력** — 원하는 행동을 직접 문장으로 입력

- HP가 0이 되면 캐릭터는 쓰러지고, 전원이 쓰러지면 게임 오버입니다.
- 진행 상황은 자동 저장되며, 타이틀의 **이어서 모험하기**로 재개할 수 있습니다.
- 우측 사이드바의 자유 주사위(d4~d20)는 하우스룰용으로 자유롭게 굴릴 수 있습니다.

## 파일 구성

```
index.html      화면 구조
css/style.css   레트로 CRT 테마
js/audio.js     8비트 사운드 (Web Audio)
js/api.js       AI 제공자별 API 어댑터 + 데모 모드
js/game.js      게임 상태 · GM 프로토콜(JSON) · 판정/저장 로직
js/ui.js        로그 · 타자기 효과 · 주사위 연출
js/main.js      화면 전환과 이벤트 배선
```

## GM 프로토콜

AI는 매 턴 아래 JSON 스키마로만 응답하도록 지시받으며, 클라이언트는 이를 파싱해 내레이션·선택지·주사위 판정·HP/아이템 변화·게임 종료를 처리합니다.

```json
{
  "narration": "상황 묘사",
  "choices": ["선택지1", "선택지2"],
  "dice_check": { "stat": "DEX", "difficulty": 12, "reason": "함정 회피" },
  "updates": [{ "player": 1, "hp_change": -3, "add_items": [], "remove_items": [] }],
  "location": "현재 위치",
  "game_over": null
}
```
