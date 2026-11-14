# 텐트 내부와 휴식 자리

두 바깥 텐트를 누르면 입구까지 걸어간 뒤 각 내부로 이동한다. 안에서는 침구 2개와 방석 4개를 누르고 눕기/앉기를 선택한다. 각 가구는 한 명만 예약한다. 일어나거나 이동하면 자리를 비운다. 아래 출입구 또는 왼쪽 위 캠핑장 버튼을 누르면 출구까지 걸어가서 해당 텐트 앞에 돌아온다.

안팎과 두 텐트는 각자의 캐릭터 공간이다. 텐트에 들어가도 다른 사람을 강제로 이동시키지 않는다. 같은 공간의 아바타만 표시하고 기존 대화방 음성·공개 채팅은 공유한다. `PLAZA_SPACE`로 본인 공간을 알리고 초기 동기화와 재접속 때 재전송한다. 두 텐트의 자리 예약도 theme별로 독립적이다. 내부는 공용 스킨 목록에 노출하지 않는다.

## 자산과 배치

승인된 시안을 `public/plaza/tent-interior-v1/approved-preview.png`에 보관한다. `ground.png`와 실제 알파 PNG 10개로 나누고 `assets.json`의 좌표로 배치한다. 생성된 알파가 실루엣을 정하며 `scripts/split-tent-furniture.mjs`는 소유 영역 분리·투명 여백 정리·크기 맞추기만 한다. 왼쪽 침구에 섞인 나무 조각은 AI로 정리한 `bed-left-clean-source.png`로 교체한다. SHA256은 `artwork.json`에 있다. 원본 시안의 분위기와 배치를 따랐으며 AI 편집본을 원본과 픽셀 단위로 같다고 주장하지 않는다.

좌판/방석에는 그림의 엉덩이 접점, 침구에는 몸 중심을 맞춘다. 침구는 32도 방향으로 눕힌다. 자세를 바꿔 몸 자체를 키우지 않는다. 실내 모든 아바타에는 가구에 맞는 공통 표시 배율을 적용한다. 이름표·방향 버튼·클릭 영역도 가구에 놓인 실제 그림을 따른다. 회전 프레임은 클릭 좌표를 역회전하고, 다른 가구의 투명 클릭 사각형이 보이는 캐릭터를 가로채지 않게 했다.

사선 앉기 자산은 `public/plaza/diagonal-seating-v1/<character>/`의 manifest/PNG다. 기존 sprite-gen의 GPT 행 경로 (`--provider codex --model gpt-5.6-sol`)로 11종 × 2행 × 4프레임을 만들었다. 왼쪽은 오른쪽 원본을 반전한다. `scripts/generate-back-seating.py --diagonal` 및 `scripts/finish-back-seating.py --diagonal`로 생성·추출·아틀라스·GIF·검사를 수행한다. 각 행의 4프레임에서 전신, 정체성, 방향, 미세한 호흡의 연결을 확인했다. 다람쥐 정면 사선 방향 오류는 해당 행 재생성으로 수정했다. 수동 등분 자르기나 속도 변경으로 실패한 동작을 숨기지 않는다.

## 게시물 공유 알림 보완

브라우저 저장본을 읽자마자 미연결 채널에 보내던 동작을 전달 큐로 바꿨다. 연결 준비 전에는 대기하고, 실패한 패킷은 유지한 채 1.5초부터 최대 30초까지 간격을 늘려 재시도한다. 같은 게시물의 대기 스냅샷/위치 변경은 최신값으로 합친다. online/화면 복귀/방 재접속 때도 재시도한다. 성공하면 대기 건수가 0으로 내려간다. 지도 위 빨간 오류 띠는 제거했고 게시물 목록 안에서만 연결되면 자동 공유한다는 상태를 보인다. 방 전환 전의 비동기 전송 완료가 새 방의 대기열을 지우지 않도록 세대 번호를 검사한다. 저장 실패 안내와 작성 내용 검증은 유지한다.

## 이미지 생성 프롬프트

도구는 **내장 image_gen**이며 별도 API/CLI 이미지 생성으로 전환하지 않았다. 원본 텐트 cutout은 스타일 참고, 승인된 내부 시안은 이후 편집의 대상이다.

시안 / stylized-concept:

```text
Asset type: INTERIOR ROOM MAP DESIGN PREVIEW for a cozy Korean web voice-room social game. The attached image is a STYLE AND MATERIAL REFERENCE of the existing exterior cream canvas bell tent. Create ONE polished wide 16:9 hand-painted illustrated GAME INTERIOR MAP showing what it feels like to enter this same tent, expanded into a comfortable social lounge. It must be an actual interior room layout seen with the same elevated steep top-down 2.5D orthographic RPG camera, roof removed and near wall cut away, not an exterior tent or a decorative framed poster. Refined warm cel-shaded storybook game illustration with clean fine outlines, rich but readable fabric and wood textures, matching the source's cozy cream-and-amber palette. The cream canvas walls and curved timber supports occupy only the upper/side perimeter. A small open rolled-canvas entrance at bottom center leads to outside moonlit camping, clearly readable as the exit; leave an unobstructed path from this exit into a GENEROUS EMPTY CENTRAL FLOOR where several full-body game avatars can walk, gather and talk. Spacious scale, furniture modest sized. Light wooden plank floor, a beautiful muted terracotta geometric woven rug in the middle, but KEEP the rug mostly empty. Around the perimeter: two comfortable low bedrolls with folded bedding and soft cream pillows on the back-left; a small low tea table and FOUR individual floor cushions on the back-right, leaving open access around them; a small crate/books/plant nook at one left edge. Cozy warm electric lanterns and a few gently draped string lights illuminate the fabric walls. A small rear triangular mesh window reveals a sliver of cool navy sea and moonlight. Flowers and one folded blanket echo the exterior. Charming sophisticated cozy glamping interior, not crowded, no enormous furniture. Room fills the full panoramic frame without UI margins. Keep all props fully visible and use coherent ground contact/perspective. This is only a design preview, so draw the complete cohesive scene. No people, no animals, no avatars, no interface, no text, no labels, no watermarks, no map legend, no grid, no panel collage.
```

바닥 / precise-object-edit:

```text
The attached APPROVED tent interior game map is the exact edit target. Produce its EMPTY GROUND/BACKGROUND PLATE for game layers, same 1672x941 canvas and EXACT same elevated camera, cream canvas walls, wooden poles, wall string lights, hanging lantern, triangular moonlit-sea window, wooden floor, large central terracotta rug and bottom entrance. Remove ONLY all loose floor furniture: the TWO bedrolls with their pillows/blankets on the back left; all FOUR square floor cushions on the right; the low round tea table and tea set; the back-right wooden crate/flower/lantern ensemble behind the tea table; the front-left book/crate/plant/lantern nook; the front-right flower crate. Reconstruct continuous matching wood floor or woven rugs behind them, no new objects. Keep room footprint, perspective, lighting and warm hand-painted game style unchanged. No people, animals, labels, text, interface or outlines. This is the same approved interior with furniture removed, not a redesign.
```

가구 / background-extraction, transparent:

```text
The attached APPROVED tent interior game map is the exact edit target. Produce ONE full-canvas TRANSPARENT furniture layer, preserving the exact original 1672x941 arrangement and elevated camera: isolate the TWO bedrolls including their pillows and folded blankets on the back left as complete beds; the FOUR individual square floor cushions on the right; the low round tea table with its cups/teapot; the back-right wooden crate with its vase of flowers and lantern; the front-left book/crate/plant/lantern nook including the folded blanket; and the front-right flower crate. Everything else must be genuine transparent alpha: remove all walls, poles, windows, string lights, ceiling/hanging lantern, central rug, woven floor mats, ALL wooden floor, entrance, outdoors and cast floor shadows. Keep the furniture at the SAME positions, scale and shape as in the reference, not a rearranged atlas. Preserve clean fine cutout edges and transparent gaps under furniture. No ground patches, text, new objects, UI, checkerboard, color background or shadows. Exactly the original loose furniture, isolated in place on real transparency.
```

침구 정리 / background-extraction, transparent:

```text
Clean this existing game prop cutout only. Keep the complete low cream floor bedroll, its pillow, terracotta patterned folded blanket and mattress exactly in the same elevated 2.5D perspective and warm painted style. REMOVE the detached thin brown wooden crate/bed fragment sticking out behind the pillow at the upper RIGHT edge; it belongs to another object. Restore a clean mattress/pillow silhouette at that edge if needed. No headboard, wood, floor, rug, shadow, text, new object or background. One complete soft floor bed on genuine transparent alpha, no clipped edges, same proportions and colors.
```

사선 프롬프트는 generate-back-seating.py의 DIAGONAL 분기에 있다. 동일한 기존 캐릭터 그림을 참조하고, 화면 아래 오른쪽/위 오른쪽을 향해 이미 앉은 상태, 고정 엉덩이·머리 크기, 전신, 미세한 호흡 4프레임, 가구/배경/파트너 없음이 핵심이다.

## 검증

`check-map-post-delivery.mjs`: 연결 준비, 실패 유지/백오프, 최신 스냅샷, 복구 후 대기 해제, 방 전환 격리. `check-plaza-spaces.mjs`: 개인 출입과 공유 위치, 늦은 입장 재전송, 두 텐트의 복귀점, 잘못된 공간 거절, 방 초기화. `check-room-seating.mjs`: 5개 테마, 308개 휴식 프레임, 침구 한 명 제한/눕기 복제, 모든 의자/침구/방석 경로 및 퇴장, 6방향 공유. `check-sprite-paint.mjs`: 209개 조합 및 눕기 배율 유지. `check-sprite-hit.mjs`: 투명 여백/미러/회전 좌표. 기존 게시물 병합/삭제/반응 검사도 통과했다.

로컬 mock 브라우저에서 걸어서 텐트 입장, 침구 두 자리 눕기와 해제, 네 방석 착석/해제, 출구로 걸어서 밖의 (250,365) 복귀, 내부 1명/외부 7명 표시, 의자 6 사선 착석과 방향 변경, 116px 3×2 화살표 및 390px 화면 가로 넘침 없음, 이전 빨간 경고 없음 등을 확인했다. 실제 iPhone 터치나 실제 참가자 음성 통화는 이 검수에 사용하지 않았다. 기존 참가자에게 메시지나 강제 새로고침을 보내지 않았다.
