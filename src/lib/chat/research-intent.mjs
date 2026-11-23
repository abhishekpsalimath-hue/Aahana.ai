const ENGLISH_FRESHNESS = /\b(?:latest|currently|current|today|tonight|yesterday|this week|this month|recent|breaking|news|as of 20\d{2}|right now|live update|search the web|web search|research|find sources|with sources|cite sources|citations|latest price|current price|new rules|recent studies|new research|developments|announcements|breakthroughs|what happened|what's new)\b/i;

const DATED_REQUEST = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2}\b/i
  .test.bind(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2}\b/i);

const NUMERIC_DATE = /\b20\d{2}[-/](?:0?[1-9]|1[0-2])(?:[-/](?:0?[1-9]|[12]\d|3[01]))?\b/;

const INDIAN_LANGUAGE_FRESHNESS = /ಇತ್ತೀಚಿನ|ಇಂದು|ಪ್ರಸ್ತುತ|ಸುದ್ದಿ|ಸಂಶೋಧನೆ|ಮೂಲಗಳೊಂದಿಗೆ|ವೆಬ್ ಹುಡುಕು|ताज़ा|आज|वर्तमान|समाचार|शोध|स्रोतों के साथ|वेब पर खोज|சமீபத்திய|இன்று|தற்போதைய|செய்தி|ஆராய்ச்சி|తాజా|నేడు|ప్రస్తుత|వార్తలు|పరిశోధన|ഏറ്റവും പുതിയ|ഇന്ന്|നിലവിലെ|വാർത്ത|ഗവേഷണം/i;

const INTERNATIONAL_LANGUAGE_FRESHNESS = /últim[oa]s?|actualmente|hoy|ayer|noticias|investigación|buscar en la web|fuentes|aujourd'hui|actuellement|dernières?|actualités|recherche|chercher sur le web|neueste|aktuell|heute|nachrichten|forschung|im web suchen|últim[oa]s?|atualmente|hoje|notícias|pesquisa|pesquisar na web|最新|目前|今天|昨天|新闻|研究|搜索网页|网上搜索|最新|現在|今日|昨日|ニュース|研究|ウェブ検索|최신|현재|오늘|어제|뉴스|연구|웹 검색|أحدث|حاليا|اليوم|أمس|أخبار|بحث|البحث على الويب|последние|сейчас|сегодня|вчера|новости|исследования|поиск в интернете/i;

export function shouldSearchWeb(prompt, image = null) {
  if (image) return false;
  const text = String(prompt || "");
  const datedRequest = DATED_REQUEST(text) || NUMERIC_DATE.test(text);
  return ENGLISH_FRESHNESS.test(text)
    || datedRequest
    || INDIAN_LANGUAGE_FRESHNESS.test(text)
    || INTERNATIONAL_LANGUAGE_FRESHNESS.test(text);
}
