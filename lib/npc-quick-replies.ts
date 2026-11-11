/** Fixed NPC basics avoid a slow reasoning request for greetings and game help. */
export function quickNpcReply(prompt: string): string | null {
  const text = prompt.normalize("NFKC").toLowerCase().replace(/[\s,.!?~。！？，]/g, "");
  const withoutName = text.replace(/루미(?:야|씨|님)?/g, "");
  if (/^(안녕|안녕하세요|반가워|반가워요|하이|ㅎㅇ|hello|hi)$/.test(withoutName)) return "안녕하세요! 정원에서 같이 편하게 이야기해요.";
  if (/^(고마워|고마워요|감사|감사해요|감사합니다|땡큐|thanks)$/.test(withoutName)) return "별말씀을요. 함께 이야기할 수 있어서 좋아요.";
  if (!withoutName && /루미/.test(text)) return "네, 듣고 있어요. 편하게 이야기해 주세요.";
  if (/^(너누구야|넌누구야|누구세요|자기소개해줘|너는누구야)$/.test(withoutName)) return "저는 이 정원에서 함께 이야기하는 AI 친구 루미예요.";
  if (/^(어떻게이동해|이동어떻게해|이동방법|이동방법알려줘)$/.test(withoutName)) return "WASD나 방향키로 움직일 수 있어요. Space를 누르면 제자리에서 점프해요.";
  if (/^(어떻게앉아|앉는방법|앉는방법알려줘)$/.test(withoutName)) return "의자를 클릭하고 앉기를 눌러 보세요. 의자마다 두 명까지 앉을 수 있어요.";
  return null;
}
