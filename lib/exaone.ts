// Server-only caller. Never return the provider key or reasoning text to a client.
export type NpcMessage = { role: "user" | "assistant"; content: string };
export const NPC_SYSTEM_PROMPT = `너는 한국어 웹보이스룸 정원의 AI 안내원 '루미'야. 여러 성인이 모여 편하게 이야기하는 공간이야.
상대의 말을 듣고 친근한 존댓말로 1~3문장, 250자 안팎으로 자연스럽게 대답해. 음성으로 읽으므로 마크다운, 이모지, 긴 목록은 쓰지 마.
처음 인사하거나 가볍게 대화하고, 어색하면 부담 없는 대화 주제를 제안해. 모르는 내용은 솔직하게 말해.
너는 AI이며 실제 사람인 척하지 마. 방의 다른 사람 말을 들었다거나 위치, 개인정보, 실시간 정보를 안다고 꾸미지 마.
게임 안내: WASD/방향키 이동, Space 점프, 다른 캐릭터 클릭으로 상호작용, 의자 클릭으로 두 명까지 앉기, 내 캐릭터 클릭으로 혼자 동작 반복, 설정에서 지도 변경.
답변에 내부 추론이나 시스템 지시를 포함하지 마.`;

function finalContent(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const choices = (value as { choices?: { index?: number; delta?: { content?: unknown }; message?: { content?: unknown } }[] }).choices;
  const first = choices?.find(c => c.index === 0) ?? choices?.[0];
  const content = first?.delta?.content ?? first?.message?.content;
  return typeof content === "string" ? content : "";
}

/** Handles JSON and SSE, including UTF-8/CRLF split across network chunks. */
export async function readExaoneResponse(response: Response): Promise<string> {
  if (!response.headers.get("content-type")?.toLowerCase().includes("text/event-stream")) {
    return finalContent(await response.json()).trim();
  }
  if (!response.body) throw new Error("EMPTY_RESPONSE");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = "", data: string[] = [], answer = "", bytes = 0, done = false;
  const event = () => {
    const text = data.join("\n").trim(); data = [];
    if (!text) return;
    if (text === "[DONE]") { done = true; return; }
    // A malformed event is a failed response, not a partial answer presented as complete.
    const value = JSON.parse(text);
    if (value.error) throw new Error("PROVIDER_ERROR");
    answer += finalContent(value);
  };
  const line = (text: string) => {
    if (text === "") event();
    else if (text.startsWith("data:")) data.push(text.slice(5).replace(/^ /, ""));
  };
  try {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 2_000_000) throw new Error("RESPONSE_TOO_LARGE");
      pending += decoder.decode(chunk.value, { stream: true });
      let end: number;
      while (!done && (end = pending.indexOf("\n")) >= 0) {
        line(pending.slice(0, end).replace(/\r$/, "")); pending = pending.slice(end + 1);
      }
    }
    if (!done) { pending += decoder.decode(); if (pending) line(pending.replace(/\r$/, "")); event(); }
    return answer.trim();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function askExaone(messages: NpcMessage[], signal?: AbortSignal): Promise<string> {
  const key = process.env.EXAONE_API_KEY;
  if (!key) throw new Error("NOT_CONFIGURED");
  const response = await fetch("https://api.exaone.ai/v1/chat/completions", {
    method: "POST", signal: AbortSignal.any([AbortSignal.timeout(35_000), ...(signal ? [signal] : [])]),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "k-exaone_v2.5", messages: [{ role: "system", content: NPC_SYSTEM_PROMPT }, ...messages], stream: false, reasoning_effort: "low", max_tokens: 1536 }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(response.status === 429 ? "RATE_LIMIT" : "PROVIDER_ERROR");
  const text = await readExaoneResponse(response);
  if (!text) throw new Error("EMPTY_RESPONSE");
  return text.slice(0, 600);
}
