# 회사 사무실 맵

설정 → 지도·배경 → **회사 사무실**을 선택한다. 기존 밤바다·정원 배경은 그대로 선택할 수 있다. 선택은 기존 방 배경 공유 방식으로 동기화된다.

사무실 의자를 클릭해 **앉기**를 누르면 걸어가서 앉는다. 업무석 13개와 회의석 4개이며 각각 한 명만 앉을 수 있다. 기존 앉기 방향 전환과 이동해서 일어나기를 사용한다. 이 변경은 앉기 동작을 연결하며 별도의 키보드 타이핑 동작은 생성하지 않는다.

## 파일과 배치

- `public/plaza/office-v1/ground-v2.png`: 가구와 테두리의 나뭇잎·덤불을 제거한 빈 바닥·건축 배경. 실내 화분은 독립 에셋으로 유지한다.
- 같은 디렉터리의 투명 PNG 38개: 가구 레이어 21개와 의자 17개. `assets.json`이 원래 캔버스에서의 위치와 크기를 보관한다.
- `lib/office-map.ts`: 깊이, 충돌 다각형, 자리 접근점, 좌판 접점, 앉는 방향을 정의한다.
- 해변과 같은 1672×941 월드 크기. 브라우저 크기가 변해도 맵과 가구의 실제 크기를 유지하고 카메라가 이동한다.
- 책상·의자·회의실 프레임을 각각 정렬한다. 회의실 탁자와 앞 프레임도 별도 레이어다. 이미지를 다각형으로 잘라 바닥까지 덮어씌우는 방식이 아니다.
- 의자의 발·바퀴 쪽에 충돌 영역을 두고, 앉기 접근점은 그 밖에 둔다. 다른 의자로 바로 이동할 때 시작점이 기존 의자 안에 갇히지 않는다.
- `scripts/split-office-assets.mjs`는 AI가 만든 알파 원본에서 소유 영역/연결 성분으로 에셋을 추출한다. 회의실 의자는 가려진 부분을 새로 그린 네 개의 독립된 그림을 사용한다.

원본: `approved-preview.png`, `furniture-source.png`, `chairs-source.png`, `meeting-chairs-source.png`. 생성 도구는 내장 **image_gen**이다. PNG 해시는 `artwork.json`에 저장한다. `layer-preview.png`는 실제 깊이 순서로 다시 합성한 미리보기다.

## 검증

`node scripts/check-room-seating.mjs`: 여섯 배경, 휴식 동작 308프레임, 사무실 의자 17개 전부의 접근·이탈 경로, 안전한 등장 위치, 자리의 발 위치가 장애물 밖에 있는지, 동시 예약 한 명 제한, 방향 및 자리 해제 동기화. TypeScript와 프로덕션 빌드도 확인한다.

로컬 브라우저에서는 배경 목록 선택, 컴퓨터 앞 착석, 기존 자리에서 반대편 자리로 걷기, 앞뒤 가림을 확인한다. 실제 방 사용자의 마이크나 강제 새로고침 기능은 시험에 사용하지 않는다.

## 생성 프롬프트

### 테두리 식물 제거 (현재 배경)

내장 image_gen으로 기존 `ground.png`만 수정했다. 원본은 보존하고 결과를 `ground-v2.png`에 저장했다. 아래쪽 덤불이 있던 모서리의 충돌 다각형도 제거해 새 바닥을 걸을 수 있다. 가구·좌석 정의는 동일하다.

Edit this exact game background plate. Remove ALL decorative tree foliage, hanging leaves, flower bushes and shrubbery framing the OUTER EDGES of the image: the upper-left treetops, upper-right treetops, every leaf hanging over either upper wall corner, the entire lower-left and lower-right leaf/flower borders. Remove their cast shadows on the floor too. This is an indoor office, so no woodland or garden edging should surround the room. Replace the removed bottom foreground bushes with a seamless continuation of the existing taupe patterned carpet, all the way to both lower corners. Replace removed upper outer trees above the walls with a plain unobtrusive warm light-gray exterior background matching the gray strip behind the upper wall, with no new decorative objects. Preserve EXACTLY the existing office walls, wall trim, windows, city view and distant trees seen THROUGH the windows, wall paintings, wall lights, daylight floor patches, carpet texture, straight wooden bottom-center entrance/threshold, elevated oblique camera and the exact 1672x941 canvas. Do not move or resize anything, no new walls across the bottom, no new furniture, no plants, no text, no UI. This remains an EMPTY FLOOR PLATE; furniture will be separate layers added by the game. Only erase the outside framing leaves/bushes and naturally repair those local regions.

공통 참조: 사용자가 승인한 원본 사무실 이미지(둥근 길과 길 조명이 제거된 버전). 카메라·1672×941 캔버스·가구 배치를 유지하도록 지정했다.

### 빈 배경

Create the CLEAN EMPTY BACKGROUND PLATE of this exact approved office map. Preserve the exact 1672x941 canvas, camera, framing, walls, rear windows and outdoor view, wall art, wall lights, bottom wooden entrance and all outer perimeter foliage. Preserve the carpet floor and its daylight patches. REMOVE every movable furniture object completely: all desks/computers/keyboards, all 17 office/meeting chairs, central desk islands, printer and storage units, rear and side shelves/cabinets, manager desk and rug, coffee counter and water cooler, coat rack, ALL freestanding indoor plants including bottom two entrance plant boxes. REMOVE the glass meeting room enclosure and its table/chairs; fill behind it as empty room floor/wall, preserving matching perspective. Cleanly inpaint the removed furniture and its contact shadows with continuous existing carpet and matching architectural wall. This plate is truly empty walkable floor plus architectural walls/windows and outer vegetation only, not a map with furniture still painted on. No new objects, do not redesign or shift camera. Keep original carpet texture uniform. Preserve NO oval wooden path or floor lanterns: the approved image already removed them. No text or UI.

### 가구 알파

Extract a TRANSPARENT RGBA FOREGROUND FURNITURE PLATE from this exact office map, same 1672x941 full-canvas coordinates and scale, preserving exact original positions and appearances. Keep every desk, computer/monitor, keyboard, mouse, desk partition and stationery, storage cabinets and bookcases, printer and cubbies, coffee counter and water cooler, coat rack, freestanding indoor potted plants and the two bottom entrance planter boxes. Keep the glass meeting room enclosure and its meeting table together, with glass genuinely semi-transparent. Keep manager desk and its rectangular rug. CRITICAL: REMOVE ALL OFFICE CHAIRS AND MEETING CHAIRS, including partially hidden chair backs behind the two center desk islands, rear window desks, manager desk, two lower corner desks and glass meeting table. Reconstruct the desk surfaces/legs previously hidden behind the removed chairs. NO CHAIRS anywhere in this plate. Remove floor, walls, windows/city view, background foliage, carpet and general ambient light glow; all empty space between furniture must be genuinely transparent alpha, no checkerboard, solid color, backdrop, shadows cut into big rectangles or residual floor patches. Small subtle object contact shadows may remain, but no broad carpet. Keep object lighting/style, do not arrange into a contact sheet or rescale. Positions MUST match reference. This plate will be cut into independently depth-sorted game furniture assets.

### 의자 알파

Create a TRANSPARENT RGBA CHAIRS-ONLY PLATE for this approved office map, same full canvas 1672x941, exact chair positions, camera and scale. Keep ONLY its 17 empty seats/chairs, remove EVERYTHING ELSE to genuine transparent alpha. Count: 2 rear-window desk chairs centered (718,217),(992,217); 8 chairs for the two center desk islands: left bank back row centered (556,398),(708,398), front row (544,555),(705,555); right bank back row (985,398),(1130,398), front row (982,555),(1148,555). The 4 back-row central chairs face down toward their monitors in the original; the 4 front-row central chairs and 2 window chairs face up, showing rear backrests. Keep 1 manager executive chair around (195,225), 2 diagonal lower-corner chairs around (196,681),(1445,688), and 4 meeting room chairs at their exact reference positions near (1387,196),(1515,208),(1380,259),(1509,265). Reconstruct FULL chairs even where the desks previously hid their seats, lower legs or casters; natural consistent ergonomic blue/dark office rolling chairs for desks and matching meeting chairs in glass room. No desks, tabletop, computers, plants, shelving, glass, walls, floor, broad ground shadows or text. No occupied chairs, no people or body parts. Every chair must be a complete individually separable object with transparent air between, precisely aligned to the reference perspective. Do not add more than 17, no new arrangement, no shared atlas grid, no cropping to smaller canvas. Preserve all chair locations from the reference; centers above are approximate guides. Clean alpha cutouts without a checkerboard painted in.

### 회의실 의자 복원

Extract/redraw ONLY the FOUR blue meeting-room visitor chairs from the upper-right glass meeting room of this office, as four COMPLETE SEPARATED transparent game props. A 2x2 loose layout with huge transparent gutters, one chair per quadrant, full legs and backrest clearly complete, no objects touching. Top-left quadrant: the far-left meeting chair, viewed from its front/side, facing diagonally DOWN RIGHT. Top-right quadrant: far-right meeting chair, front/side facing diagonally DOWN LEFT. Bottom-left quadrant: near-left meeting chair viewed from back/side, facing diagonally UP RIGHT. Bottom-right quadrant: near-right meeting chair viewed from back/side facing diagonally UP LEFT. Keep the approved warm clean illustrated 2.5D office camera, fabric muted navy/blue upholstery and simple four slender black metal legs (not rolling swivel chairs). All four consistent in design, scale and elevated view. Reconstruct all parts that the meeting table or glass hid. No people, no table, no floor, no glass room, no background, no text, no labels, no shadows or detached artifacts. Genuine transparent alpha around and within chair legs. Four isolated full chairs, not one assembled scene. The quadrants and transparent gaps are mandatory for independent asset extraction.
