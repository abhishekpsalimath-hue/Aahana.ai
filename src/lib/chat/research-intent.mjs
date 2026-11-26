const FRESHNESS_PATTERNS = [
  /\b(?:latest|currently|current|today|tonight|yesterday|this week|this month|recent|breaking|news|as of 20\d{2}|right now|live update|search the web|web search|research|find sources|with sources|cite sources|citations|latest price|current price|new rules|recent studies|new research|developments|announcements|breakthroughs|what happened|what'?s new|deep dive|investigate|verify|evidence|academic papers?|peer-reviewed|official documentation|release notes|version history)\b/i,
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2}\b/i,
  /\b20\d{2}[-/](?:0?[1-9]|1[0-2])(?:[-/](?:0?[1-9]|[12]\d|3[01]))?\b/,
];

const REGIONAL_FRESHNESS = /ಇತ್ತೀಚಿನ|ಇಂದು|ಪ್ರಸ್ತುತ|ಸುದ್ದಿ|ಸಂಶೋಧನೆ|ಮೂಲಗಳೊಂದಿಗೆ|ವೆಬ್ ಹುಡುಕು|ಪರಿಶೀಲಿಸಿ|ಮೂಲಗಳು|ತಾಜಾ|ಇತ್ತೀಚಿನ ಮಾಹಿತಿ|ताज़ा|आज|वर्तमान|समाचार|शोध|स्रोतों के साथ|वेब पर खोज|जांचें|साक्ष्य|சமீபத்திய|இன்று|தற்போதைய|செய்தி|ஆராய்ச்சி|மூலங்களுடன்|தேடுங்கள்|తాజా|నేడు|ప్రస్తుత|వార్తలు|పరిశోధన|మూలాలతో|వెతకండి|ഏറ്റവും പുതിയ|ഇന്ന്|നിലവിലെ|വാർത്ത|ഗവേഷണം|ഉറവിടങ്ങൾ|തിരയുക|সাম্প্রতিক|আজ|বর্তমান|খবর|গবেষণা|উৎসসহ|খুঁজুন|તાજેતરના|આજે|વર્તમાન|સમાચાર|સંશોધન|સ્ત્રોતો સાથે|ਤਾਜ਼ਾ|ਅੱਜ|ਮੌਜੂਦਾ|ਖ਼ਬਰਾਂ|ਖੋਜ|ਸਰੋਤਾਂ ਸਮੇਤ|تازہ ترین|آج|موجودہ|خبریں|تحقیق|ذرائع کے ساتھ|أحدث|اليوم|الحالي|أخبار|بحث|مصادر|最新|今天|当前|新闻|研究|来源|今日|現在|ニュース|出典|最新|오늘|현재|뉴스|출처|последние|сегодня|текущий|новости|исследования|источники|último|actualidad|hoy|noticias|investigación|fuentes|reciente|dernier|aujourd'hui|actualité|nouvelles|recherche|sources|neueste|heute|aktuell|Nachrichten|Forschung|Quellen/u;

export function shouldSearchWeb(prompt, image = null) {
  if (image) return false;
  const text = String(prompt || "").trim();
  if (!text) return false;
  return FRESHNESS_PATTERNS.some((pattern) => pattern.test(text)) || REGIONAL_FRESHNESS.test(text);
}
