# 정원 라운지 · 도착 후 상호작용 · 움직이는 수면

## 구현

- 기존 픽셀 배경 대신 새 석재 광장·목재 데크 바닥, 벚나무 4개, 벤치 4개, 수경 연못 1개를 사용한다.
- 바닥과 소품은 별도 PNG. 소품은 접지점 `anchorY`로 캐릭터와 함께 정렬하며, 발이 뒤쪽이면 소품이 앞을 가린다.
- 나무는 수관 전체가 아닌 줄기·뿌리, 벤치는 받침/좌석의 지면 투영, 연못은 원형 바닥 면적을 근사한 세 개 사각형을 이동 불가 영역으로 사용한다.
- 수면은 원본 PNG의 청록색 물 픽셀에서 마스크를 만들어 잔물결·빛 반사만 20Hz로 갱신한다. 돌 테두리와 식물은 고정된다. 모션 감소 설정에서는 정지 프레임을 사용한다.
- `lib/plaza-navigation.ts`가 발 충돌 영역으로 A* 경로를 만들고, 선분 전체가 통과 가능한 구간만 합친다.
- 상호작용 버튼은 접근 요청만 만든다. 장면의 실제 위치에서 출발해 상대 옆의 유효한 접촉점까지 걸어가고, 도착 보고를 받은 뒤에만 보내기/받기 모션을 시작한다.
- 렌더러에서 캐릭터를 상대 옆으로 재배치하던 보정은 제거했다. 이동 중 상대가 움직이면 경로를 갱신하며, 수동 이동·점프·목표 이탈·막힌 경로에서는 접근을 취소한다.
- 다음 경유지와 현재 위치를 기존 이동 패킷으로 공유한다. 도착 후 짧은 보간 대기 시간을 두고 공통 시작 시각으로 상호작용을 재생한다.

## 산출물

- `public/plaza/garden-v3/garden-floor.png`: 새 바닥 배경.
- `public/plaza/garden-v3/cherry-tree.png`: 투명 벚나무.
- `public/plaza/garden-v3/teak-bench.png`: 투명 벤치.
- `public/plaza/garden-v3/reflecting-fountain.png`: 투명 연못.
- `lib/garden-lounge.ts`: 배치·접지점·충돌 영역의 기준 데이터.
- `lib/garden-water.tsx`: 물 픽셀에만 적용하는 수면 레이어.

## 제작 방식과 최종 프롬프트

내장 이미지 생성 도구로 바닥과 나무를 생성했다. 벤치·연못의 최종 시트도 같은 도구로 생성하고, sprite-gen 4.3.0 `slice-sheet`로 마젠타 제거·분리·투명 PNG 패키징을 수행했다. 자체 이미지 편집 스크립트로 엔진 단계를 대체하지 않았다.

바닥 프롬프트: “Final ground-only background for a 2D multiplayer voice-room garden lounge, wide landscape aspect 8:5. Polished hand-painted 2D game illustration, fixed orthographic elevated top-down RPG camera, no horizon. Broad ivory limestone paved social plaza, subtle radial paving motif, curved terracotta paths, sage lawn perimeter and flat honey timber deck in the top-left quadrant. All floor is walkable. No trees, furniture, fountain, water, buildings, characters, text or UI.”

나무 프롬프트: “One standalone cherry blossom tree PNG cutout for elevated top-down orthographic 2D RPG. True transparent alpha. Broad dusty-pink and peach canopy, visible sturdy warm brown trunk and roots at a flat baseline. Crisp warm outlines and soft cel shading, matching cute adult cartoon avatars. Full tree uncropped; no ground, grass, cast shadow, people, labels or scenery.”

최종 소품 시트 프롬프트: “Create one clean professional 2D game prop sheet on a perfectly flat pure MAGENTA #FF00FF background. Two separate objects in one horizontal row, wide landscape. LEFT: a simple beautiful honey-teak garden bench with cream curved armrests and sage metal legs, full seat top and back and legs visible. RIGHT: one low circular warm limestone reflecting pool with turquoise water and a tiny integrated center water spout surrounded by leaves. Both at the SAME elevated orthographic RPG camera angle, warm outlined 2D cel shaded illustration, not pixel art, not 3D, no realistic photographic textures. The two objects do not touch each other, huge pure magenta gap between them. Very important: flat clean graphic sprite cutouts, NO glow, NO halo, NO drop shadow, NO ground, NO background gradient, NO semi-transparent illumination, NO contact shadow, no translucent pixels outside objects. Completely opaque colors and crisp warm dark outlines. Maintain generous margin around the entire objects and between them. No text, no checkerboard, no people. Only the solid bench and pool silhouettes on perfectly uniform pure magenta.”

## 검증

- `node scripts/check-garden-navigation.mjs`: 열린 광장, 연못·벤치 우회, 막힌 벽, 연못 내부 차단, 수관/줄기 분리, 안전 스폰 10곳, 소품 접지점 9개 검증.
- 브라우저의 실제 이동 좌표 21개 모두 충돌 영역 밖이며, 연못을 우회해 목적지에 도착했다. 물을 클릭하면 진입하지 않고 안내한다.
- 브라우저에서 걷기→도착→포옹 순서 확인. 첫 포옹 프레임은 약 820ms 뒤였고, 시작 직후에는 보행만 재생됐다. 수동 이동으로 접근을 취소하면 포옹하지 않는다.
- 연못 캔버스의 픽셀 해시가 시간에 따라 바뀌는 것을 확인했고, 오브젝트 9개와 물 레이어가 로딩됐다.
- `sprites_run/garden-v3/scene-layer-preview.png`는 실제 DOM의 이미지 경계·깊이·캐릭터 프레임을 합성한 시각 검수용 렌더다. 브라우저 스크린샷은 아니다.
- 서로 다른 실제 계정/기기 간 온라인 지연 조건의 검증은 별도다.
