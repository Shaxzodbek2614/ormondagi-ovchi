# O‘rmondagi ovchi: ishlash eslatmasi

Brauzerda ishlaydigan 3D ov o‘yini. Three.js, build bosqichi yo‘q. Foydalanuvchi o‘zbek tilida yozadi, o‘yin matnlari va koddagi izohlar ham o‘zbekcha.

- Sayt: https://shaxzodbek2614.github.io/ormondagi-ovchi/
- Repo: https://github.com/Shaxzodbek2614/ormondagi-ovchi (ochiq, `main` Pages’ga chiqadi)
- Claude havolasi: https://claude.ai/artifact/KdHcWJNveduRpwCDHRVkuL (yopiq, WebRTC va WebSocket ishlamaydi, faqat yakka rejim)

`vizitka/` papkasi foydalanuvchining boshqa ishi. Unga tegmang, commit’ga qo‘shmang: `git add -A` ishlatmang.

## Tuzilishi

`index.html` Three.js’ni modul sifatida yuklab global qiladi, keyin `js/` fayllarini `files` ro‘yxatidagi tartibda oddiy skript qilib ulaydi. Shuning uchun:

- `index.html` faylni ikki marta bosib ochish ishlaydi, server shart emas.
- Fayllar umumiy global `const`/`let` ishlatadi, `import` yo‘q. Tartib muhim: yuklanish paytida ishlaydigan kod faqat oldingi fayllarga tayanadi.
- Yangi fayl qo‘shsangiz, `index.html`dagi ro‘yxatga yozing.
- Har chiqishda `index.html`dagi `BUILD` va `style.css?v=` raqamini oshiring, aks holda brauzer eski fayllarni ishlatadi.

Asosiy fayllar: `config.js` (urug‘, CONFIG, profil), `world-map.js` (balandlik, daryo, ko‘l, o‘tish joylari), `scene.js` (sharoit qatlamlari, fasl shaderi), `animals.js` (SPECIES, Animal, Waterfowl, Fish), `dog.js`, `weapons.js`, `game.js` (raund, natija), `day-cycle.js` (raund ichida kun o‘tishi), `missions.js`, `fishing.js`, `placeables.js` (minora, tuzoq, gulxan), `boat.js` (qayiq va ko‘prikchalar), `progress.js` (daraja, trofey), `map.js` (xarita, kompas), `bots.js` (bot sheriklar), `team-missions.js`, `network.js`, `relay.js`, `team-round.js`, `team-chat.js` (tez xabarlar, `sendToTeam`), `team-battle.js` (jamoa jangi: ovchiga o‘q tegishi, lagerda turish), `spectate.js` (yiqilganda sherikni kuzatish), `lobby.js`, `controls.js` (tugmalar, do‘kon, jihoz tanlash), `main.js` (sikl).

## Muhim tushunchalar

- **Urug‘li dunyo:** dunyo qurilishi vaqtida `Math.random` urug‘li generatorga almashtiriladi (`config.js`), `main.js`da qaytariladi. Xona kodi urug‘ bo‘ladi, hammada bir xil o‘rmon chiqadi. Dunyo qurilishi tartibini qurilmaga bog‘liq qilmang. Dunyo faqat yuklanishda quriladi, uni o‘zgartirish uchun sahifa qayta yuklanadi.
- **Xost modeli:** xonani ochgan o‘yinchi hayvonlar va vaqtni hisoblaydi (`Animal.update`). Mijozlarda hayvon qo‘g‘irchoq: `updatePuppet` xostdan kelgan holatni ko‘rsatadi. `hunters` ro‘yxatida barcha ovchilar, hayvon eng yaqinini tanlaydi.
- **Ulanish:** avval PeerJS (WebRTC), 6 soniyada bo‘lmasa `relay.js` orqali ochiq MQTT serverlari. PeerJS’ning TURN serverlari o‘lik. O‘zbekistondagi provayderlarda symmetric NAT bor, to‘g‘ridan-to‘g‘ri ulanish ko‘pincha ishlamaydi, shuning uchun server yo‘li asosiy deb hisoblang.
- **RelayLink:** PeerJS ulanishi kabi ishlaydi. Mijoz ortiqcha serverni `end()` bilan yumshoq yopadi: `end(true)` last-will xabarini yuboradi va xost mijozni chiqib ketgan deb o‘ylaydi.
- **Oyna orqa fonda:** `requestAnimationFrame` to‘xtaydi, xonada Worker soati `simulate()`ni chaqiradi.
- **Hayvon o‘lganda** 13–19 soniyada qayta tiriladi. Missiya sanayotgan hayvonlarga `staysDead` qo‘ying.
- **Yangi tur qo‘shsangiz** hayvon raqamlari o‘zgaradi: `PROTOCOL_VERSION`ni oshiring.
- **Ko‘p ko‘lli dunyo:** missiyada `world: { lakes: 11 }` bo‘lsa, `openMission` sessionStorage’ga yozib sahifani qayta yuklaydi, `config.js` shu qiymat bilan dunyo quradi.
- **Jihozlar:** o‘yin mantig‘ida `owns()` emas, `isEquipped()` ishlating: o‘yinchi sotib olganini raundga olib chiqmasligi mumkin.
- **Trofey** o‘q uzgan o‘yinchiga yoziladi: xost `kill` xabarida `by` yuboradi.
- **Qurollar:** `WEAPONS` jadvali o‘zgarmaydi. O‘yin mantig‘ida `weapon.gun` ishlating: `gunStats(id)` unga `profile.weaponLevels`dagi darajani qo‘shadi. Yangi qurol uchun `WEAPONS`, `WEAPON_ORDER` va `weaponShapes`ga yozing.
- **Botlar:** xost boshqaradi, `network.roster`da `isBot` a’zo, aloqasi yo‘q. Boshqalarga oddiy sherik bo‘lib ko‘rinadi: holati `sendWorld`, zarbasi `applyHit` orqali o‘tadi. Xona to‘lsa, bot do‘stga joy beradi. Yiqilgan bot 30 soniyada o‘zi turadi.
- **`botPlan(bot)`:** jamoa missiyasi botga vazifa beradi: `{ moveTo, target, sure, sneak }`. Hujum qilayotgan yirtqichni bot baribir otadi, faqat qurolsiz rolda otmaydi.
- **Qochish:** hayvon `fleeFrom` ovchidan qochadi, boshqa ovchi 8 metrga yaqinlashsa undan. Har kadrda eng yaqin ovchidan qochsa, bug‘u zonaga kirmay qaytadi va Haydab ov ishlamaydi.
- **Jamoalar:** `ROLE_INFO`dagi `team` maydoni. `teamOf(id)`, `sameTeam`, `myRosterId()` ishlating. Xostda `player.id` `'me'`, roster raqami esa `HOST_ID`: ovchidan raqam olish uchun `hunterId(hunter)`. Mijozga rollar status bilan keladi, `renderTeamStatus` ularni `network.roles`ga yozadi. Belgi va tez xabar `sendToTeam` bilan faqat o‘z jamoasiga boradi.
- **Jamoa jangi:** `pvp`, `noRevive`, `noWipe`, `pickRoles`, `lateRole` bayroqlari. Ovchiga tekkan o‘qni xost `battleHit` bilan hal qiladi, jon `mission.health`da. Mijoz o‘z jonini `hurt` xabari bilan xuddi shuncha kamaytiradi, shuning uchun bu missiyada dori ichish o‘chiq.
- **Kun o‘tishi:** `time: 'cycle'`. `prepareDayCycle` raund boshida 4 paytni bir marta hisoblaydi, `updateDayCycle` har kadrda `applyDaylight`ni chaqiradi. Payt `game.timeLeft`dan olinadi, tarmoqqa yangi maydon kerak emas. `applyConditions`ni har kadrda chaqirmang.
- **Qo‘yiladigan narsalar** (minora, tuzoq, gulxan) `obstacleGrid`ga yozilmaydi, aks holda `worldChecksum` kech kirgan do‘stni rad etadi. Gulxan yorug‘ligi sahnada doim turgan 2 ta `PointLight`dan olinadi: chiroq sonini o‘zgartirish hamma shaderni qayta quradi.
- **Tog‘ va botqoq:** `planRegion` ko‘llar va o‘tish joylaridan keyin urug‘li joy tanlaydi. `mountainWeight`, `swampWeight`, `mountainLift`, `swampLevel` balandlik, rang, o‘simlik va xaritada ishlatiladi. Joy topilmasa `mountain` yoki `swamp` null bo‘ladi: kod shunga tayyor bo‘lsin.
- **Yashash joyi:** turdagi `habitat` (`mountain`, `meadow`, `forest`). `findSpawnPoint` va `pickWanderTarget` `inHabitat` va `habitatPoint` bilan joy tanlaydi.
- **Yangi hayvonlar** `SPECIES` oxirida: eski raqamlar o‘zgarmasin. Qirg‘ovul `GroundBird extends Waterfowl` (`flightBase`, `land`), tuzoq qushga ishlamaydi. Silovsin `ambush` bilan `lurk` holatida poylaydi. Yangi holat qo‘shsangiz, `ANIMAL_STATES` oxiriga yozing, aks holda mijozda o‘tlayotgandek ko‘rinadi.
- **Qayiq:** `player.inBoat`. Holat qatorining 9-maydoni, 4 joy birga o‘zgaradi: `localPlayerState`, xostdagi `me` uzunligi, `BotHunter.stateArray`, `RemoteHunter.applyState`. Ko‘prikchalarni `createDocks()` dunyo qurilgach tasodifsiz hisoblaydi.
- **Zona janggi:** `versus: true` missiya. `goals` bo‘sh, vaqt tugashi g‘alaba hisoblanadi, ochkoni `board` ko‘rsatadi, `settleVersus` g‘olibga to‘liq, qolganlarga yarim mukofot beradi.

## Sinash

- Brauzer paneli `file://`ni data sahifa qiladi va nisbiy fayllar yuklanmaydi. Mahalliy server kerak: `.claude/launch.json`da `python3 -m http.server 8642`, sinovdan keyin o‘chiring.
- Oddiy `http.server` kesh sarlavhasi bermaydi: brauzer `?v=BUILD` bo‘yicha eski skriptni olib qoladi. Kod o‘zgarganda `BUILD`ni oshiring yoki `Cache-Control: no-store` beradigan server ishlating.
- Global o‘zgaruvchilarga `javascript_tool`dan to‘g‘ridan-to‘g‘ri murojaat qilsa bo‘ladi (`player`, `game`, `animals`).
- Panel yashirin bo‘lsa, `requestAnimationFrame` ishlamaydi. Uchburchak sonini `renderer.render(scene, camera)` ni qo‘lda chaqirib, `renderer.info`dan o‘qing.
- Pointer lock panelda ishlamaydi, o‘yin erkin sichqoncha rejimiga o‘tadi. `document.hidden` false bo‘lsa ham panel yashirin bo‘lishi mumkin: FPS o‘lchovlariga ishonmang.
- Server yo‘lini majburlash: manzilga `?relay=1` qo‘shing. Ikki tab bilan bitta kompyuterda WebRTC doim ishlaydi, haqiqiy tarmoqni aks ettirmaydi.
- Botlar va missiyalarni tez sinash: `simulate(.05)`ni tsiklda chaqiring. Odam o‘yinchi turib qolsa, hayvon uni yiqitadi: `player.hp`ni tiklab turing, aks holda raund vaqtidan oldin tugaydi.

## Joylash

1. `BUILD` va CSS versiyasini oshiring, kerakli fayllarni aniq nomi bilan commit qiling, `git push origin main`.
2. Pages qurilishi 1 daqiqadan 10 daqiqagacha cho‘ziladi. Tayyorligini yangi fayl mazmuni bo‘yicha tekshiring: 404 sahifa ham katta hajmli, `wc -c` aldaydi.
3. Sayt `max-age=600` bilan keshlanadi: foydalanuvchilarga sahifani yangilashni ayting.
4. Claude havolasi uchun `index.html`dan doctype, html, head, body va meta teglarini olib tashlang, sahifani `files` bilan publish qiling.

## Saboqlar

- zsh’da `path` o‘zgaruvchisini ishlatmang: u `PATH`ga bog‘langan. So‘zga bo‘linish ham yo‘q.
- Hayvonni joylab darhol `fire()` qilsangiz, nishon qutisining matritsasi hali yangilanmagan bo‘ladi va o‘q tegmaydi. Bir kadr kuting.
- Botlar daraxt orqasidagi nishonga otmaydi: `botPlan` to‘siq bo‘lsa yaqinlashishni buyurmasa, ikki bot bir-biriga qarab abadiy turib qoladi.
- Sinovlarda hayvonlarni bir zumda o‘ldirish vaqtga bog‘liq xatolarni yashiradi (to‘lqin xatosi shunday o‘tib ketgan). Mantiqni real vaqt oralig‘i bilan ham sinang.
