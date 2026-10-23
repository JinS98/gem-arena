# 테마별 카드 이미지 배정

엔진의 카드 90장(1단계 40장, 2단계 30장, 3단계 20장)을 그대로 사용한다. 비용·승점·보너스 색상은 바꾸지 않는다. 각 행은 해당 카드 ID의 일러스트 소재와 이미지 경로를 나타낸다. 테마는 비공식 팬 비주얼이며 표시용 자원은 원작의 공식 게임 자원이 아니다. 귀멸의 칼날 카드에서 같은 인물은 최대 2장까지 배정하며, 인물이 없는 카드는 장소·도구·기술 효과로 구분한다. 인물별 카드 ID는 `docs/theme-character-map.json`에 기록한다. 안개와 바람 계열에는 해당 호흡 사용자 외에도 색감과 분위기가 어울리는 인물이 포함된다.

## 자원 표시 매핑

| 내부 색상 | 기본 테마 | 리그 오브 레전드 | 귀멸의 칼날 |
| --- | --- | --- | --- |
| white | 흰색 보석 | 천상의 파편 | 안개 |
| blue | 파란색 보석 | 마법 수정 | 물 |
| green | 초록색 보석 | 자연의 정수 | 바람 |
| red | 빨간색 보석 | 화염의 정수 | 불 |
| black | 검은색 보석 | 공허의 결정 | 혈귀 |
| gold | 황금 보석 | 초월의 정수 | 태양 |

두 추가 테마의 아이콘 경로는 `apps/web/src/assets/gems/themes/{theme}-{color}.png`이다. `gold`는 이름과 그림만 바뀌며 기존 조커 기능을 유지한다.

## 리그 오브 레전드

### 레벨 1

| 카드 ID | 승점 | 소재 | 이미지 |
| --- | ---: | --- | --- |
| L1-WHITE-01 | 0 | Demacian recruit with a practice sword | `apps/web/src/assets/cards/themes/lol/L1-WHITE-01.jpg` |
| L1-WHITE-02 | 0 | Demacian silver shield | `apps/web/src/assets/cards/themes/lol/L1-WHITE-02.jpg` |
| L1-WHITE-03 | 0 | petricite charm on a mason's bench | `apps/web/src/assets/cards/themes/lol/L1-WHITE-03.jpg` |
| L1-WHITE-04 | 0 | Demacian training courtyard | `apps/web/src/assets/cards/themes/lol/L1-WHITE-04.jpg` |
| L1-WHITE-05 | 1 | Lux with a small light spell | `apps/web/src/assets/cards/themes/lol/L1-WHITE-05.jpg` |
| L1-WHITE-06 | 1 | Poppy carrying her hammer | `apps/web/src/assets/cards/themes/lol/L1-WHITE-06.jpg` |
| L1-WHITE-07 | 1 | Quinn and her eagle Valor | `apps/web/src/assets/cards/themes/lol/L1-WHITE-07.jpg` |
| L1-WHITE-08 | 0 | Sona with a luminous ivory etwahl | `apps/web/src/assets/cards/themes/lol/L1-WHITE-08.jpg` |
| L1-BLUE-01 | 0 | mana crystal in a Piltover laboratory | `apps/web/src/assets/cards/themes/lol/L1-BLUE-01.jpg` |
| L1-BLUE-02 | 0 | Piltover inventor's brass toolkit | `apps/web/src/assets/cards/themes/lol/L1-BLUE-02.jpg` |
| L1-BLUE-03 | 0 | Piltover academy workshop | `apps/web/src/assets/cards/themes/lol/L1-BLUE-03.jpg` |
| L1-BLUE-04 | 0 | Zaun courier crossing a blue-lit canal bridge | `apps/web/src/assets/cards/themes/lol/L1-BLUE-04.jpg` |
| L1-BLUE-05 | 1 | Nami with a modest tide | `apps/web/src/assets/cards/themes/lol/L1-BLUE-05.jpg` |
| L1-BLUE-06 | 1 | Ezreal exploring an old vault | `apps/web/src/assets/cards/themes/lol/L1-BLUE-06.jpg` |
| L1-BLUE-07 | 1 | Seraphine performing beneath cyan stage lights | `apps/web/src/assets/cards/themes/lol/L1-BLUE-07.jpg` |
| L1-BLUE-08 | 0 | Janna guiding an azure harbor breeze | `apps/web/src/assets/cards/themes/lol/L1-BLUE-08.jpg` |
| L1-GREEN-01 | 0 | Ionian grove shrine under emerald leaves | `apps/web/src/assets/cards/themes/lol/L1-GREEN-01.jpg` |
| L1-GREEN-02 | 0 | Ionian acolyte tending green spirit blossoms | `apps/web/src/assets/cards/themes/lol/L1-GREEN-02.jpg` |
| L1-GREEN-03 | 0 | living seed in a forest clearing | `apps/web/src/assets/cards/themes/lol/L1-GREEN-03.jpg` |
| L1-GREEN-04 | 0 | Taliyah shaping moss-covered stone | `apps/web/src/assets/cards/themes/lol/L1-GREEN-04.jpg` |
| L1-GREEN-05 | 1 | Teemo scouting a woodland path | `apps/web/src/assets/cards/themes/lol/L1-GREEN-05.jpg` |
| L1-GREEN-06 | 1 | Lillia in a luminous green glade | `apps/web/src/assets/cards/themes/lol/L1-GREEN-06.jpg` |
| L1-GREEN-07 | 1 | Ivern tending a sapling | `apps/web/src/assets/cards/themes/lol/L1-GREEN-07.jpg` |
| L1-GREEN-08 | 0 | Nidalee tracking through jungle grass | `apps/web/src/assets/cards/themes/lol/L1-GREEN-08.jpg` |
| L1-RED-01 | 0 | Noxian recruit at a training post | `apps/web/src/assets/cards/themes/lol/L1-RED-01.jpg` |
| L1-RED-02 | 0 | ember-forged dagger on an anvil | `apps/web/src/assets/cards/themes/lol/L1-RED-02.jpg` |
| L1-RED-03 | 0 | Noxian field banner | `apps/web/src/assets/cards/themes/lol/L1-RED-03.jpg` |
| L1-RED-04 | 0 | Annie with a small fire spell | `apps/web/src/assets/cards/themes/lol/L1-RED-04.jpg` |
| L1-RED-05 | 1 | Rumble working on his mech | `apps/web/src/assets/cards/themes/lol/L1-RED-05.jpg` |
| L1-RED-06 | 1 | Miss Fortune on a Bilgewater pier | `apps/web/src/assets/cards/themes/lol/L1-RED-06.jpg` |
| L1-RED-07 | 1 | Draven practicing an axe throw | `apps/web/src/assets/cards/themes/lol/L1-RED-07.jpg` |
| L1-RED-08 | 0 | Samira drawing her blade | `apps/web/src/assets/cards/themes/lol/L1-RED-08.jpg` |
| L1-BLACK-01 | 0 | Bilgewater night dock | `apps/web/src/assets/cards/themes/lol/L1-BLACK-01.jpg` |
| L1-BLACK-02 | 0 | Shadow Isles lantern burning violet in black mist | `apps/web/src/assets/cards/themes/lol/L1-BLACK-02.jpg` |
| L1-BLACK-03 | 0 | small Void creature emerging from stone | `apps/web/src/assets/cards/themes/lol/L1-BLACK-03.jpg` |
| L1-BLACK-04 | 0 | Zaun chemtech vial radiating dark violet fumes | `apps/web/src/assets/cards/themes/lol/L1-BLACK-04.jpg` |
| L1-BLACK-05 | 1 | Twitch stalking a purple-lit sewer | `apps/web/src/assets/cards/themes/lol/L1-BLACK-05.jpg` |
| L1-BLACK-06 | 1 | Shaco with a trickster mask | `apps/web/src/assets/cards/themes/lol/L1-BLACK-06.jpg` |
| L1-BLACK-07 | 1 | Pyke stalking a harbor alley | `apps/web/src/assets/cards/themes/lol/L1-BLACK-07.jpg` |
| L1-BLACK-08 | 0 | Kha'Zix perched on a rock | `apps/web/src/assets/cards/themes/lol/L1-BLACK-08.jpg` |

### 레벨 2

| 카드 ID | 승점 | 소재 | 이미지 |
| --- | ---: | --- | --- |
| L2-WHITE-01 | 1 | Garen charging with his broadsword | `apps/web/src/assets/cards/themes/lol/L2-WHITE-01.jpg` |
| L2-WHITE-02 | 1 | Fiora in a fencing duel | `apps/web/src/assets/cards/themes/lol/L2-WHITE-02.jpg` |
| L2-WHITE-03 | 2 | Vayne hunting beneath silver moonlight | `apps/web/src/assets/cards/themes/lol/L2-WHITE-03.jpg` |
| L2-WHITE-04 | 2 | Leona bearing her solar shield | `apps/web/src/assets/cards/themes/lol/L2-WHITE-04.jpg` |
| L2-WHITE-05 | 2 | Taric channeling pale celestial gem magic | `apps/web/src/assets/cards/themes/lol/L2-WHITE-05.jpg` |
| L2-WHITE-06 | 3 | Senna firing a white-gold relic cannon | `apps/web/src/assets/cards/themes/lol/L2-WHITE-06.jpg` |
| L2-BLUE-01 | 1 | Ahri casting fox-fire | `apps/web/src/assets/cards/themes/lol/L2-BLUE-01.jpg` |
| L2-BLUE-02 | 1 | Orianna directing her clockwork ball | `apps/web/src/assets/cards/themes/lol/L2-BLUE-02.jpg` |
| L2-BLUE-03 | 2 | Jayce wielding his transforming hammer | `apps/web/src/assets/cards/themes/lol/L2-BLUE-03.jpg` |
| L2-BLUE-04 | 2 | Caitlyn aiming a blue-lit hextech rifle | `apps/web/src/assets/cards/themes/lol/L2-BLUE-04.jpg` |
| L2-BLUE-05 | 2 | Ekko leaping through fractured time | `apps/web/src/assets/cards/themes/lol/L2-BLUE-05.jpg` |
| L2-BLUE-06 | 3 | Ryze protecting a rune scroll | `apps/web/src/assets/cards/themes/lol/L2-BLUE-06.jpg` |
| L2-GREEN-01 | 1 | Yasuo drawing a wind blade | `apps/web/src/assets/cards/themes/lol/L2-GREEN-01.jpg` |
| L2-GREEN-02 | 1 | Irelia commanding jade-green floating blades | `apps/web/src/assets/cards/themes/lol/L2-GREEN-02.jpg` |
| L2-GREEN-03 | 2 | Karma invoking Ionian spirit magic | `apps/web/src/assets/cards/themes/lol/L2-GREEN-03.jpg` |
| L2-GREEN-04 | 2 | Rakan dashing through emerald spirit magic | `apps/web/src/assets/cards/themes/lol/L2-GREEN-04.jpg` |
| L2-GREEN-05 | 2 | Xayah launching forest-green feather blades | `apps/web/src/assets/cards/themes/lol/L2-GREEN-05.jpg` |
| L2-GREEN-06 | 3 | Rengar tracking prey in dense jungle | `apps/web/src/assets/cards/themes/lol/L2-GREEN-06.jpg` |
| L2-RED-01 | 1 | Darius raising his Noxian axe | `apps/web/src/assets/cards/themes/lol/L2-RED-01.jpg` |
| L2-RED-02 | 1 | Katarina spinning with daggers | `apps/web/src/assets/cards/themes/lol/L2-RED-02.jpg` |
| L2-RED-03 | 2 | Brand erupting with fire | `apps/web/src/assets/cards/themes/lol/L2-RED-03.jpg` |
| L2-RED-04 | 2 | Riven reforging her blade amid crimson embers | `apps/web/src/assets/cards/themes/lol/L2-RED-04.jpg` |
| L2-RED-05 | 2 | Sett entering a fighting ring | `apps/web/src/assets/cards/themes/lol/L2-RED-05.jpg` |
| L2-RED-06 | 3 | Sivir throwing her crossblade through red desert dust | `apps/web/src/assets/cards/themes/lol/L2-RED-06.jpg` |
| L2-BLACK-01 | 1 | Zed emerging from living shadow | `apps/web/src/assets/cards/themes/lol/L2-BLACK-01.jpg` |
| L2-BLACK-02 | 1 | Evelynn in a dark alley | `apps/web/src/assets/cards/themes/lol/L2-BLACK-02.jpg` |
| L2-BLACK-03 | 2 | Thresh swinging a violet spectral lantern | `apps/web/src/assets/cards/themes/lol/L2-BLACK-03.jpg` |
| L2-BLACK-04 | 2 | Sylas breaking chains amid purple shadow magic | `apps/web/src/assets/cards/themes/lol/L2-BLACK-04.jpg` |
| L2-BLACK-05 | 2 | Viktor activating a dark violet hextech device | `apps/web/src/assets/cards/themes/lol/L2-BLACK-05.jpg` |
| L2-BLACK-06 | 3 | Warwick leaping through a purple-black Zaun night | `apps/web/src/assets/cards/themes/lol/L2-BLACK-06.jpg` |

### 레벨 3

| 카드 ID | 승점 | 소재 | 이미지 |
| --- | ---: | --- | --- |
| L3-WHITE-01 | 3 | Kayle descending in radiant judgment | `apps/web/src/assets/cards/themes/lol/L3-WHITE-01.jpg` |
| L3-WHITE-02 | 4 | Galio towering above Demacia | `apps/web/src/assets/cards/themes/lol/L3-WHITE-02.jpg` |
| L3-WHITE-03 | 4 | Pantheon standing before Mount Targon | `apps/web/src/assets/cards/themes/lol/L3-WHITE-03.jpg` |
| L3-WHITE-04 | 5 | celestial gate atop Mount Targon | `apps/web/src/assets/cards/themes/lol/L3-WHITE-04.jpg` |
| L3-BLUE-01 | 3 | Aurelion Sol weaving stars | `apps/web/src/assets/cards/themes/lol/L3-BLUE-01.jpg` |
| L3-BLUE-02 | 4 | Zoe opening a sapphire celestial portal | `apps/web/src/assets/cards/themes/lol/L3-BLUE-02.jpg` |
| L3-BLUE-03 | 4 | Bard crossing a cobalt cosmic threshold | `apps/web/src/assets/cards/themes/lol/L3-BLUE-03.jpg` |
| L3-BLUE-04 | 5 | ancient world rune radiating arcane power | `apps/web/src/assets/cards/themes/lol/L3-BLUE-04.jpg` |
| L3-GREEN-01 | 3 | Maokai awakening in an emerald forest | `apps/web/src/assets/cards/themes/lol/L3-GREEN-01.jpg` |
| L3-GREEN-02 | 4 | Zyra commanding a primeval green thicket | `apps/web/src/assets/cards/themes/lol/L3-GREEN-02.jpg` |
| L3-GREEN-03 | 4 | Neeko reshaping an ancient emerald rainforest | `apps/web/src/assets/cards/themes/lol/L3-GREEN-03.jpg` |
| L3-GREEN-04 | 5 | vast Spirit Blossom realm in lush emerald light | `apps/web/src/assets/cards/themes/lol/L3-GREEN-04.jpg` |
| L3-RED-01 | 3 | Swain commanding a Noxian legion | `apps/web/src/assets/cards/themes/lol/L3-RED-01.jpg` |
| L3-RED-02 | 4 | Renekton charging through a crimson desert storm | `apps/web/src/assets/cards/themes/lol/L3-RED-02.jpg` |
| L3-RED-03 | 4 | Aatrox wielding a vast crimson blade | `apps/web/src/assets/cards/themes/lol/L3-RED-03.jpg` |
| L3-RED-04 | 5 | Infernal Drake soaring over a volcano | `apps/web/src/assets/cards/themes/lol/L3-RED-04.jpg` |
| L3-BLACK-01 | 3 | Mordekaiser enthroned in a violet-black death realm | `apps/web/src/assets/cards/themes/lol/L3-BLACK-01.jpg` |
| L3-BLACK-02 | 4 | Malzahar opening a vast purple Void gate | `apps/web/src/assets/cards/themes/lol/L3-BLACK-02.jpg` |
| L3-BLACK-03 | 4 | Bel'Veth opening a Void rift | `apps/web/src/assets/cards/themes/lol/L3-BLACK-03.jpg` |
| L3-BLACK-04 | 5 | Viego crossing a kingdom in purple-black mist | `apps/web/src/assets/cards/themes/lol/L3-BLACK-04.jpg` |

## 귀멸의 칼날

### 레벨 1

| 카드 ID | 승점 | 소재 | 이미지 |
| --- | ---: | --- | --- |
| L1-WHITE-01 | 0 | silver mist gathering over a mountain training path | `apps/web/src/assets/cards/themes/demon-slayer/L1-WHITE-01.jpg` |
| L1-WHITE-02 | 0 | pale fog curling around a sheathed Nichirin blade | `apps/web/src/assets/cards/themes/demon-slayer/L1-WHITE-02.jpg` |
| L1-WHITE-03 | 0 | white mist drifting through cedar trunks at dawn | `apps/web/src/assets/cards/themes/demon-slayer/L1-WHITE-03.jpg` |
| L1-WHITE-04 | 0 | mist-patterned sword guard on a stone table | `apps/web/src/assets/cards/themes/demon-slayer/L1-WHITE-04.jpg` |
| L1-WHITE-05 | 1 | fog-veiled torii at a quiet mountain pass | `apps/web/src/assets/cards/themes/demon-slayer/L1-WHITE-05.jpg` |
| L1-WHITE-06 | 1 | silver-white breath trails in an empty dojo | `apps/web/src/assets/cards/themes/demon-slayer/L1-WHITE-06.jpg` |
| L1-WHITE-07 | 1 | lantern glow dissolving into pearl-gray mist | `apps/web/src/assets/cards/themes/demon-slayer/L1-WHITE-07.jpg` |
| L1-WHITE-08 | 0 | mist beading on a dark sword sheath | `apps/web/src/assets/cards/themes/demon-slayer/L1-WHITE-08.jpg` |
| L1-BLUE-01 | 0 | empty waterfall training grounds with stepping stones | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLUE-01.jpg` |
| L1-BLUE-02 | 0 | ripples around a practice blade | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLUE-02.jpg` |
| L1-BLUE-03 | 0 | river stepping drill at dawn | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLUE-03.jpg` |
| L1-BLUE-04 | 0 | blue wave patterned sword guard | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLUE-04.jpg` |
| L1-BLUE-05 | 1 | water basin in a swordsmith workshop | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLUE-05.jpg` |
| L1-BLUE-06 | 1 | rain-soaked mountain footpath | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLUE-06.jpg` |
| L1-BLUE-07 | 1 | water reflection of a Nichirin sword | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLUE-07.jpg` |
| L1-BLUE-08 | 0 | flowing stream beside a training dojo | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLUE-08.jpg` |
| L1-GREEN-01 | 0 | emerald wind stirring leaves along a training trail | `apps/web/src/assets/cards/themes/demon-slayer/L1-GREEN-01.jpg` |
| L1-GREEN-02 | 0 | green wind ribbons around a Nichirin sword guard | `apps/web/src/assets/cards/themes/demon-slayer/L1-GREEN-02.jpg` |
| L1-GREEN-03 | 0 | bamboo bending in a sharp spring gust | `apps/web/src/assets/cards/themes/demon-slayer/L1-GREEN-03.jpg` |
| L1-GREEN-04 | 0 | wind chime spinning in a green mountain breeze | `apps/web/src/assets/cards/themes/demon-slayer/L1-GREEN-04.jpg` |
| L1-GREEN-05 | 1 | fallen leaves spiraling across a slayer courtyard | `apps/web/src/assets/cards/themes/demon-slayer/L1-GREEN-05.jpg` |
| L1-GREEN-06 | 1 | green air current whipping an empty haori on a clothesline | `apps/web/src/assets/cards/themes/demon-slayer/L1-GREEN-06.jpg` |
| L1-GREEN-07 | 1 | wind-carved mountain shrine under green clouds | `apps/web/src/assets/cards/themes/demon-slayer/L1-GREEN-07.jpg` |
| L1-GREEN-08 | 0 | practice blade cutting an emerald leaf vortex | `apps/web/src/assets/cards/themes/demon-slayer/L1-GREEN-08.jpg` |
| L1-RED-01 | 0 | firelit swordsmith forge | `apps/web/src/assets/cards/themes/demon-slayer/L1-RED-01.jpg` |
| L1-RED-02 | 0 | red lacquer Nichirin sword sheath | `apps/web/src/assets/cards/themes/demon-slayer/L1-RED-02.jpg` |
| L1-RED-03 | 0 | red forge sparks reflected in polished metalwork | `apps/web/src/assets/cards/themes/demon-slayer/L1-RED-03.jpg` |
| L1-RED-04 | 0 | ember-lit mountain camp | `apps/web/src/assets/cards/themes/demon-slayer/L1-RED-04.jpg` |
| L1-RED-05 | 1 | flame-patterned training banner | `apps/web/src/assets/cards/themes/demon-slayer/L1-RED-05.jpg` |
| L1-RED-06 | 1 | sunset sword practice silhouette | `apps/web/src/assets/cards/themes/demon-slayer/L1-RED-06.jpg` |
| L1-RED-07 | 1 | glowing charcoal brazier | `apps/web/src/assets/cards/themes/demon-slayer/L1-RED-07.jpg` |
| L1-RED-08 | 0 | red maple leaves around a blade | `apps/web/src/assets/cards/themes/demon-slayer/L1-RED-08.jpg` |
| L1-BLACK-01 | 0 | moonlit demon warning bell | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLACK-01.jpg` |
| L1-BLACK-02 | 0 | darkened forest boundary | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLACK-02.jpg` |
| L1-BLACK-03 | 0 | shadowed demon silhouette beyond a gate | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLACK-03.jpg` |
| L1-BLACK-04 | 0 | black Nichirin sword scabbard | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLACK-04.jpg` |
| L1-BLACK-05 | 1 | night patrol lantern | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLACK-05.jpg` |
| L1-BLACK-06 | 1 | abandoned mountain cabin at night | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLACK-06.jpg` |
| L1-BLACK-07 | 1 | poison vial in a medical kit | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLACK-07.jpg` |
| L1-BLACK-08 | 0 | ink-dark crow feathers on a letter | `apps/web/src/assets/cards/themes/demon-slayer/L1-BLACK-08.jpg` |

### 레벨 2

| 카드 ID | 승점 | 소재 | 이미지 |
| --- | ---: | --- | --- |
| L2-WHITE-01 | 1 | Kanao Tsuyuri in pale mist with a white butterfly hairpin | `apps/web/src/assets/cards/themes/demon-slayer/L2-WHITE-01.jpg` |
| L2-WHITE-02 | 1 | mist-wrapped training mask resting on a cedar branch | `apps/web/src/assets/cards/themes/demon-slayer/L2-WHITE-02.jpg` |
| L2-WHITE-03 | 2 | Murata advancing carefully through a silver fog | `apps/web/src/assets/cards/themes/demon-slayer/L2-WHITE-03.jpg` |
| L2-WHITE-04 | 2 | Aoi Kanzaki at the Butterfly Mansion in white morning mist | `apps/web/src/assets/cards/themes/demon-slayer/L2-WHITE-04.jpg` |
| L2-WHITE-05 | 2 | layered Mist Breathing feints in a moonlit grove | `apps/web/src/assets/cards/themes/demon-slayer/L2-WHITE-05.jpg` |
| L2-WHITE-06 | 3 | white-gray mist technique obscuring a bridge | `apps/web/src/assets/cards/themes/demon-slayer/L2-WHITE-06.jpg` |
| L2-BLUE-01 | 1 | Sabito practicing Water Breathing | `apps/web/src/assets/cards/themes/demon-slayer/L2-BLUE-01.jpg` |
| L2-BLUE-02 | 1 | Makomo guiding a breathing exercise | `apps/web/src/assets/cards/themes/demon-slayer/L2-BLUE-02.jpg` |
| L2-BLUE-03 | 2 | Sakonji Urokodaki demonstrating a water drill | `apps/web/src/assets/cards/themes/demon-slayer/L2-BLUE-03.jpg` |
| L2-BLUE-04 | 2 | Water Breathing rippling sword forms above a canal | `apps/web/src/assets/cards/themes/demon-slayer/L2-BLUE-04.jpg` |
| L2-BLUE-05 | 2 | Tanjiro Kamado performing Water Breathing Water Wheel | `apps/web/src/assets/cards/themes/demon-slayer/L2-BLUE-05.jpg` |
| L2-BLUE-06 | 3 | a blue water surface slash across a moonlit lake | `apps/web/src/assets/cards/themes/demon-slayer/L2-BLUE-06.jpg` |
| L2-GREEN-01 | 1 | Masachika Kumeno crossing blades in green wind | `apps/web/src/assets/cards/themes/demon-slayer/L2-GREEN-01.jpg` |
| L2-GREEN-02 | 1 | Genya Shinazugawa standing in a fierce forest gale | `apps/web/src/assets/cards/themes/demon-slayer/L2-GREEN-02.jpg` |
| L2-GREEN-03 | 2 | Inosuke Hashibira crossing a leafy forest in green wind | `apps/web/src/assets/cards/themes/demon-slayer/L2-GREEN-03.jpg` |
| L2-GREEN-04 | 2 | Kotetsu with his training doll amid green mountain wind | `apps/web/src/assets/cards/themes/demon-slayer/L2-GREEN-04.jpg` |
| L2-GREEN-05 | 2 | Hotaru Haganezuka carrying a sword in a forest gale | `apps/web/src/assets/cards/themes/demon-slayer/L2-GREEN-05.jpg` |
| L2-GREEN-06 | 3 | green cyclone around a Nichirin blade at night | `apps/web/src/assets/cards/themes/demon-slayer/L2-GREEN-06.jpg` |
| L2-RED-01 | 1 | Nezuko Kamado using Blood Demon Art flame | `apps/web/src/assets/cards/themes/demon-slayer/L2-RED-01.jpg` |
| L2-RED-02 | 1 | flame-patterned Nichirin sword guard on red silk | `apps/web/src/assets/cards/themes/demon-slayer/L2-RED-02.jpg` |
| L2-RED-03 | 2 | Shinjuro Rengoku drawing a fiery blade | `apps/web/src/assets/cards/themes/demon-slayer/L2-RED-03.jpg` |
| L2-RED-04 | 2 | Susamaru hurling a scarlet temari ball | `apps/web/src/assets/cards/themes/demon-slayer/L2-RED-04.jpg` |
| L2-RED-05 | 2 | Yahaba directing red arrow force | `apps/web/src/assets/cards/themes/demon-slayer/L2-RED-05.jpg` |
| L2-RED-06 | 3 | scarlet flame technique lighting a night forest | `apps/web/src/assets/cards/themes/demon-slayer/L2-RED-06.jpg` |
| L2-BLACK-01 | 1 | Rui weaving spider threads | `apps/web/src/assets/cards/themes/demon-slayer/L2-BLACK-01.jpg` |
| L2-BLACK-02 | 1 | Enmu on the Infinity Train | `apps/web/src/assets/cards/themes/demon-slayer/L2-BLACK-02.jpg` |
| L2-BLACK-03 | 2 | Hand Demon lurking near Final Selection | `apps/web/src/assets/cards/themes/demon-slayer/L2-BLACK-03.jpg` |
| L2-BLACK-04 | 2 | Swamp Demon emerging from dark water | `apps/web/src/assets/cards/themes/demon-slayer/L2-BLACK-04.jpg` |
| L2-BLACK-05 | 2 | Spider Mother demon among forest threads | `apps/web/src/assets/cards/themes/demon-slayer/L2-BLACK-05.jpg` |
| L2-BLACK-06 | 3 | Spider Father demon in a moonlit forest | `apps/web/src/assets/cards/themes/demon-slayer/L2-BLACK-06.jpg` |

### 레벨 3

| 카드 ID | 승점 | 소재 | 이미지 |
| --- | ---: | --- | --- |
| L3-WHITE-01 | 3 | Muichiro Tokito emerging from Mist Breathing | `apps/web/src/assets/cards/themes/demon-slayer/L3-WHITE-01.jpg` |
| L3-WHITE-02 | 4 | Gyomei Himejima with stone-gray prayer beads in pale mist | `apps/web/src/assets/cards/themes/demon-slayer/L3-WHITE-02.jpg` |
| L3-WHITE-03 | 4 | Obanai Iguro and his white serpent beneath a silver moon | `apps/web/src/assets/cards/themes/demon-slayer/L3-WHITE-03.jpg` |
| L3-WHITE-04 | 5 | Shinobu Kocho amid white butterfly wings and soft mist | `apps/web/src/assets/cards/themes/demon-slayer/L3-WHITE-04.jpg` |
| L3-BLUE-01 | 3 | Giyu Tomioka performing Water Breathing Dead Calm | `apps/web/src/assets/cards/themes/demon-slayer/L3-BLUE-01.jpg` |
| L3-BLUE-02 | 4 | water dragon shaped from a powerful sword current | `apps/web/src/assets/cards/themes/demon-slayer/L3-BLUE-02.jpg` |
| L3-BLUE-03 | 4 | towering blue wave breaking through a moonlit gorge | `apps/web/src/assets/cards/themes/demon-slayer/L3-BLUE-03.jpg` |
| L3-BLUE-04 | 5 | Water Breathing waterfall basin in a storm | `apps/web/src/assets/cards/themes/demon-slayer/L3-BLUE-04.jpg` |
| L3-GREEN-01 | 3 | Sanemi Shinazugawa unleashing Wind Breathing | `apps/web/src/assets/cards/themes/demon-slayer/L3-GREEN-01.jpg` |
| L3-GREEN-02 | 4 | Zohakuten commanding green wooden dragons in a storm | `apps/web/src/assets/cards/themes/demon-slayer/L3-GREEN-02.jpg` |
| L3-GREEN-03 | 4 | Gyokko emerging from a green-glazed vase | `apps/web/src/assets/cards/themes/demon-slayer/L3-GREEN-03.jpg` |
| L3-GREEN-04 | 5 | Kagaya Ubuyashiki in a wind-swept emerald garden | `apps/web/src/assets/cards/themes/demon-slayer/L3-GREEN-04.jpg` |
| L3-RED-01 | 3 | Kyojuro Rengoku with Flame Breathing | `apps/web/src/assets/cards/themes/demon-slayer/L3-RED-01.jpg` |
| L3-RED-02 | 4 | Akaza launching crimson destructive shockwaves | `apps/web/src/assets/cards/themes/demon-slayer/L3-RED-02.jpg` |
| L3-RED-03 | 4 | Daki fighting with long patterned obi | `apps/web/src/assets/cards/themes/demon-slayer/L3-RED-03.jpg` |
| L3-RED-04 | 5 | Gyutaro wielding blood sickles | `apps/web/src/assets/cards/themes/demon-slayer/L3-RED-04.jpg` |
| L3-BLACK-01 | 3 | Muzan Kibutsuji in a terrifying night scene | `apps/web/src/assets/cards/themes/demon-slayer/L3-BLACK-01.jpg` |
| L3-BLACK-02 | 4 | Kokushibo with violet moon-shaped sword arcs | `apps/web/src/assets/cards/themes/demon-slayer/L3-BLACK-02.jpg` |
| L3-BLACK-03 | 4 | Doma surrounded by dark violet icy lotus Blood Demon Art | `apps/web/src/assets/cards/themes/demon-slayer/L3-BLACK-03.jpg` |
| L3-BLACK-04 | 5 | Nakime folding the Infinity Castle into purple shadows | `apps/web/src/assets/cards/themes/demon-slayer/L3-BLACK-04.jpg` |
