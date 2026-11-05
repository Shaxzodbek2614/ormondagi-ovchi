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

Asosiy fayllar: `config.js` (urug‘, CONFIG, profil), `world-map.js` (balandlik, daryo, ko‘l, o‘tish joylari), `scene.js` (sharoit qatlamlari, fasl shaderi), `animals.js` (SPECIES, Animal, Waterfowl, Fish), `dog.js`, `weapons.js`, `game.js` (raund, natija), `missions.js`, `fishing.js`, `placeables.js` (minora, tuzoq), `progress.js` (daraja, trofey), `map.js` (xarita, kompas), `team-missions.js`, `network.js`, `relay.js`, `team-round.js`, `lobby.js`, `controls.js` (tugmalar, do‘kon, jihoz tanlash), `main.js` (sikl).

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

## Sinash

- Brauzer paneli `file://`ni data sahifa qiladi va nisbiy fayllar yuklanmaydi. Mahalliy server kerak: `.claude/launch.json`da `python3 -m http.server 8642`, sinovdan keyin o‘chiring.
- Global o‘zgaruvchilarga `javascript_tool`dan to‘g‘ridan-to‘g‘ri murojaat qilsa bo‘ladi (`player`, `game`, `animals`).
- Pointer lock panelda ishlamaydi, o‘yin erkin sichqoncha rejimiga o‘tadi. `document.hidden` false bo‘lsa ham panel yashirin bo‘lishi mumkin: FPS o‘lchovlariga ishonmang.
- Server yo‘lini majburlash: manzilga `?relay=1` qo‘shing. Ikki tab bilan bitta kompyuterda WebRTC doim ishlaydi, haqiqiy tarmoqni aks ettirmaydi.

## Joylash

1. `BUILD` va CSS versiyasini oshiring, kerakli fayllarni aniq nomi bilan commit qiling, `git push origin main`.
2. Pages qurilishi 1 daqiqadan 10 daqiqagacha cho‘ziladi. Tayyorligini yangi fayl mazmuni bo‘yicha tekshiring: 404 sahifa ham katta hajmli, `wc -c` aldaydi.
3. Sayt `max-age=600` bilan keshlanadi: foydalanuvchilarga sahifani yangilashni ayting.
4. Claude havolasi uchun `index.html`dan doctype, html, head, body va meta teglarini olib tashlang, sahifani `files` bilan publish qiling.

## Saboqlar

- zsh’da `path` o‘zgaruvchisini ishlatmang: u `PATH`ga bog‘langan. So‘zga bo‘linish ham yo‘q.
- Sinovlarda hayvonlarni bir zumda o‘ldirish vaqtga bog‘liq xatolarni yashiradi (to‘lqin xatosi shunday o‘tib ketgan). Mantiqni real vaqt oralig‘i bilan ham sinang.
