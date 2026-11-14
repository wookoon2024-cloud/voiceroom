# 캠핑 지도: 바닥과 실제 투명 에셋

`public/plaza/moonlit-camp-v2/ground.png`는 물체가 제거된 바닥이다. `assets.json`은 독립 PNG 17개의 위치와 크기를 기록한다. 텐트 2개, 나무 2개, 해먹, 스크린, 피크닉 2개, 데크 벤치 2개, 모닥불, 불가 의자 6개를 분리했다. 기존 v1 그림은 보존했다. 새 바닥과 일부 물체는 원본을 참조한 AI 편집이므로 원본과 픽셀 단위로 동일하다고 주장하지 않는다.

런타임은 더 이상 통이미지를 다각형으로 다시 그리지 않는다. 각 PNG의 실제 알파를 사용하고, 앞뒤 순서는 접지 높이로 정한다. 충돌은 별도 다각형이다. 텐트 앞쪽 접지 높이를 보정하고 나무 두 번째 줄기에도 충돌을 추가했다. 의자 6개는 그대로 한 명씩 예약하며, 기존 방향 공유와 물/불 애니메이션을 유지한다.

앉은 본인 캐릭터를 가리키면 머리 위 앞보기/뒤보기 버튼이 나타난다. 포인터가 컨트롤로 이동할 수 있도록 연결 영역을 두었고, 클릭은 바닥 이동이나 캐릭터 메뉴로 전달되지 않는다. 마우스 클릭 후 초점을 해제해 떠나면 숨겨지고, 키보드 조작 시에는 초점으로 유지한다. 모바일 터치는 앉은 캐릭터를 누르면 표시하고 바닥을 누르면 닫는다. 클릭 팝업의 방향 버튼은 제거했다.

## 생성 및 내보내기

**도구: 내장 `image_gen`**, API/CLI 대체 생성은 사용하지 않았다. 입력은 승인된 v1 지도다. 바닥과 전체 투명 레이어를 각각 생성한 뒤, 텐트·나무·피크닉에 섞인 다른 물체 조각은 별도 AI 편집으로 제거했다. 선택된 4개 정리 원본도 `sources/`에 보관했다. `foreground-source.png`는 전체 투명 레이어 원본이다.

`node scripts/split-camp-layers.mjs`는 AI가 만든 알파를 유지하며 물체별 소유 영역을 나누고, 투명 여백 정리·크기 맞추기·PNG/위치 내보내기만 수행한다. 폴리곤으로 바닥을 불투명하게 오려 붙이거나 물체를 코드로 다시 그리지 않는다. 전체 소스의 미배정 유효 픽셀은 0이다. 분리 중 드러난 잘린 지붕과 다른 물체 조각은 기계적 보간 대신 AI 편집으로 정리했다.

최종 프롬프트 세트(각 항목은 동일한 원본의 색·카메라·배치·따뜻한 일러스트 스타일 유지, 사람·글씨·UI 금지를 포함):

1. **바닥 / precise-object-edit:** “Produce the CLEAN BACKGROUND PLATE for a layered game, same full canvas, same camera/perspective, same exact composition and object positions. Remove ONLY these movable foreground objects and naturally reconstruct the surface behind them: both canvas tents on the left (including their interiors, nearby small individual crates and entrance rugs); all SIX small stools around the central fire; the central stone firepit/fire/logs; the TWO wooden bench seats on the upper sea-view deck; the two low picnic tables and their loose cushions/blankets; the large trees/canopies at left edge and upper right supporting the hammock; the hammock; the right projection screen including its poles and nearby crates. Keep the sea, shoreline, rocks, low coastal flowers/grasses, wooden boardwalk loop, sea-view DECK PLATFORM with stairs/railings, all fixed pathway lanterns and all sand exactly where they are.”
2. **전체 물체 / background-extraction, transparent:** “Create ONE full-canvas TRANSPARENT FOREGROUND LAYER for this exact map, 1672x941, preserving the exact camera, original object locations, scales, colors and hand-painted details. Isolate the existing objects IN PLACE (not a rearranged atlas or grid). ERASE ALL background sand, sea, shoreline, sky, paths, deck platform/railings, distant rocks, flower beds, grasses and freestanding pathway lanterns to real transparent alpha. Keep fine tree foliage, all tent ropes/poles/fabric edges, stool legs, hammock net gaps and screen supports as carefully cut transparent silhouettes; holes through objects remain transparent. No ground patches, no rectangular image crops, no new ground shadows.”
3. **북서 텐트 / transparent:** “Isolate ONLY the complete cream canvas tent with its bedding, door crate, flower pot, entrance rug and guy ropes. Remove every tree leaf, branch and string light (including the stray light above its roof). Reconstruct the tiny missing tent fabric along the edges so the complete roof is intact. Match the approved original tent design exactly; no extra props.”
4. **남서 텐트 / transparent:** “Isolate ONLY this complete cream canvas tent, its bedding, two small wooden crates, entrance rug and its lantern. Restore the missing clipped apex at the top of the canvas roof, including the little pole tip. No cut-off top, no picnic table or cushions outside this tent. Preserve the design and perspective exactly.”
5. **왼쪽 나무 / transparent:** “Keep ONLY this left coastal tree group, trunks, foliage and warm string lights. Remove ALL white/beige tent fabric fragments, tent ropes and any other camping objects from underneath. Fill the few hidden tree branches naturally. Keep the tree silhouette and original lighting/perspective. No tents, sand, picnic objects or scenery.”
6. **왼쪽 피크닉 / transparent:** “Keep ONLY this complete picnic ensemble: low wooden table with lantern/vase, its picnic blanket and the surrounding cushions/ottomans. Remove the detached little cream triangular TENT ROOF fragment underneath at the bottom left, its pole and ropes. Do not add anything. Keep the current picnic table design and perspective exactly.”

정리 편집의 공통 지시: “Deliver a single clean, complete, carefully isolated game prop on genuine transparent alpha with a small transparent margin, matching the current elevated 2.5D game camera and hand-painted warm cel-shaded style. No background pixels, rectangle of sand, cast ground shadow, text, UI, labels or borders. Preserve shape, colors, proportions and detail. This is asset cleanup, not a new design.”

## 검증

`check-room-seating.mjs`는 실제 알파/비어 있지 않은 PNG 17개, 통이미지 mapClip 없음, 텐트 전후 접지 순서, 모든 스폰·의자 접근과 퇴장, 한 명 예약 및 방향 공유를 확인한다. 휴식 그림 220프레임과 `check-sprite-paint.mjs`의 154개 렌더링 조합을 검사한다. 로컬 mock 브라우저에서 17개 개별 img와 이전 가림 레이어 0개, 머리 위 컨트롤 표시, 팝업 없이 뒤보기 전환 및 1/1 점유 유지, 텐트 앞 월드 좌표 (250,365)에 전신으로 서 있는 것을 확인했다. 실제 참가자의 방에는 테스트 메시지나 강제 새로고침을 보내지 않았다.
