import type { NpcQuestion, NpcReply } from "./npc-packets";
import type { NpcMessage } from "./exaone";
/** Pair by question ID so different people's simultaneous questions cannot mix answers. */
export class NpcSharedHistory {
  private questions = new Map<string, NpcQuestion>();
  private replies = new Map<string, NpcReply>();
  question(value: NpcQuestion) { this.questions.set(value.id,value);this.trim(); }
  reply(value: NpcReply) { if(value.questionId)this.replies.set(value.questionId,value);this.trim(); }
  private trim() { while(this.questions.size>12){const id=this.questions.keys().next().value!;this.questions.delete(id);this.replies.delete(id);}while(this.replies.size>16)this.replies.delete(this.replies.keys().next().value!); }
  messages(completeOnly=true): NpcMessage[] {
    return [...this.questions.values()].sort((a,b)=>a.sentAt-b.sentAt).filter(q=>!completeOnly||this.replies.has(q.id)).slice(-4).flatMap(q=>{
      const reply=this.replies.get(q.id),question:NpcMessage={role:"user",content:q.text};
      return reply?[question,{role:"assistant" as const,content:reply.text}]:[question];
    });
  }
  clear() { this.questions.clear();this.replies.clear(); }
}
