const FRESHNESS_PATTERNS = [
  /\b(?:latest|currently|current|today|tonight|yesterday|this week|this month|recent|breaking|news|as of 20\d{2}|right now|live update|search the web|web search|research|find sources|with sources|cite sources|citations|latest price|current price|new rules|recent studies|new research|developments|announcements|breakthroughs|what happened|what'?s new|deep dive|investigate|verify|evidence|academic papers?|peer-reviewed|official documentation|release notes|version history)\b/i,
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2}\b/i,
  /\b20\d{2}[-/](?:0?[1-9]|1[0-2])(?:[-/](?:0?[1-9]|[12]\d|3[01]))?\b/,
];

const REGIONAL_FRESHNESS = /ಇತ್ತೀಚಿನ|ಇಂದು|ಪ್ರಸ್ತುತ|ಸುದ್ದಿ|ಸಂಶೋಧನೆ|ಮೂಲಗಳೊಂದಿಗೆ|ವೆಬ್ ಹುಡುಕು|ಪರಿಶೀಲಿಸಿ|ಮೂಲಗಳು|ತಾಜಾ|ಇತ್ತೀಚಿನ ಮಾಹಿತಿ|ताज़ा|आज|वर्तमान|समाचार|शोध|स्रोतों के साथ|वेब पर खोज|जांचें|साक्ष्य|சமீபத்திய|இன்று|தற்போதைய|செய்தி|ஆராய்ச்சி|மூலங்களுடன்|தேடுங்கள்|తాజా|నేడు|ప్రస్తుత|వార్తలు|పరిశోధన|మూలాలతో|వెతకండి|ഏറ്റവും പുതിയ|ഇന്ന്|നിലവിലെ|വാർത്ത|ഗവേഷണം|ഉറവിടങ്ങൾ|തിരയുക|সাম্প্রতিক|আজ|বর্তমান|খবর|গবেষণা|উৎসসহ|খুঁজুন|તાજેતરના|આજે|વર્તમાન|સમાચાર|સંશોધન|સ્ત્રોતો સાથે|ਤਾਜ਼ਾ|ਅੱਜ|ਮੌਜੂਦਾ|ਖ਼ਬਰਾਂ|ਖੋਜ|ਸਰੋਤਾਂ ਸਮੇਤ|تازہ ترین|آج|موجودہ|خبریں|تحقیق|ذرائع کے ساتھ|أحدث|اليوم|الحالي|أخبار|بحث|مصادر|最新|今天|当前|新闻|研究|来源|今日|現在|ニュース|出典|最新|오늘|현재|뉴스|출처|последние|сегодня|текущий|новости|исследования|источники|último|actualidad|hoy|noticias|investigación|fuentes|reciente|dernier|aujourd'hui|actualité|nouvelles|recherche|sources|neueste|heute|aktuell|Nachrichten|Forschung|Quellen/u;

const NEWS_PATTERNS = [
  /\b(?:news|breaking|headlines|announcements|launched|launch|release|election|results|score|match|market|stocks|weather|forecast|policy update|government update)\b/i,
  /ಸುದ್ದಿ|ವಾರ್ತೆ|ಘೋಷಣೆ|ಬಿಡುಗಡೆ|ಚುನಾವಣೆ|ಫಲಿತಾಂಶ|ಮಾರುಕಟ್ಟೆ|ಹವಾಮಾನ/u,
  /समाचार|ख़बर|खबर|घोषणा|जारी|चुनाव|नतीजे|बाज़ार|मौसम/u,
  /செய்தி|அறிவிப்பு|வெளியீடு|தேர்தல்|முடிவுகள்|சந்தை|வானிலை/u,
  /వార్తలు|ప్రకటన|విడుదల|ఎన్నికలు|ఫలితాలు|మార్కెట్|వాతావరణం/u,
  /വാർത്ത|പ്രഖ്യാപനം|പുറത്തിറക്കം|തിരഞ്ഞെടുപ്പ്|ഫലം|വിപണി|കാലാവസ്ഥ/u,
  /খবর|ঘোষণা|প্রকাশ|নির্বাচন|ফলাফল|বাজার|আবহাওয়া/u,
  /સમાચાર|જાહેરાત|પ્રકાશન|ચૂંટણી|પરિણામ|બજાર|હવામાન/u,
  /ਖ਼ਬਰਾਂ|ਐਲਾਨ|ਜਾਰੀ|ਚੋਣ|ਨਤੀਜੇ|ਬਾਜ਼ਾਰ|ਮੌਸਮ/u,
  /أخبار|عاجل|عناوين|إعلان|إطلاق|انتخابات|نتائج|سوق|طقس/u,
  /新闻|头条|公告|发布|选举|结果|市场|天气/u,
  /ニュース|速報|発表|発売|選挙|結果|市場|天気/u,
  /뉴스|속보|발표|출시|선거|결과|시장|날씨/u,
  /новости|срочно|заголовки|объявления|запуск|выборы|результаты|рынок|погода/u,
  /\b(?:noticias|última hora|titulares|anuncios|lanzamiento|elecciones|resultados|mercado|clima)\b/i,
  /\b(?:actualités|dernières nouvelles|annonces|lancement|élections|résultats|marché|météo)\b/i,
  /\b(?:Nachrichten|Eilmeldungen|Schlagzeilen|Ankündigungen|Veröffentlichung|Wahlen|Ergebnisse|Markt|Wetter)\b/i,
];

export function getResearchTopic(prompt) {
  const text = String(prompt || "").trim();
  return NEWS_PATTERNS.some((pattern) => pattern.test(text)) ? "news" : "general";
}

export function shouldSearchWeb(prompt, image = null) {
  if (image) return false;
  const text = String(prompt || "").trim();
  if (!text) return false;
  return FRESHNESS_PATTERNS.some((pattern) => pattern.test(text)) || REGIONAL_FRESHNESS.test(text);
}
