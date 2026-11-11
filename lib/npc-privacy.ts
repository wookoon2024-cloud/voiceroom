/** Local, deterministic redaction. Raw identifiers must never go to the language model. */
const PRIVATE_SENTENCE = /(?:실명|성함|제?\s*이름(?:은|이|:|：)|본명|집\s*주소|우리\s*집|제\s*주소|내\s*주소|주소(?:는|가|:|：)|전화\s*번호|휴대폰\s*번호|핸드폰\s*번호|연락처|주민\s*등록|여권\s*번호|계좌\s*번호|카드\s*번호|생년월일|비밀\s*번호|인증\s*번호|사는\s*(?:곳|동네)|살고\s*있는\s*곳|my\s+(?:name|address|phone|email)|call\s+me\s+at|[가-힣]{2,12}(?:구|군|시)\s+[가-힣0-9]{2,20}(?:로|길))/i;
const CITY = "(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)(?:특별자치시|특별자치도|특별시|광역시|도|시)?";
const ADDRESS = new RegExp(`(?:${CITY}\\s*)?(?:[가-힣]{1,12}(?:시|군)\\s*)?(?:[가-힣]{1,12}(?:구|읍|면|동|리)\\s+)?[가-힣A-Za-z0-9·]{1,24}(?:대로|번길|길|로|동|리)\\s*\\d{1,5}(?:[-–]\\d{1,5})?(?:\\s*(?:\\d{1,5}(?:동|호|층)|[가-힣A-Za-z0-9]{1,15}(?:아파트|빌라|오피스텔))) *`, "g");
const DISTRICT = new RegExp(`${CITY}\\s*(?:[가-힣]{1,12}(?:시|군|구)\\s*){0,2}(?:[가-힣]{1,12}(?:동|읍|면|리))?`, "g");
const COMMON = new Set(["이렇게", "이런", "이거", "이것", "이건", "이제", "이따", "이유", "이야기", "이번", "이어서", "이용", "이상해", "이상한", "이상은", "정말", "정말로", "정원", "정도", "정리", "정확히", "정신", "강아지", "강하게", "강해서", "최고", "최고의", "조금", "조금만", "조용히", "조용한", "차라리", "차이가", "차분히", "신나게", "신나는", "신기한", "신기해", "신기하다", "임시로", "장난", "장난감", "장소", "박수", "김치", "고양이", "고마워", "고마워요", "고맙다", "고맙네요", "남자", "남자들", "배경", "배고파", "배고프다", "하이", "하이파이브", "한번", "한번더", "한가해", "한국어", "한국인", "노래", "노래가", "안녕", "안녕하세요", "안되면", "안돼요", "안되는", "좋아요"]);
for (const word of ["오늘", "내일", "어제", "오래", "우리", "여기", "저기", "어디", "어느쪽", "어떻게", "서로", "지금", "우선", "주말", "여행", "고민", "고마운", "엄청", "일단", "일부", "이틀", "이곳", "이쪽", "이후", "이전", "인사", "인준", "인식", "음성", "한글", "한참", "주변", "정상", "중간", "좋겠네요", "좋겠어요", "보고", "보니까", "보통", "여유", "시간", "조용해"]) COMMON.add(word);
const commonWord = (word: string) => COMMON.has(word) || COMMON.has(word.replace(/(?:에게|한테|에서|으로|에는|에도|부터|까지|처럼|보다|은|는|이|가|을|를|와|과|도|만|의|랑|로|에|야|서)$/, ""));
COMMON.add("소리"); COMMON.add("편하게"); COMMON.add("하나"); COMMON.delete("인준");
const FAMILY = "(?:남궁|황보|제갈|선우|사공|서문|독고|동방|[김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부복태목형피두감음빈온])";
const NAME = new RegExp(`(?<![가-힣])(${FAMILY}(?:[민서지현준도유하수예채윤시은연재정진영성철길승태동건상종소나다희보규창광경미][수진영호희우연아은빈현준민윤경원석식규림나주라찬혁동훈성재율솔인리아연]|[민준수진현철윤솔린준율혁빈호영우결]))(?=(?:씨|님|군|양|은|는|이|가|을|를|의|랑|하고|와|과|에게|한테)?(?:\\s|[,.!?~:;"'()\\[\\]]|$))`, "g");

export function maskPersonalInfo(input: string, knownNames: string[] = []): string {
  let text = input.normalize("NFKC").replace(/[\u200b-\u200f\ufeff]/g, "").replace(/\[[^\]\n]*삭제\]|\[개인정보 발언 제외\]/g, "[가림]");
  // Remove dotted identifiers before sentence omission, so their suffix cannot be cut off first.
  text = text.replace(/(?:https?:\/\/|www\.)[^\s<>]+/gi, "[링크 삭제]")
    .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, "[이메일 삭제]");
  // Omit whole statements declaring personal details, including spoken Korean phone numbers.
  text = text.split(/(?<=[.!?。\n])/).map(sentence => PRIVATE_SENTENCE.test(sentence) || /(?:도|시|군|구)\s+[가-힣]{1,12}(?:동|리|면)\s*\d/.test(sentence) ? "[개인정보 발언 제외] " : sentence).join("");
  text = text.replace(/(?:https?:\/\/|www\.)[^\s<>]+/gi, "[링크 삭제]")
    .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, "[이메일 삭제]")
    .replace(/\bsk-[A-Za-z0-9_-]{10,}\b|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[인증정보 삭제]")
    .replace(/(?:\+?82[\s().-]?)?0?(?:1[016789]|2|[3-6][1-5]|70)[\s().-]*\d{3,4}[\s().-]*\d{4}/g, "[전화번호 삭제]")
    .replace(/\b\d{6}[\s-]*[1-8]\d{6}\b/g, "[주민번호 삭제]")
    .replace(/\b(?:\d[ -]?){10,19}\b/g, "[개인번호 삭제]")
    .replace(/\+?\d(?:[\s().-]*\d){8,18}/g, "[개인번호 삭제]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP 삭제]")
    .replace(/\b\d{2,3}\.\d{4,}\s*[,/]\s*\d{2,3}\.\d{4,}\b/g, "[위치 삭제]")
    .replace(/(?:공|영|일|이|삼|사|오|육|칠|팔|구)[\s-]*(?:(?:공|영|일|이|삼|사|오|육|칠|팔|구)[\s-]*){8,}/g, "[개인번호 삭제]")
    .replace(ADDRESS, "[주소 삭제]").replace(DISTRICT, "[지역 삭제]")
    .replace(/(?:[가-힣]{2,12}(?:시|군|구)\s*)+[가-힣]{1,12}(?:동|읍|면|리)|[가-힣]{2,12}동(?=[\s,.\d-]|$)/g, "[지역 삭제]")
    .replace(/\b(?:\d{4}[./-]\d{1,2}[./-]\d{1,2})\b|(?:19|20)\d{2}년\s*\d{1,2}월\s*\d{1,2}일/g, "[날짜 삭제]")
    .replace(/\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,4}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr)\b[^\n.!?]*/gi, "[주소 삭제]")
    .replace(/\b[A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20}\b/g, "[이름 삭제]")
    .replace(/\b[A-Z][a-z]{2,24}\b/g, word => ["Hello","Thanks","Thank","Today","Tomorrow","Please","Maybe","Yes","Good","Nice","Sorry","How","What","When","Where","Why","Can","Could","Would","Should","The","This","That","There"].includes(word) ? word : "[이름 삭제]");
  for (const raw of knownNames) {
    const name = raw.split(/[\/|]/)[0].trim();
    if (name.length < 2 || name.length > 30) continue;
    const escaped = /^[가-힣]{2,4}$/.test(name) ? name.split("").join("\\s*") : name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(escaped, "gi"), "[이름 삭제]");
  }
  text = text.replace(NAME, name => commonWord(name) ? name : "[이름 삭제]")
    .replace(/([가-힣]{2,4})(?:님|씨)(?=[\s,.!?~]|$)/g, (_, name: string) => commonWord(name) ? `${name}님` : "[이름 삭제]");
  return text.trim();
}
export const hasPublicContent = (text: string) => text.replace(/\[[^\]]*삭제\]|\[개인정보 발언 제외\]|\[가림\]/g, "").replace(/[\s\p{P}\p{S}]/gu, "").length >= 2;
