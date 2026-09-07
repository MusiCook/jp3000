/* ============================================================
   groups.js  ·  의미 그룹
   보기(오답 후보)를 뽑을 때 같은 그룹 안에서 먼저 찾는다.
   키는 스템(앞부분)이므로 활용형에도 자동으로 붙는다.
   긴 스템이 우선하므로 tabemono(음식)가 tabe(먹다)보다 먼저 잡힌다.
   ============================================================ */
window.GROUPS = {

인사:"konnichiwa hajimemashite arigatou shitsurei ogenki douzo yoroshiku mata onegaishimasu sumimasen hai iie sou mochiron zehi",

인명:"tanaka kimu minsu satou suzuki yamada takahashi yonhi jisu",

사람:"watashi hito tomodachi dare donata dareka kodomo otona sensei gakusei kaishain kankokujin nihonjin kakariin minna hitori futari sannin nannin nin kojin dantai shinia kizzu famirii pea",

가족:"kazoku ani ane otouto imouto kekkon",

이름:"onamae namae myouji juusho shokugyou nenrei shinchou bangou denwabangou nanbaa adoresu pasuwaado",

장소:"nihon kankoku kuni nihongo setsubi otearai teeburu eki hoteru tatemono mise konbini ginkou byouin depaato resutoran basutei chikatetsu uketsuke kouban yuubinkyoku kuukou kaisatsu homu baiten annaijo machi heya kouen kaisha gakkou supaa yakkyoku chuushajou kissaten kafe robii furoa tokoro shisetsu jinja otera teemapaaku tawaa taaminaru geeto kauntaa reji furonto koinrokkaa jihanki tennai meisho supotto basho zoon eria koonaa deiriguchi hijouguchi tsuuro",

위치:"sore are hou ue shita naka soto mae ushiro tonari soba chikaku kado yoko migigawa hidarigawa mukou temae tsukiatari chika migi hidari deguchi iriguchi kousaten oudanhodou michi hashi shingou massugu dochira kochira sochira achira koko soko asoko doko",

교통:"kuuseki manseki densha basu takushii kuruma jitensha hikouki shinkansen monoreeru rimujinbasu shatoru esukareetaa erebeetaa roopuwei keeburukaa wagon bansen zaseki shiito seki yuusenseki hassha shuppatsu touchaku tokkyuu futsuu katamichi oufuku kippu chiketto toujitsuken maeuriken wandeepasu jikokuhyou daiya shihatsu saishuu rasshu piiku koutsuu doa hakusen ashimoto shanai anaunsu yuki2 tsugi",

시간:"yasumi oopun jikan ji yoji shichiji kuji fun nanpun han nanji ima kyou ashita kinou konya asa hiru yoru gozen gogo gozenchuu shuumatsu heijitsu renkyuu teikyuubi kikan taizai toki baai ichinichi ichido kondo konkai saikin yotei kaishi shuuryou kaiten heiten eigyou ato saigoni tsugini",

날씨:"tenki tenkiyohou hare kumori ame yuki taifuu kion kaze2 jishin keihou natsu fuyu haru aki",

숫자:"purasu ichi ni2 san3 yon go roku nana hachi kyuu juu hyaku sen sanzen man zero hitotsu futatsu mittsu yottsu itsutsu muttsu nanatsu yattsu kokonotsu too ikutsu ko mai do ban ijou ika paasento meetoru kiro teiin",

돈:"saabisu okane en nedan ryoukin ikura otsuri genkin kaado kurejitto kyasshuresu reshiito ryoushuusho ryougae yuuro waribiki muryou yuuryou kaikei chuumon oodaa teikuauto serufu kashidashi henkyaku",

음식:"tabemono ryouri shokuji choushoku chuushoku yuushoku sushi sashimi tenpura udon soba2 raamen karee piza nuudoru pan dezaato yooguruto soosu aji baikingu mooningu ranchi dinaa menyuu setto dorinku",

음료:"mizu ocha koohii biiru wain juusu aisu gurasu potto",

물건:"bokkusu sain kaban baggu suutsukeesu nimotsu tenimotsu kagi keitai sumaho pasupooto biza saifu hon shinbun chizu mappu panfuretto memo risuto fairu youshi foomu taitoru kamera terebi heddohon pen botan konsento batterii doraiyaa taoru hangaa surippa gomi fukuro omiyage gifuto sanpuru baakoodo koodo isu tsukue beddo mado denki eakon shawaa netto apuri saito peeji burogu deeta kuupon pointo",

옷:"fuku shatsu zubon kooto nekutai megane kutsu saizu masuku",

몸:"karada atama nodo ha kao netsu kaze kusuri isha byouki kega guai kimochi arerugii kurinikku sapuri kyuukyuusha hoken",

동물:"neko inu petto sakura hanabi matsuri keshiki umi yama onsen",

손동작:"mochi ire dashi oshi hiki oshite hiite hiita ake shime tsuke keshi arai migaki tsutsumi hakobi sute oki2 okanai sawari sawaranai tacchi tome naoshi kae",

감각:"tabe nomi mi kiki mite kiite sui suwanai yomi tabete nonde yonde",

말하기:"hanashi ii2 tsutae yobi kiki2 tanomi sasoi soudan renraku setsumei kakunin chekku shitsumon2 atte ai",

생활:"oki nete suwari tachi kigae dekake sanpo yasumi3 souji sentaku junbi renshuu benkyou kaimono shoppingu shashin satsuei kengaku shichaku inshoku riyou sanka",

사무:"okuri tetsudai isogi kaki kai kaki2 sagashi sagasu mitsuke nakushi wasure kinyuu sukyan chaaji rentaru henkou enchou tsuika kyanseru kopii kaeshi kashi kari azuke harai tsukai tsukatte tsukatta tsukaemasu tsukaemasen tsukawanai erabi kime matte matta matsu shi suru",

판단:"wakari omoi",

이동:"tsuita kuru itte itta iku ikemasu aruite aruita magatte magatta tsuite tatanai oyogu iki ki kaeri nori ori tsuki watari magari norikae aruki hairi de modori nyuujou chekkuin chekkuauto",

변화:"hajimari owari kimari kawari koware nure kie tsuki2 shimari ochi todoki mitsukari naori tsuzuki nokori kakari",

존재:"arimasen arimashita arimasendeshita aru atta atta2 aiteita tomari tomari2 narabi komi aki2 sumu shiri mie kikoe",

몸움직임:"hataraki asobi hashiri oyogi yasunde yasunda yasumi2 tsukare mayoi okure komari tasukari machigae korobi furu furi",

성질:"ookiku chiisaku takaku yasuku atarashiku furuku oishiku atsuku samuku isogashiku tanoshiku urusaku muzukashiku hiroku semaku nagaku omoshiroku amaku karaku waruku yoku wakaku mijikaku atsukatta samukatta yokatta isogashikatta tanoshikatta hirokatta oishikatta takakatta tsumaranakatta omoshirokatta warukatta itakatta itakunai yasukunai takakunai yokunai shizukada shizukajanai genkida daijoubuda daijoubudatta byoukijanai ookii chiisai takai yasui atarashii furui oishii shizuka yuumei kirei benri omoshiroi tsumaranai wakai shinsetsu taihen suteki hiroi semai nagai mijikai atsui samui ii warui isogashii tanoshii urusai muzukashii genki hima daijoubu karai amai suki kirai muri zannen tokubetsu saikou jouzu heta tokui nigate tadashii onaji hitsuyou taisetsu itai abunai kiken hayai hoshii ninki",

생각:"keesu pataan taipu opushon gureedo omoi iken sansei hantai mondai kanji2 aidea komento imeeji teema reberu imi riyuu shitsumon kotae hontou tanoshimi mokuteki joukyou jouhou koto",

말:"kotoba tango moji kanji hatsuon koe hanashi2 kaiwa tsuuyaku honyaku henji nyuusu meeru messeeji chatto onrain mobairu dejitaru annai anaunsu2",

안내판:"chuui koshou chuushi enryo junban kinshi tabako kinen tachiiri manaa ruuru bebiikaa furasshu seigen araamu kinkyuu keisatsu taishikan jiko toraburu misu sapooto herupu sentaa infomeeshon kooruSentaa hottorain otoshimono wasuremono",

여행:"ryokou kankou tsuaa koosu puran sukejuuru gaido atorakushon ibento shiizun besuto rankingu toppu burando sutairu supootsu dansu piano geemu sukii joguingu paatii doraibu pikunikku karaoke guruupu isshoni machiawase shuugou yakusoku youji tsugou",

부사:"tsumari tatoeba demo dakara jaa eeto totemo amari takusan sukoshi mou mada yukkuri chotto zenbu ichiban motto zutto zenzen nakanaka kanari sugoku daitai hotondo tokuni tashika kitto tabun mazu sorekara sonogo sugu atode sakini yoku2 mouichido hayaku moshi itsu dou donna dono kono sono ano dore nan nani nanika",

조사:"wa no ka yori ne yo yone to he wo de gurai kara made ga ni mo",

문형:"teimasen teimashita desu janaidesu da janai datta janakatta nai ra kadouka tearimasu tearimashita deshou kamoshiremasen ri tewaikemasen dekudasai moiidesu teiru teimasu itadakemasuka kudasaimasenka kudasai kattadesu nakattadesu deshita janakattadesu naidesu dekimasu chigaimasu attemasu2 arimasu imasu san"

};

/* ============================================================
   같은 뜻으로 인정하는 짝
   [키A, 키B, 차이 설명]
   보기에서 서로 만나면 어느 쪽을 골라도 정답으로 처리하고,
   두 말의 차이를 알려준다.
   お가 붙고 안 붙는 짝은 아래 코드가 자동으로 찾아 넣는다.
   ============================================================ */
window.EQ = [
 ["toire","otearai","お手洗い가 더 정중한 말이다"],
 ["kaban","baggu","かばん은 일본 고유어, バッグ는 영어에서 온 말"],
 ["shoppingu","kaimono","뜻은 같고 買い物이 더 일상적이다"],
 ["nanbaa","bangou","番号가 기본, ナンバー는 차 번호판 등에 쓴다"],
 ["shiito","zaseki","표·안내판에는 座席, 실내 좌석은 シート를 자주 쓴다"],
 ["eria","zoon","둘 다 구역. 간판에서 섞여 쓰인다"],
 ["chuumon","oodaa","가게에 따라 둘 다 쓴다"],
 ["mappu","chizu","地図가 기본, 관광 안내물은 マップ를 쓴다"],
 ["migi","migigawa","右는 오른쪽, 右側은 오른편(면)"],
 ["hidari","hidarigawa","左는 왼쪽, 左側은 왼편(면)"],
 ["wasuremono","otoshimono","忘れ物는 두고 온 것, 落とし物는 떨어뜨린 것"],
 ["ryoushuusho","reshiito","領収書는 이름을 적는 증빙, レシート는 계산대에서 나오는 종이"],
 ["saishuu","shihatsu","最終는 막차, 始発는 첫차. 반대말이니 주의"],
 ["muryou","furii","둘 다 무료. 간판에서 섞여 쓰인다"],
 ["yotei","sukejuuru","予定가 기본, スケジュール는 일정표를 뜻할 때가 많다"],
 ["kaiwa","hanashi2","会話는 주고받는 말, 話는 이야기 내용"],
 ["ryokou","tsuaa","ツアー는 짜여 있는 여행 상품"],
 ["kinen2","omiyage","記念品과 お土産는 겹치지만 お土産가 더 흔하다"],
 ["denwabangou","bangou","電話番号는 番号의 한 종류"],
 ["keitai","sumaho","携帯는 옛말, 요즘은 スマホ를 더 쓴다"],
];
